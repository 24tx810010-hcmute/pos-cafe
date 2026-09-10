import { createServer, request } from 'node:http';

const listenPort = Number(process.argv[2]);
const upstreamPort = Number(process.argv[3]);
const authPort = process.argv[4] ? Number(process.argv[4]) : null;
if (![listenPort, upstreamPort].every((value) => Number.isInteger(value) && value > 1024 && value < 65536)) throw new Error('Invalid local proxy ports');
if (authPort !== null && (!Number.isInteger(authPort) || authPort <= 1024 || authPort >= 65536)) throw new Error('Invalid local Auth port');

createServer((incoming, outgoing) => {
  const origin = incoming.headers.origin;
  if (origin && /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) outgoing.setHeader('Access-Control-Allow-Origin', origin);
  outgoing.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-pos-employee-token,x-client-info,prefer,x-supabase-api-version,accept-profile,content-profile,x-retry-count,range,range-unit');
  outgoing.setHeader('Access-Control-Expose-Headers', 'content-range,range-unit,preference-applied');
  outgoing.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (incoming.method === 'OPTIONS') { outgoing.writeHead(204); outgoing.end(); return; }
  const auth = authPort !== null && incoming.url?.startsWith('/auth/v1/');
  if (!auth && !incoming.url?.startsWith('/rest/v1/')) { outgoing.writeHead(404); outgoing.end('{"error":"Only the configured native REST and Auth services are available"}'); return; }
  const upstream = request({ hostname: '127.0.0.1', port: auth ? authPort : upstreamPort, method: incoming.method, path: incoming.url.slice(auth ? '/auth/v1'.length : '/rest/v1'.length), headers: incoming.headers }, (response) => {
    outgoing.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(outgoing);
  });
  upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end('{"error":"Contract database API unavailable"}'); });
  incoming.pipe(upstream);
}).listen(listenPort, '127.0.0.1');
