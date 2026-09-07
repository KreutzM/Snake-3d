import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/game.js', ['game.js', 'text/javascript; charset=utf-8']],
  ['/game.js.LEGAL.txt', ['game.js.LEGAL.txt', 'text/plain; charset=utf-8']],
  ['/THIRD_PARTY_LICENSES.txt', ['THIRD_PARTY_LICENSES.txt', 'text/plain; charset=utf-8']],
]);
const port = Number(process.env.PORT || 3000);
createServer(async (request, response) => {
  const asset = assets.get(new URL(request.url, 'http://localhost').pathname);
  if (!asset) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const data = await readFile(fileURLToPath(new URL(asset[0], import.meta.url)));
    response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-cache' }); response.end(data);
  } catch { response.writeHead(500); response.end('Asset unavailable. Run npm run build.'); }
}).listen(port, '127.0.0.1', () => console.log(`Snake 3D: http://localhost:${port}`));
