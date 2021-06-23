import 'jest-extended'

import { request } from 'test/server'
import { end, statusCode } from 'test/supertest-shared-utils'
import { generateRandomString, registerAndLoginAccount } from 'test/utils'

it('should change password using old password', (done) => {
  const new_password = generateRandomString()
  registerAndLoginAccount(request).then(({email, password, jwtToken}) => {
    request
      .post('/change-password')
      .set({ Authorization: `Bearer ${jwtToken}` })
      .send({ old_password: password, new_password })
      .expect(statusCode(204))
      .end(end(done))
  })
})
