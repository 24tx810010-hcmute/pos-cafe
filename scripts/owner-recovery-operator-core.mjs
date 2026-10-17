import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const SESSION_MS = 10 * 60_000;
const WINDOW_MS = 15 * 60_000;
const MAX_BODY = 16_384;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const htmlPath = fileURLToPath(new URL('../operator/owner-recovery.html', import.meta.url));

export const recoveryMessages = Object.freeze({
  OWNER_RECOVERY_REVIEW_REQUIRED: 'Chưa đủ căn cứ khôi phục chủ quán. Cần xác minh hồ sơ hỗ trợ.',
  OWNER_PROTECTED: 'Tài khoản cần khôi phục phải là chủ quán đang hoạt động.',
  NOT_FOUND: 'Không tìm thấy tài khoản cần khôi phục.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  ADMIN_REQUEST_REUSED: 'Mã yêu cầu đã được dùng cho nội dung khác. Vui lòng tạo yêu cầu mới.',
  PERMISSION_UPDATE_UNAVAILABLE: 'Chưa xác nhận được việc khôi phục PIN. Kiểm tra hồ sơ trước khi thử lại cùng yêu cầu.',
  INVALID_EMPLOYEE_REQUEST: 'PIN mới phải gồm 6 chữ số.',
});

const digest = value => createHash('sha256').update(value).digest();
const uuid = value => typeof value === 'string' && UUID.test(value) && value !== ZERO_UUID;
const ref = value => typeof value === 'string' && [...value.trim()].length >= 1 && [...value.trim()].length <= 200;
const fail = code => ({ ok: false, error: { code, message: recoveryMessages[code] } });

export function validateRecoveryRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',') !==
      'acknowledged,caseRef,newPin,operatorRef,proofRef,requestId,storeId,targetId')
    return fail('OWNER_RECOVERY_REVIEW_REQUIRED');
  if (!uuid(input.requestId) || !uuid(input.storeId) || !uuid(input.targetId) ||
      !ref(input.operatorRef) || !ref(input.caseRef) || !ref(input.proofRef) || input.acknowledged !== true)
    return fail('OWNER_RECOVERY_REVIEW_REQUIRED');
  if (typeof input.newPin !== 'string' || !/^[0-9]{6}$/.test(input.newPin))
    return fail('INVALID_EMPLOYEE_REQUEST');
  return { ok: true, payload: {
    requestId: input.requestId, storeId: input.storeId, targetId: input.targetId,
    operatorRef: input.operatorRef.trim(), caseRef: input.caseRef.trim(),
    proofRef: input.proofRef.trim(), newPin: input.newPin,
  } };
}

export function projectRecoveryResult(result) {
  if (result?.ok === false) {
    const code = result.error?.code;
    return Object.hasOwn(recoveryMessages, code) ? fail(code) : fail('PERMISSION_UPDATE_UNAVAILABLE');
  }
  if (result?.ok === true && ['applied', 'replayed'].includes(result.outcome) &&
      typeof result.data?.credentialChanged === 'boolean' &&
      result.data?.pinChangeRequired === true &&
      Number.isSafeInteger(result.data?.employeeRevision)) {
    return { ok: true, outcome: result.outcome,
      data: { credentialChanged: result.data.credentialChanged,
        pinChangeRequired: true, employeeRevision: result.data.employeeRevision } };
  }
  return fail('PERMISSION_UPDATE_UNAVAILABLE');
}

export function createPgRecoveryExecutor(dsn, expectedHost) {
  let parsed;
  try { parsed = new URL(dsn); } catch { throw new Error('OWNER_RECOVERY_TARGET_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !expectedHost || parsed.hostname !== expectedHost)
    throw new Error('OWNER_RECOVERY_TARGET_INVALID');
  return async payload => {
    const db = new pg.Client({ connectionString: dsn, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 });
    let connected = false;
    let transaction = false;
    try {
      await db.connect(); connected = true;
      await db.query('begin'); transaction = true;
      await db.query('set local role pos_owner_recovery');
      const response = await db.query('select private.permission_recover_owner($1::jsonb) result', [JSON.stringify(payload)]);
      const projected = projectRecoveryResult(response.rows[0]?.result);
      if (projected.ok) { await db.query('commit'); transaction = false; }
      else { await db.query('rollback'); transaction = false; }
      return projected;
    } catch {
      if (transaction) await db.query('rollback').catch(() => undefined);
      return fail('PERMISSION_UPDATE_UNAVAILABLE');
    } finally {
      if (connected) await db.end().catch(() => undefined);
    }
  };
}

export async function verifyPgRecoveryRole(dsn) {
  const db = new pg.Client({ connectionString: dsn, connectionTimeoutMillis: 5_000, statement_timeout: 5_000 });
  let connected = false;
  try {
    await db.connect(); connected = true;
    await db.query('begin');
    await db.query('set local role pos_owner_recovery');
    const current = await db.query("select current_setting('role') role");
    await db.query('rollback');
    if (current.rows[0]?.role !== 'pos_owner_recovery') throw new Error('OWNER_RECOVERY_ROLE_UNAVAILABLE');
  } catch {
    if (connected) await db.query('rollback').catch(() => undefined);
    throw new Error('OWNER_RECOVERY_ROLE_UNAVAILABLE');
  } finally {
    if (connected) await db.end().catch(() => undefined);
  }
}

function send(res, status, body, extra = {}) {
  const encoded = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(encoded), 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    ...extra });
  res.end(encoded);
}

