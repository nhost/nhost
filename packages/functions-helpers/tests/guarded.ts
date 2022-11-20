import { nhostFunction } from '../src'

export default nhostFunction(
  { roles: ['user', 'admin'] },
  (req, res) => {
    const { userClaims, isAdmin, role } = req
    res.json({ userClaims, isAdmin, role })
  },
  (err, _, res) => {
    res
      .status(err.status)
      .json({ note: 'custom error handler', status: err.status, message: err.message })
  }
)
