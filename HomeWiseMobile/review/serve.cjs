// Serves ONLY the reviewed mock export, loopback only; never starts Expo against production.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist-review');
const port = Number(process.env.HOMEWISE_REVIEW_PORT || 8097);
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Build review export first');
const scripts = fs.readdirSync(path.join(root, '_expo/static/js/web'));
const combined = scripts.filter(x => x.endsWith('.js')).map(x => fs.readFileSync(path.join(root, '_expo/static/js/web', x), 'utf8')).join('\n');
if (combined.includes('homewise-65bb1') || !combined.includes('Local review blocks external requests')) throw new Error('Refusing non-mock or production-containing export');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let target = path.resolve(root, '.' + name);
  if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(root, 'index.html');
  res.setHeader('Content-Security-Policy', "connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'self'");
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`HomeWise MOCK REVIEW http://127.0.0.1:${port}`));
