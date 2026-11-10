export default async (req, res) => {
  res
    .status(200)
    .set('Content-Type', 'text/plain')
    .send(`house, ${req.query.name}!`);
};
