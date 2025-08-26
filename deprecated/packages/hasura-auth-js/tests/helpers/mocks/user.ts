import { faker } from '@faker-js/faker'
import { User } from '../../../src'

/**
 * A fake user object.
 */
export const fakeUser: User = {
  id: faker.datatype.uuid(),
  createdAt: faker.date.past().toUTCString(),
  displayName: `${faker.name.firstName()} ${faker.name.lastName()}`,
  avatarUrl: faker.internet.avatar(),
  locale: 'en',
  isAnonymous: false,
  emailVerified: true,
  defaultRole: 'user',
  roles: ['user', 'me'],
  phoneNumber: null,
  phoneNumberVerified: false,
  activeMfaType: null,
  metadata: {}
}

/**
 * A fake anonymous user object with the same id and creation date as the fake user
 */
export const fakeAnonymousUser: User = {
  ...fakeUser,

  displayName: 'Anonymous User',
  avatarUrl: faker.internet.avatar(),
  locale: 'en',
  isAnonymous: true,
  emailVerified: false,
  defaultRole: 'anonymous',
  roles: ['anonymous'],
  phoneNumber: null,
  phoneNumberVerified: false,
  activeMfaType: null,
  metadata: {}
}

export default fakeUser
