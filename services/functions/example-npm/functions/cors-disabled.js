export default (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '');
  res.setHeader('Access-Control-Allow-Headers', '');
  res.status(200).send('CORS disabled');
};
