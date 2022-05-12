import faker from '@faker-js/faker'
import { User } from '../../../src/types'

/**
 * A fake user object.
 */
export const fakeUser: User = {
  id: faker.datatype.uuid(),
  createdAt: faker.date.past().toUTCString(),
  displayName: `${faker.name.firstName()} ${faker.name.lastName()}`,
  avatarUrl: faker.internet.avatar(),
  locale: 'en',
  isAnonymous: faker.datatype.boolean(),
  emailVerified: true,
  defaultRole: 'user',
  roles: ['user', 'me'],
  phoneNumber: null,
  phoneNumberVerified: false,
  activeMfaType: null,
  metadata: {}
}

export default fakeUser
