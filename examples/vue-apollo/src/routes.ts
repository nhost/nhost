import { RouteRecordRaw } from 'vue-router'

import Index from './pages/IndexPage.vue'
import Profile from './pages/ProfilePage.vue'
import SignInMain from './pages/sign-in/CommonActions.vue'
import SignInEmailPasword from './pages/sign-in/EmailPassword.vue'
import SignInEmailPaswordless from './pages/sign-in/EmailPasswordless.vue'
import SignIn from './pages/sign-in/IndexPage.vue'
import SignUpMain from './pages/sign-up/CommonActions.vue'
import SignUpEmailPasword from './pages/sign-up/EmailPassword.vue'
import SignUpEmailPaswordless from './pages/sign-up/EmailPasswordless.vue'
import SignUp from './pages/sign-up/IndexPage.vue'
import Signout from './pages/SignoutPage.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', component: Index, meta: { auth: true } },
  { path: '/profile', component: Profile, meta: { auth: true } },
  { path: '/signout', component: Signout },
  {
    path: '/signin',
    component: SignIn,
    children: [
      { path: '', component: SignInMain },
      {
        path: 'passwordless',
        component: SignInEmailPaswordless
      },
      {
        path: 'email-password',
        component: SignInEmailPasword
      }
    ]
  },
  {
    path: '/signup',
    component: SignUp,

    children: [
      { path: '', component: SignUpMain },
      {
        path: 'passwordless',
        component: SignUpEmailPaswordless
      },
      {
        path: 'email-password',
        component: SignUpEmailPasword
      }
    ]
  }
]
export default routes
