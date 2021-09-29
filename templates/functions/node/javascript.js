module.exports = (req, res) => {
  res.status(200).send(`Nhost, from Javascript, pays it's respects to ${req.query.name}!`);
};
