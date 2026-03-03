import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const assetsDir = join(process.cwd(), 'src', 'assets');

const interRegular = readFileSync(
  join(assetsDir, 'fonts', 'Inter-Regular.ttf'),
);
const interSemiBold = readFileSync(
  join(assetsDir, 'fonts', 'Inter-SemiBold.ttf'),
);
const interBold = readFileSync(join(assetsDir, 'fonts', 'Inter-Bold.ttf'));

const logoSvg = readFileSync(join(assetsDir, 'logo', 'dark.svg'), 'utf-8');
const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

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
  let titleFontSize = 58;
  if (titleLength > 60) {
    titleFontSize = 40;
  } else if (titleLength > 40) {
    titleFontSize = 48;
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
              width: 180,
              height: 62,
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
                          fontSize: '28px',
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
                          fontSize: '28px',
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
