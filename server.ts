import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // Also load .env if it exists

import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { WsBridge } from './src/lib/ws-bridge';
import { runAgent } from './src/lib/agent';
import type { ClientMessage } from './src/types/messages';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url!, true);

    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (client) => {
        wss.emit('connection', client, req);
      });
    } else {
      // Let Next.js handle its own upgrades (HMR, etc.)
      // Don't destroy — Next.js internal upgrade handler picks these up
    }
  });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');

    let agentRunning = false;

    ws.on('message', async (data) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());

        if (msg.type === 'start' && !agentRunning) {
          agentRunning = true;
          console.log(
            `[WS] Starting presentation: ${msg.slideCount} slides`,
          );

          const bridge = new WsBridge(ws);

          try {
            await runAgent(
              msg.markdown,
              msg.objectives,
              msg.slideCount,
              msg.tone || 'professional',
              bridge,
            );
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : 'Unknown error';
            console.error('[Agent] Error:', errorMessage);
            bridge.sendError(errorMessage);
          } finally {
            agentRunning = false;
          }
        }
      } catch {
        // Non-JSON messages or parse errors — ignore (ack messages handled by WsBridge)
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
