export default (req, res) => {
  res.status(200).send(`Hullo, ${req.query.name}!`)
}
