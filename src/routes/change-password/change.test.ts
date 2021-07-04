import 'jest-extended'

import { request } from 'test/server'
import { end, statusCode } from 'test/supertest-shared-utils'
import { generateRandomString, registerAndLoginAccount } from 'test/utils'

it('should change password using old password', (done) => {
  const newPassword = generateRandomString()
  registerAndLoginAccount(request).then(({email, password, jwtToken}) => {
    request
      .post('/change-password')
      .set({ Authorization: `Bearer ${jwtToken}` })
      .send({ oldPassword: password, newPassword })
      .expect(statusCode(204))
      .end(end(done))
  })
})
