const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // Get the file path from the URL
  let filePath = '.' + req.url;
  if (filePath === './' || filePath === '.') {
    filePath = './public/index.html';
  }

  // Get the file extension
  const extname = String(path.extname(filePath)).toLowerCase();
  
  // Set the content type based on the file extension
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };

  const contentType = contentTypes[extname] || 'text/plain';

  // Read the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // If the file is not found, try to serve the index.html
        fs.readFile('./public/index.html', (err, content) => {
          if (err) {
            res.writeHead(500);
            res.end('Error loading index.html');
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        });
      } else {
        // For other errors, return a 500 error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // If the file is found, serve it
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Press Ctrl+C to stop the server`);
});
