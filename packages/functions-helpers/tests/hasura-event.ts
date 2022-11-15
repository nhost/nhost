import { eventFunction } from '../src'

export default eventFunction<{ bob: string }>(
  'INSERT',
  (req, res) => {
    const { userClaims, isAdmin, role } = req
    const b = req.body
    console.log(b.event.data.new)
    console.log(b.event.data.old)
    res.json({ userClaims, isAdmin, role })
  },
  (err, _, res) => {
    res
      .status(err.status)
      .json({ note: 'custom error handler', status: err.status, message: err.message })
  }
)
