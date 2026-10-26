import { appendPkceId, generateAndStorePKCE } from '@/lib/pkce';
import { nhost } from '@/utils/nhost';

interface StartGitHubConnectOptions {
  nhostAccessToken: string | undefined;
  redirectTo: string;
}

export default async function startGitHubConnect({
  nhostAccessToken,
  redirectTo,
}: StartGitHubConnectOptions) {
  const { challenge, id } = await generateAndStorePKCE();
  const url = nhost.auth.signInProviderURL('github', {
    connect: nhostAccessToken,
    redirectTo: appendPkceId(redirectTo, id),
    codeChallenge: challenge,
  });
  window.location.href = url;
}
