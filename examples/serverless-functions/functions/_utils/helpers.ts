/*
Files inside a folder that starts with an underscore (like `_utils`) are not considered as endpoints. Here you can put code that you want to reuse in your functions.
*/

export const add = (a: number, b: number): number => a + b

export const allowCors = (fn) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  return await fn(req, res)
}
