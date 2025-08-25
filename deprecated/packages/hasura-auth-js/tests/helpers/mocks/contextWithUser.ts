import { faker } from '@faker-js/faker'
import { AuthContext, INITIAL_MACHINE_CONTEXT } from '../../../src'
import fakeUser from './user'

export const contextWithUser: AuthContext = {
  ...INITIAL_MACHINE_CONTEXT,
  accessToken: {
    value: faker.datatype.string(40),
    expiresAt: faker.date.future(),
    expiresInSeconds: 15
  },
  refreshToken: {
    value: faker.datatype.uuid()
  },
  user: fakeUser
}

export default contextWithUser
