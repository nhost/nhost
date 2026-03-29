const http = require('http');

const port = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      message: 'Hello from mysvc (dev)!',
      timestamp: new Date().toISOString(),
    }),
  );
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
