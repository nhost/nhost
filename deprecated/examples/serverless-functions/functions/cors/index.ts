/*

- How to enable CORS for browsers

Test:

curl http://localhost:1337/v1/functions/cors \
  -v \
  -X OPTIONS \
  -H "Origin: http://localhost:1337" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" 
*/

import { Request, Response } from 'express'

import { allowCors } from '../_utils/helpers'

const handler = (req: Request, res: Response) => {
  res.send('CORS OK')
}

export default allowCors(handler)
