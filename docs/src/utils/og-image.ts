import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

// Use process.cwd() as it reliably points to the project root during build
const assetsDir = join(process.cwd(), 'src', 'assets');

const interRegular = readFileSync(join(assetsDir, 'fonts', 'Inter-Regular.ttf'));
const interSemiBold = readFileSync(join(assetsDir, 'fonts', 'Inter-SemiBold.ttf'));
const interBold = readFileSync(join(assetsDir, 'fonts', 'Inter-Bold.ttf'));

const logoSvg = readFileSync(join(assetsDir, 'logo', 'dark.svg'), 'utf-8');
const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

// Words that should use a specific casing instead of naive Title Case
const SPECIAL_CASINGS: Record<string, string> = {
  cli: 'CLI',
  mcp: 'MCP',
  ai: 'AI',
  api: 'API',
  sdk: 'SDK',
  graphql: 'GraphQL',
  oauth2: 'OAuth2',
  js: 'JS',
  nextjs: 'Next.js',
  reactnative: 'React Native',
  sql: 'SQL',
  url: 'URL',
};

function capitalizeWord(word: string): string {
  return SPECIAL_CASINGS[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1);
}

function capitalizeSegment(segment: string): string {
  // Check if the entire segment (before splitting on hyphens) has a special casing
  if (SPECIAL_CASINGS[segment.toLowerCase()]) {
    return SPECIAL_CASINGS[segment.toLowerCase()];
  }
  return segment.split('-').map(capitalizeWord).join(' ');
}

export function getBreadcrumb(slug: string): string {
  const parts = slug.split('/');
  // Remove the last part (the page itself) to get the section path
  const sectionParts = parts.slice(0, -1);
  return sectionParts.map(capitalizeSegment).join(' > ');
}

/**
 * For generic titles like "Overview", derive a more meaningful title
 * from the slug so the OG image is informative on its own.
 */
export function getDisplayTitle(title: string, slug: string): string {
  const genericTitles = new Set(['overview']);
  if (!genericTitles.has(title.toLowerCase())) return title;

  const lastSegment = slug.split('/').pop() || '';
  const sectionName = capitalizeSegment(lastSegment);

  // Avoid "Overview Overview"
  if (sectionName.toLowerCase() === title.toLowerCase()) return title;

  return `${sectionName} ${title}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export async function generateOgImage(
  title: string,
  breadcrumb: string,
  description?: string,
): Promise<Buffer> {
  // Adapt font size for long titles
  const titleLength = title.length;
  let titleFontSize = 52;
  if (titleLength > 60) {
    titleFontSize = 36;
  } else if (titleLength > 40) {
    titleFontSize = 44;
  }

  const displayDescription = description ? truncate(description, 140) : '';

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 64px',
          background: 'linear-gradient(135deg, #080808 0%, #0d1a2d 100%)',
          fontFamily: 'Inter',
        },
        children: [
          // Top: Logo
          {
            type: 'img',
            props: {
              src: logoDataUri,
              width: 140,
              height: 48,
              style: { objectFit: 'contain' },
            },
          },
          // Middle: Breadcrumb + Title + Description
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              },
              children: [
                breadcrumb
                  ? {
                      type: 'div',
                      props: {
                        style: {
                          color: '#0066ff',
                          fontSize: '20px',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                        },
                        children: breadcrumb,
                      },
                    }
                  : null,
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#ffffff',
                      fontSize: `${titleFontSize}px`,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      maxWidth: '900px',
                    },
                    children: title,
                  },
                },
                displayDescription
                  ? {
                      type: 'div',
                      props: {
                        style: {
                          color: '#9ca3af',
                          fontSize: '22px',
                          fontWeight: 400,
                          lineHeight: 1.4,
                          maxWidth: '900px',
                        },
                        children: displayDescription,
                      },
                    }
                  : null,
              ].filter(Boolean),
            },
          },
          // Bottom spacer to keep middle content centered
          {
            type: 'div',
            props: {
              style: { display: 'flex' },
              children: [],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: interSemiBold, weight: 600, style: 'normal' },
        { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
      ],
    },
  );

  // Render at 2x for sharper text on retina displays and social media
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 2400 },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
