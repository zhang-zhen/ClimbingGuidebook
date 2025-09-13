const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8080;

const server = http.createServer((req, res) => {
  // Default to index.html
  let filePath = req.url === '/' ? './index.html' : '.' + req.url;
  
  // Determine content type
  const extname = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json'
  };
  
  const contentType = mimeTypes[extname] || 'text/plain';
  
  // Read and serve the file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(port, () => {
  console.log(`🌐 Admin panel server running on http://localhost:${port}`);
  console.log(`📁 Serving files from: ${__dirname}`);
  console.log(`🧗 Open http://localhost:${port} in your browser`);
});
