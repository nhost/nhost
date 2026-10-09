# Skills

Workflows for this project, one section each. Every section here is also
shipped as `.claude/skills/<name>/SKILL.md`, byte for byte, so Claude Code and
agents that read this file see the same instructions.

## Remove a sign-in method

Each sign-in method is one directory under `frontend/src/app/auth/` and one
line in `frontend/src/signin/methods.ts`. The routes are read from the
directory tree, by Expo Router itself or by `frontend/src/screens.ts` under
React Navigation, and nothing else imports from a method, so removing one is
two deletions and a build.

1. Delete the method's directory, e.g. `rm -rf frontend/src/app/auth/otp`. Its
   route disappears with it, along with the calls that only it made, because
   they live in the file that is its route.
2. Delete its entry - the object whose `href` is `/auth/otp` - from the
   `methods` array in `frontend/src/signin/methods.ts`.
3. From `frontend/`, run `pnpm lint && pnpm build`. The build type-checks the
   whole app and then bundles it, so a dangling import shows up here.

If the backend had the method enabled in `nhost.toml`
(`auth.method.emailPasswordless` for magic link, `auth.method.otp.email` for
the email code, `auth.method.oauth.<provider>` for OAuth), you may disable it
there too; the app does not depend on it either way.

Do not remove `frontend/src/signin/` itself or anything under
`frontend/src/lib/` or `frontend/src/components/`: those are shared between the
methods. Leave the files that start the app and find its screens alone too:
`frontend/src/app/_layout.tsx` under Expo Router, and `frontend/index.ts`,
`frontend/src/App.tsx`, `frontend/src/screens.ts` and `frontend/src/linkPath.ts`
under React Navigation.
