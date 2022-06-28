export default (req, res) => {
  res.status(200).send(`Hello from a subdirectory, ${req.query.name}!`)
}
