export default (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://example.com');
  res.setHeader('Access-Control-Allow-Headers', 'X-Custom-Header');
  res.status(200).send('CORS custom');
};
