export default async (req, res) => {
  res.status(200).send(`house, ${req.query.name}!`);
};
