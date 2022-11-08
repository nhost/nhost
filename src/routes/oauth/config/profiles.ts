import axios from 'axios';
import { GrantResponse } from 'grant';
import { NormalisedProfile } from '../utils';

export const PROFILE_NORMALISERS: Record<
  string,
  (response: GrantResponse) => Promise<NormalisedProfile> | NormalisedProfile
> = {
  defaults: (response) => {
    // ? improve defaults? Or remove them and raise an error instead? Let's see how other providers behave
    const profile = response.profile;
    const displayName =
      profile.first_name && profile.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : profile.given_name && profile.family_name
        ? `${profile.given_name} ${profile.family_name}`
        : profile.email;

    const avatarUrl =
      profile.photos && Array.isArray(profile.photos)
        ? profile.photos[0]?.value
        : profile.picture;
    return {
      displayName,
      avatarUrl,
      ...profile,
    };
  },

  facebook: ({ profile }) => ({
    id: profile.id,
    displayName: profile.name,
    email: profile.email,
    avatarUrl: profile.picture?.data?.url,
  }),

  github: async ({ profile, access_token }) => {
    // * The email is not returned by default, so we need to make a separate request
    const { data: emails } = await axios.get<
      { email: string; primary: boolean; verified: boolean }[]
    >('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { email, verified } =
      emails.find((email) => email.primary) || emails[0];
    return {
      id: String(profile.id),
      displayName: profile.name,
      avatarUrl: profile.avatar_url,
      email,
      emailVerified: verified,
    };
  },

  google: ({
    profile: { sub, name, picture, email, email_verified, locale },
  }) => ({
    id: sub,
    displayName: name,
    avatarUrl: picture,
    email,
    emailVerified: email_verified,
    locale,
  }),

  workos: ({ profile: { raw_attributes, id, email } }) => ({
    id,
    displayName:
      raw_attributes[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
      ],
    avatarUrl: raw_attributes['http://schemas.auth0.com/picture'],
    email,
    locale: raw_attributes['http://schemas.auth0.com/locale'],
  }),
};
