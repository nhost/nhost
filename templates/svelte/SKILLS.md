# Skills

Workflows for this project, one section each. Every section here is also
shipped as `.claude/skills/<name>/SKILL.md`, byte for byte, so Claude Code and
agents that read this file see the same instructions.

## Remove a sign-in method

Each sign-in method is one directory under `frontend/src/routes/auth/` and one
line in `frontend/src/lib/signin/methods.ts`. SvelteKit maps the directory
tree to URLs, and nothing else imports from a method, so removing one is two
deletions and a build.

1. Delete the method's directory, e.g. `rm -rf frontend/src/routes/auth/otp`.
   Its route disappears with it, along with the form and actions that only it
   used, because they sit in the same directory.
2. Delete its entry - the object whose `href` is `/auth/otp` - from the
   `methods` array in `frontend/src/lib/signin/methods.ts`.
3. From `frontend/`, run `pnpm lint && pnpm build`. The build runs
   `svelte-check` over the whole app, including the markup in every `.svelte`
   file, so a dangling import or a component that is gone shows up here.

If the backend had the method enabled in `nhost.toml`
(`auth.method.emailPasswordless` for magic link, `auth.method.otp.email` for
the email code, `auth.method.oauth.<provider>` for OAuth), you may disable it
there too; the app does not depend on it either way.

Do not remove `frontend/src/lib/signin/` itself or anything under
`frontend/src/lib/nhost/`: those are shared by every method.
