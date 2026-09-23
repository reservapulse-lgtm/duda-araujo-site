const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, 'dist');
const port = Number(process.argv[2] || 4173);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
};

http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }

  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }

  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }

    const headers = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
    };

    let start = 0;
    let end = stat.size - 1;
    let status = 200;
    if (request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(request.headers.range);
      if (!match || (!match[1] && !match[2])) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` });
        response.end();
        return;
      }

      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : end;
      } else {
        const suffixLength = Number(match[2]);
        start = Math.max(0, stat.size - suffixLength);
      }

      if (start >= stat.size || start > end) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` });
        response.end();
        return;
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }

    headers['Content-Length'] = end - start + 1;
    response.writeHead(status, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(file, { start, end }).pipe(response);
  });
}).listen(port, '0.0.0.0', () => {
  console.log(`Preview disponível na porta ${port}`);
});
