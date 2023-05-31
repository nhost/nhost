import { normaliseProfile, transformOauthProfile } from '@/routes/oauth/utils';

describe('OAuth helpers', () => {
  it('should transform a Facebook profile', async () => {
    const facebookProfile = {
      id: '1234567890123456',
      name: 'Bob Smith',
      email: 'bob.smith@gmail.com',
      picture: {
        data: {
          height: 50,
          is_silhouette: false,
          url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=1234567890123456&height=50&width=50&ext=1234567894&hash=Qdiofewu-OPO',
          width: 50,
        },
      },
    };
    const normalisedProfile = await normaliseProfile('facebook', {
      profile: facebookProfile,
    });
    const output = await transformOauthProfile(normalisedProfile);
    expect(output).toMatchSnapshot();
  });

  it('should transform a Google profile', async () => {
    const googleProfile = {
      sub: '115101935075799946233',
      name: 'Bob Smith',
      given_name: 'Bob',
      family_name: 'Smith',
      picture: 'https://lh3.googleusercontent.com/a/9en433u3nrkwpYEfHIOUJBD-C',
      email: 'bob.smith@gmail.com',
      email_verified: true,
      locale: 'en',
    };
    const normalisedProfile = await normaliseProfile('google', {
      profile: googleProfile,
    });
    const output = await transformOauthProfile(normalisedProfile);
    expect(output).toMatchSnapshot();
  });

  it('should transform a WorkOS profile', async () => {
    const workosProfile = {
      object: 'profile',
      id: 'prof_01G8JEWGEZ043JEWGEZ0434GFR',
      organization_id: 'org_01G8JEWGEZ01G8JEWGEZ0AYG36',
      connection_id: 'conn_01GC9D01G8JEWGEZ01G8JEWGEZ',
      connection_type: 'Auth0SAML',
      idp_id: 'google-oauth2|123456678998474747473',
      email: 'bob.smith@gmail.com',
      first_name: 'Bob',
      last_name: 'Smith',
      raw_attributes: {
        'http://schemas.auth0.com/locale': 'en',
        'http://schemas.auth0.com/picture':
          'https://lh3.googleusercontent.com/a/9en433u3nrkwpYEfHIOUJBD-C',
        'http://schemas.auth0.com/clientID': '8euejejeu88euejejeu88euejejeu8kQ',
        'http://schemas.auth0.com/nickname': 'bobsmith',
        'http://schemas.auth0.com/created_at':
          'Tue Sep 06 2022 12:43:37 GMT+0000 (Coordinated Universal Time)',
        'http://schemas.auth0.com/updated_at':
          'Mon Nov 07 2022 20:37:03 GMT+0000 (Coordinated Universal Time)',
        'http://schemas.auth0.com/email_verified': 'true',
        'http://schemas.auth0.com/identities/default/isSocial': 'true',
        'http://schemas.auth0.com/identities/default/provider': 'google-oauth2',
        'http://schemas.auth0.com/identities/default/connection':
          'google-oauth2',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn':
          'bob.smith@gmail.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name':
          'Bob Smith',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname':
          'Smith',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname':
          'Bob',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress':
          'bob.smith@gmail.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier':
          'google-oauth2|123456789012345678903',
      },
    };
    const normalisedProfile = await normaliseProfile('workos', {
      profile: workosProfile,
    });
    const output = await transformOauthProfile(normalisedProfile);
    expect(output).toMatchSnapshot();
  });

  it('should handle an array of allowed roles', async () => {
    const facebookProfile = {
      id: '1234567890123456',
      name: 'Bob Smith',
      email: 'bob.smith@gmail.com',
      picture: {
        data: {
          height: 50,
          is_silhouette: false,
          url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=1234567890123456&height=50&width=50&ext=1234567894&hash=Qdiofewu-OPO',
          width: 50,
        },
      },
    };
    const normalisedProfile = await normaliseProfile('facebook', {
      profile: facebookProfile,
    });
    const output = await transformOauthProfile(normalisedProfile, {
      allowedRoles: ['user', 'me'],
    });
    expect(output).toMatchSnapshot();
  });

  it('should handle comma separated allowedRoles', async () => {
    const facebookProfile = {
      id: '1234567890123456',
      name: 'Bob Smith',
      email: 'bob.smith@gmail.com',
      picture: {
        data: {
          height: 50,
          is_silhouette: false,
          url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=1234567890123456&height=50&width=50&ext=1234567894&hash=Qdiofewu-OPO',
          width: 50,
        },
      },
    };
    const normalisedProfile = await normaliseProfile('facebook', {
      profile: facebookProfile,
    });
    const output = await transformOauthProfile(normalisedProfile, {
      allowedRoles: 'user,me' as any,
    });
    expect(output).toMatchSnapshot();
  });
});
