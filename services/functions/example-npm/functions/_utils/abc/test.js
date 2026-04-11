export default async (req, res) => {
  res.status(200).send(`test, ${req.query.name}!`);
};
