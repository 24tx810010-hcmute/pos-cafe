import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file || !/ui-attempt-\d{2}\.log$/.test(file)) throw new Error('PIN_ACK_DIAGNOSTIC_PATH_REFUSED');
const raw = readFileSync(file, 'utf8');
const refs = [...new Set([...raw.matchAll(/permissionPinAckLoss\.spec\.ts:(\d+):(\d+)/g)].map(match => `${match[1]}:${match[2]}`))];
const codes = [...new Set(raw.match(/PIN_ACK_[A-Z_]+/g) ?? [])];
const kinds = ['TimeoutError', 'Timed out', 'Error:'].filter(value => raw.includes(value));
console.log(JSON.stringify({ refs, codes, kinds, hasWebServerFailure: raw.includes('webServer') }));
