import { RouteRecordRaw } from 'vue-router'

import AboutPage from './pages/AboutPage.vue'
import ApolloPage from './pages/ApolloPage.vue'
import SecretNotes from './pages/SecretNotesPage.vue'
import Index from './pages/IndexPage.vue'
import Profile from './pages/ProfilePage.vue'
import SignInMain from './pages/sign-in/CommonActions.vue'
import SignInEmailPasword from './pages/sign-in/EmailPassword.vue'
import SignInEmailPaswordless from './pages/sign-in/EmailPasswordless.vue'
import SignInEmailOTP from './pages/sign-in/EmailOTP.vue'
import SignIn from './pages/sign-in/IndexPage.vue'
import SignUpMain from './pages/sign-up/CommonActions.vue'
import SignUpEmailPasword from './pages/sign-up/EmailPassword.vue'
import SignUpEmailPaswordless from './pages/sign-up/EmailPasswordless.vue'
import SignUpEmailSecurityKey from './pages/sign-up/SecurityKey.vue'
import SignInEmailSecurityKey from './pages/sign-in/SecurityKey.vue'
import ForgotPassword from './pages/sign-in/ForgotPassword.vue'
import SignUp from './pages/sign-up/IndexPage.vue'
import Signout from './pages/SignoutPage.vue'
import StoragePage from './pages/StoragePage.vue'
import VerifyPage from './pages/VerifyEmail.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', component: Index, meta: { auth: true } },
  { path: '/verify', component: VerifyPage },
  { path: '/profile', component: Profile, meta: { auth: true } },
  { path: '/about', component: AboutPage },
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
        path: 'otp',
        component: SignInEmailOTP
      },
      {
        path: 'email-password',
        component: SignInEmailPasword
      },
      {
        path: 'security-key',
        component: SignInEmailSecurityKey
      },
      {
        path: 'forgot-password',
        component: ForgotPassword
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
      },
      {
        path: 'security-key',
        component: SignUpEmailSecurityKey
      }
    ]
  },
  { path: '/apollo', component: ApolloPage, meta: { auth: true } },
  { path: '/secret-notes', component: SecretNotes, meta: { auth: true } },
  { path: '/storage', component: StoragePage, meta: { auth: true } }
]
