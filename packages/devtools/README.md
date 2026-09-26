# @nhost/devtools

A development toolbar for Nhost projects. A small Nhost tab sits flush against
the edge of the screen while your dev server runs, and opens into links to the
local Dashboard, Hasura and Mailhog.

Drag the tab to any edge. Preferences keeps the edge, the position along it, the
theme and a hide-for-this-session flag in local storage.

## Install

```sh
pnpm add -D @nhost/devtools
```

It belongs in `devDependencies`. Nothing in your application code should import
it outside a development build.

## Use it

React, including Next.js:

```tsx
import { NhostDevToolbar } from '@nhost/devtools/react';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <NhostDevToolbar />}
      </body>
    </html>
  );
}
```

The component renders nothing where you put it: the toolbar mounts itself into
`document.body` from an effect, so there is no markup to mismatch on a server
render and nothing in the way of your own layout.

Anywhere else, mount it yourself. The call returns the function that takes it
back off the page:

```js
import { mountNhostDevToolbar } from '@nhost/devtools';

const unmount = mountNhostDevToolbar();
```

Vue, in `onMounted`; Svelte, in `onMount`; SolidJS, in `onMount`; plain HTML,
in a module script. Each of those wants the unmount function on teardown.

## Which backend it points at

Both options default to `local`, which is what `nhost up` serves, so a project
running against the local stack needs no configuration at all.

```tsx
<NhostDevToolbar
  subdomain={process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN}
  region={process.env.NEXT_PUBLIC_NHOST_REGION}
/>
```

```js
mountNhostDevToolbar({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN,
  region: import.meta.env.VITE_NHOST_REGION,
});
```

This package cannot read your framework's environment variables itself, which is
why they are passed in.

## When it stays away

The toolbar refuses to appear in three cases, and mounting it is a no-op in each:

- there is no document, so a server render never sees it
- `region` is anything other than `local`. Everything it links to is part of
  `nhost up`, so against a deployed project those hostnames do not resolve and
  there would be nothing to show
- this browser session hid it

The React component additionally does nothing when `process.env.NODE_ENV` is
`production`, so it is inert at runtime there. This does not keep it out of the
bundle: the check sits inside the component's effect, so importing
`NhostDevToolbar` without a guard still pulls the whole toolbar into a
production build. The `process.env.NODE_ENV === 'development'` guard shown in
the usage example above is what keeps it out. The local-backend check is the
one that always applies.

## Hiding it

Preferences has a "Hide for this session" button. That removes the only control
that could bring it back, so the way back is `?nhost-devtools=true` on any URL
of your app. It clears the flag outright rather than overriding it for one page,
so the toolbar stays up once the parameter is gone.

## Styling

The toolbar carries its own CSS and mounts it inside its own root. There is no
stylesheet to import, and it needs no Tailwind, no CSS framework and no build
step of yours. Every declaration is scoped under `.ndt-*`.

## Removing it

Delete the import and the dependency. It leaves two keys behind in the browser,
`nhost-dev-toolbar` in local storage and `nhost-dev-toolbar-hidden` in session
storage.
