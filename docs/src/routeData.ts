import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

// Starlight does not apply `base` to hero action links from frontmatter
// (`hero.actions[].link: /products/database`), so prefix root-relative ones.
export const onRequest = defineRouteMiddleware((context) => {
  const actions = context.locals.starlightRoute.entry.data.hero?.actions;
  if (!base || !actions) return;

  for (const action of actions) {
    if (action.link.startsWith('/') && !action.link.startsWith('//')) {
      action.link = `${base}${action.link}`;
    }
  }
});
