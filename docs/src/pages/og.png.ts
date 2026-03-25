import type { APIRoute } from 'astro';
import { generateOgImage } from '../utils/og-image';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const title = url.searchParams.get('title') || 'Nhost Docs';
  const breadcrumb = url.searchParams.get('breadcrumb') || '';
  const description = url.searchParams.get('description') || '';

  const png = await generateOgImage(title, breadcrumb, description);

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, s-maxage=31536000, max-age=31536000, immutable',
    },
  });
};