async function readJson(req) {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new Error('BAD_BODY');
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) throw new Error('BAD_BODY');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('BAD_BODY'); }
}

export function createOwnerRecoveryServer({ launchCode, recover, port = 5191, clock = Date.now,
  html = readFileSync(htmlPath, 'utf8') }) {
  if (typeof launchCode !== 'string' || launchCode.length < 20 || typeof recover !== 'function')
    throw new Error('OWNER_RECOVERY_CONFIG_INVALID');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('OWNER_RECOVERY_CONFIG_INVALID');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!script) throw new Error('OWNER_RECOVERY_CONFIG_INVALID');
  const scriptHash = createHash('sha256').update(script).digest('base64');
  const expectedCode = digest(launchCode);
  const sessions = new Map();
  const unlockAttempts = [];
  const recoverAttempts = new Map();
  const server = createServer(async (req, res) => {
    const address = server.address();
    const origin = `http://127.0.0.1:${address.port}`;
    if (req.headers.host !== `127.0.0.1:${address.port}`) return send(res, 403, { ok: false });
    if (req.method === 'GET' && req.url === '/') {
      const body = Buffer.from(html);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length,
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'` });
      return res.end(body);
    }
    if (req.method !== 'POST' || !['/api/unlock', '/api/recover', '/api/lock'].includes(req.url))
      return send(res, 404, { ok: false });
    if (req.headers.origin !== origin) return send(res, 403, { ok: false });
    let input;
    try { input = await readJson(req); }
    catch { return send(res, 400, { ok: false }); }
    if (req.url === '/api/unlock') {
      const now = clock();
      while (unlockAttempts.length && unlockAttempts[0] <= now - WINDOW_MS) unlockAttempts.shift();
      if (unlockAttempts.length >= 5) return send(res, 429, { ok: false });
      unlockAttempts.push(now);
      if (typeof input?.code !== 'string' || !timingSafeEqual(digest(input.code), expectedCode))
        return send(res, 403, { ok: false });
      unlockAttempts.length = 0;
      const token = randomBytes(32).toString('base64url');
      const csrf = randomBytes(32).toString('base64url');
      sessions.set(token, { csrf, expires: now + SESSION_MS });
      return send(res, 200, { ok: true, csrf, expiresInSeconds: SESSION_MS / 1000 },
        { 'Set-Cookie': `owner_recovery_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600` });
    }
    const cookie = /(?:^|;\s*)owner_recovery_session=([A-Za-z0-9_-]+)/.exec(req.headers.cookie ?? '')?.[1];
    const session = cookie && sessions.get(cookie);
    if (!session || session.expires <= clock() || req.headers['x-csrf-token'] !== session.csrf)
      return send(res, 403, { ok: false });
    if (req.url === '/api/lock') {
      sessions.delete(cookie);
      return send(res, 200, { ok: true }, { 'Set-Cookie': 'owner_recovery_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }
    const now = clock();
    const attempts = (recoverAttempts.get(cookie) ?? []).filter(time => time > now - WINDOW_MS);
    if (attempts.length >= 10) return send(res, 429, { ok: false });
    attempts.push(now); recoverAttempts.set(cookie, attempts);
    const checked = validateRecoveryRequest(input);
    if (!checked.ok) return send(res, 400, checked);
    let result;
    try { result = projectRecoveryResult(await recover(checked.payload)); }
    catch { result = fail('PERMISSION_UPDATE_UNAVAILABLE'); }
    return send(res, result.ok ? 200 : 409, result);
  });
  return { server, listen: () => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(server.address()); });
  }) };
}
