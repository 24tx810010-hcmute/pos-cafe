import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { pinAckEnvironment, assertPinAckTarget } from '../tests/supabase/permissionPinAckEnvironment.ts';

try {
  const env = pinAckEnvironment();
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  await db.connect();
  try {
    await assertPinAckTarget(db, env);
    const rows = (await db.query(`select s.id store_id,e.id owner_id from public.stores s
      join public.employees e on e.store_id=s.id and e.role='owner' where s.name='G2a ACK A'`)).rows;
    if (rows.length !== 1) throw new Error('PIN_ACK_PENDING_OWNER_REQUIRED');
    const payload = { schemaVersion: 1, kind: 'pay_order', orderId: randomUUID(), paymentId: randomUUID(),
      expectedVersion: 0, method: 'cash', receivedAmount: 50000 };
    const valid = (await db.query('select private.valid_write_payload($1::uuid,$2::jsonb) valid', [randomUUID(), payload])).rows[0].valid;
    await db.query('begin');
    let inserted = false, sqlstate = null;
    try {
      await db.query(`with fixed as (select private.write_clock() at_time)
        insert into public.write_operations
        (store_id,operation_id,schema_version,kind,required_permission,payload,registered_at,expires_at,initiated_by_employee_id)
        select $1::uuid,$2::uuid,1,'pay_order','payment.take',$3::jsonb,fixed.at_time,fixed.at_time+interval '24 hours',$4::uuid from fixed`,
        [rows[0].store_id, randomUUID(), JSON.stringify(payload), rows[0].owner_id]);
      inserted = true;
    } catch (error) { sqlstate = /^[0-9A-Z]{5}$/.test(error?.code ?? '') ? error.code : 'OTHER'; }
    finally { await db.query('rollback'); }
    console.log(JSON.stringify({ validPayload: valid, inserted, sqlstate }));
  } finally { await db.end(); }
} catch (error) {
  const code = error instanceof Error && /^PIN_ACK_[A-Z_]+$/.test(error.message) ? error.message : 'PIN_ACK_PENDING_PROBE_FAILED';
  console.error(code); process.exitCode = 1;
}
