export default (req, res) => {
  res
    .status(200)
    .set('Content-Type', 'text/plain')
    .send(`Hello from a subdirectory, ${req.query.name}!`)
}
