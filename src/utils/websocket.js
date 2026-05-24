const WebSocket = require('ws');

let wss;

const setupWebSocket = (server) => {
  wss = new WebSocket.Server({ server });
  wss.on('connection', (ws) => {
    ws.on('error', console.error);
    ws.send(JSON.stringify({ event: 'connected', message: 'CarbonTrust WS connected' }));
  });
  console.log('WebSocket server ready');
};

const broadcast = (event, data) => {
  if (!wss) return;
  const payload = JSON.stringify({ event, data, ts: new Date() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
};

module.exports = { setupWebSocket, broadcast };
