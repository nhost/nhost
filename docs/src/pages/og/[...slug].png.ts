import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { slug as githubSlug } from 'github-slugger';
import yaml from 'js-yaml';
import {
  generateOgImage,
  getBreadcrumb,
  getDisplayTitle,
} from '../../utils/og-image';

interface OpenAPISchema {
  info: { title: string; description?: string };
  tags?: Array<{ name: string; description?: string }>;
  paths?: Record<
    string,
    Record<
      string,
      { summary?: string; description?: string; operationId?: string; tags?: string[] }
    >
  >;
}

interface OgPath {
  params: { slug: string | undefined };
  props: { title: string; breadcrumb: string; description: string };
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

function generateMethodPathSlug(method: string, pathUrl: string): string {
  const cleanPath = pathUrl
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/[^a-zA-Z0-9/-]/g, '-')
    .replace(/\//g, '-')
    .replace(/-+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');
  return `${method}${cleanPath ? `-${cleanPath}` : ''}`;
}

function getOpenAPIPaths(base: string, schemaPath: string): OgPath[] {
  const raw = readFileSync(join(process.cwd(), 'src', 'schemas', schemaPath), 'utf-8');
  const schema = yaml.load(raw) as OpenAPISchema;
  const paths: OgPath[] = [];

  // Overview page
  paths.push({
    params: { slug: base },
    props: {
      title: schema.info.title,
      breadcrumb: getBreadcrumb(`${base}/index`),
      description: schema.info.description || '',
    },
  });

  // Tag pages
  const seenTags = new Set<string>();
  for (const pathItem of Object.values(schema.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;
      for (const tag of op.tags ?? ['Operations']) {
        seenTags.add(tag);
      }
    }
  }

  for (const tagName of seenTags) {
    const tagSlug = githubSlug(tagName);
    const tagMeta = schema.tags?.find((t) => t.name === tagName);
    paths.push({
      params: { slug: `${base}/operations/tags/${tagSlug}` },
      props: {
        title: tagName.charAt(0).toUpperCase() + tagName.slice(1),
        breadcrumb: getBreadcrumb(`${base}/operations/tags/${tagSlug}/index`),
        description: tagMeta?.description || '',
      },
    });
  }

  // Operation pages
  for (const [pathUrl, pathItem] of Object.entries(schema.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;
      const opSlug = generateMethodPathSlug(method, pathUrl);
      const title = op.summary ?? op.operationId ?? opSlug;
      paths.push({
        params: { slug: `${base}/${opSlug}` },
        props: {
          title,
          breadcrumb: getBreadcrumb(`${base}/${opSlug}/index`),
          description: op.description || '',
        },
      });
    }
  }

  return paths;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await getCollection('docs');
  const docPaths: OgPath[] = docs.map((entry) => ({
    params: { slug: entry.id || undefined },
    props: {
      title: getDisplayTitle(entry.data.title, entry.id),
      breadcrumb: getBreadcrumb(entry.id),
      description: entry.data.description || '',
    },
  }));

  const openAPIPaths = [
    ...getOpenAPIPaths('reference/auth', 'auth.yaml'),
    ...getOpenAPIPaths('reference/storage', 'storage.yaml'),
  ];

  return [...docPaths, ...openAPIPaths];
};

export const GET: APIRoute = async ({ props }) => {
  const { title, breadcrumb, description } = props as {
    title: string;
    breadcrumb: string;
    description: string;
  };
  const png = await generateOgImage(title, breadcrumb, description);

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
