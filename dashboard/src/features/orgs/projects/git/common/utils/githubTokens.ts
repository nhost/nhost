import type { ProviderSession } from '@nhost/nhost-js/auth';
import { isNotEmptyValue } from '@/lib/utils';

const githubProviderTokenKey = 'nhost_provider_tokens_github';

export type GitHubProviderToken = ProviderSession & {
  authUserProviderId?: string;
};

export function saveGitHubToken(token: GitHubProviderToken) {
  localStorage.setItem(githubProviderTokenKey, JSON.stringify(token));
}

export function getGitHubToken() {
  const token = localStorage.getItem(githubProviderTokenKey);
  return isNotEmptyValue(token)
    ? (JSON.parse(token) as GitHubProviderToken)
    : null;
}

export function clearGitHubToken() {
  localStorage.removeItem(githubProviderTokenKey);
}
