import { nhostFunction } from '../src'

export default nhostFunction((req, res) => {
  const { userClaims, isAdmin, role } = req
  res.json({ userClaims, isAdmin, role })
})
