export default (req, res) => {
  res
    .status(200)
    .set('Content-Type', 'text/plain')
    .send(`Hullo, ${req.query.name}!`)
}
