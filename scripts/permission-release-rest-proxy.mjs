import http from 'node:http';

// Local rehearsal only: both listeners share the network-none DB namespace.
// Preserve the genuine PostgREST hook header, status and response body.
const server = http.createServer((request, response) => {
  if (request.url !== '/rest/v1/rpc/permission_contract_probe') {
    response.writeHead(404); response.end(); return;
  }
  const upstream = http.request({ host: '127.0.0.1', port: 3000,
    path: '/rpc/permission_contract_probe', method: request.method,
    headers: request.headers, timeout: 5000 }, result => {
    response.writeHead(result.statusCode ?? 502, result.headers);
    result.pipe(response);
  });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
});
server.listen(3001, '127.0.0.1');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
