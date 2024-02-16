// import { app } from '@/app';
import supertest from 'supertest';

const request = supertest('http://127.0.0.1:4000');

const resetEnvironment = async () => {
    await request.post('/change-env').send({
      AUTH_ACCESS_CONTROL_ALLOWED_EMAILS: '',
      AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAILS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS: '',
      AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS: '',
      AUTH_USER_DEFAULT_ALLOWED_ROLES: 'me,user,editor',
      AUTH_ANONYMOUS_USERS_ENABLED: false,
      AUTH_CLIENT_URL: 'http://localhost:3000',
      AUTH_CONCEAL_ERRORS: false,
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_DISABLE_SIGNUP: false,
      AUTH_EMAIL_PASSWORDLESS_ENABLED: true,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_EMAIL_TEMPLATE_FETCH_URL: '',
      AUTH_JWT_CUSTOM_CLAIMS: '',
      AUTH_MFA_ENABLED: false,
      AUTH_PASSWORD_HIBP_ENABLED: false,
      AUTH_SERVER_URL: 'http://127.0.0.2:4000',
      AUTH_SMS_PASSWORDLESS_ENABLED: false,
      AUTH_SMS_TEST_PHONE_NUMBERS: '',
      AUTH_WEBAUTHN_ENABLED: false,
      AUTH_WEBAUTHN_RP_NAME: '',
      AUTH_WEBAUTHN_RP_ORIGINS: [],
      AUTH_WEBAUTHN_RP_ID: '',
    });
}

export { request, resetEnvironment };
