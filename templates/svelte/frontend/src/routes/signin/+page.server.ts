import type { PageServerLoad } from './$types';
import { lastUsedSignIn } from './lastUsed.ts';

export const load: PageServerLoad = ({ cookies }) => ({
  lastUsed: lastUsedSignIn(cookies),
});
