/**
 * AIoTLibTQB Unified Local Gateway
 * Proxies HTTP and WebSockets from a single port (4000) to:
 * - Next.js Frontend (port 3000)
 * - Spring Boot Backend (port 8080)
 */

const http = require('http');
const net = require('net');

const GATEWAY_PORT = 4000;
const FRONTEND_PORT = 3000;
const BACKEND_PORT = 8080;

function isBackendRoute(url) {
  return (
    url.startsWith('/api/') ||
    url.startsWith('/ws-') ||
    url.startsWith('/actuator/')
  );
}

const server = http.createServer((req, res) => {
  const targetPort = isBackendRoute(req.url) ? BACKEND_PORT : FRONTEND_PORT;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const clientProto = req.headers['x-forwarded-proto'] || 'http';

  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${targetPort}`,
      'x-forwarded-for': clientIp,
      'x-forwarded-proto': clientProto,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        code: 9999,
        message: `Gateway failed to reach port ${targetPort}: ${err.message}`,
      })
    );
  });

  req.pipe(proxyReq, { end: true });
});

// WebSocket Upgrade Proxying (STOMP /ws-aiot)
server.on('upgrade', (req, clientSocket, head) => {
  const targetPort = isBackendRoute(req.url) ? BACKEND_PORT : FRONTEND_PORT;

  const targetSocket = net.connect(targetPort, '127.0.0.1', () => {
    let rawHeaders = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i];
      let val = req.rawHeaders[i + 1];
      if (key.toLowerCase() === 'host') {
        val = `127.0.0.1:${targetPort}`;
      }
      rawHeaders += `${key}: ${val}\r\n`;
    }
    rawHeaders += '\r\n';

    targetSocket.write(rawHeaders);
    if (head && head.length > 0) {
      targetSocket.write(head);
    }
    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
  });

  targetSocket.on('error', () => {
    clientSocket.destroy();
  });
  clientSocket.on('error', () => {
    targetSocket.destroy();
  });
});

server.listen(GATEWAY_PORT, '0.0.0.0', () => {
  console.log(`[AIoT Gateway] Listening on http://0.0.0.0:${GATEWAY_PORT}`);
  console.log(`[AIoT Gateway] -> Frontend: http://127.0.0.1:${FRONTEND_PORT}`);
  console.log(`[AIoT Gateway] -> Backend:  http://127.0.0.1:${BACKEND_PORT}`);
});
