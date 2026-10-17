import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOwnerRecoveryServer, createPgRecoveryExecutor, verifyPgRecoveryRole } from './owner-recovery-operator-core.mjs';

async function main() {
  const file = process.env.OWNER_RECOVERY_DSN_FILE;
  const expectedHost = process.env.OWNER_RECOVERY_EXPECTED_HOST;
  const launchCode = process.env.OWNER_RECOVERY_LAUNCH_CODE;
  const port = Number(process.env.OWNER_RECOVERY_PORT ?? '5191');
  if (!file || !expectedHost || !launchCode || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('OWNER_RECOVERY_CONFIG_INVALID');
  const credentialPath = realpathSync(file);
  const workspace = resolve(fileURLToPath(new URL('..', import.meta.url)));
  if (credentialPath.toLowerCase().startsWith((workspace + '\\').toLowerCase()) ||
      credentialPath.toLowerCase().startsWith((workspace + '/').toLowerCase()))
    throw new Error('OWNER_RECOVERY_CREDENTIAL_FILE_IN_WORKSPACE');
  const dsn = readFileSync(credentialPath, 'utf8').trim();
  const recover = createPgRecoveryExecutor(dsn, expectedHost);
  await verifyPgRecoveryRole(dsn);
  const { server, listen } = createOwnerRecoveryServer({ launchCode, recover, port });
  const address = await listen();
  process.stdout.write(`OWNER_RECOVERY_READY http://127.0.0.1:${address.port}\n`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
}

main().catch(error => {
  const code = error instanceof Error && /^OWNER_RECOVERY_[A-Z_]+$/.test(error.message)
    ? error.message : 'OWNER_RECOVERY_START_FAILED';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
