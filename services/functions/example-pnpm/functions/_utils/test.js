export default async (req, res) => {
  res
    .status(200)
    .set('Content-Type', 'text/plain')
    .send(`test, ${req.query.name}!`);
};
