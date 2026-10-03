import { svgElement } from './dom';

/**
 * The toolbar's icons, inlined.
 *
 * They were `lucide-react` components in the template this came from. A package
 * that mounts itself into a bare DOM cannot pull in a React icon library for
 * seven glyphs, so the node data is inlined instead and drawn with the same
 * default attributes lucide applies.
 *
 * Paths from Lucide (https://lucide.dev), ISC licensed:
 *
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as
 *   part of Feather (MIT). All other copyright (c) for Lucide are held by
 *   Lucide Contributors 2022.
 */
const LUCIDE_ATTRS: Record<string, string> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

type IconNode = Array<[string, Record<string, string>]>;

const ICONS = {
  database: [
    ['ellipse', { cx: '12', cy: '5', rx: '9', ry: '3' }],
    ['path', { d: 'M3 5V19A9 3 0 0 0 21 19V5' }],
    ['path', { d: 'M3 12A9 3 0 0 0 21 12' }],
  ],
  mail: [
    ['rect', { width: '20', height: '16', x: '2', y: '4', rx: '2' }],
    ['path', { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' }],
  ],
  settings: [
    [
      'path',
      {
        d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
      },
    ],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],
  x: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }],
  ],
  moon: [['path', { d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' }]],
  sun: [
    ['circle', { cx: '12', cy: '12', r: '4' }],
    ['path', { d: 'M12 2v2' }],
    ['path', { d: 'M12 20v2' }],
    ['path', { d: 'm4.93 4.93 1.41 1.41' }],
    ['path', { d: 'm17.66 17.66 1.41 1.41' }],
    ['path', { d: 'M2 12h2' }],
    ['path', { d: 'M20 12h2' }],
    ['path', { d: 'm6.34 17.66-1.41 1.41' }],
    ['path', { d: 'm19.07 4.93-1.41 1.41' }],
  ],
  'eye-off': [
    [
      'path',
      {
        d: 'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49',
      },
    ],
    ['path', { d: 'M14.084 14.158a3 3 0 0 1-4.242-4.242' }],
    [
      'path',
      {
        d: 'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143',
      },
    ],
    ['path', { d: 'm2 2 20 20' }],
  ],
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

// Icons are decorative: every control that carries one also carries an
// aria-label, so announcing the glyph too would only repeat it.
export function icon(name: IconName, size: number): SVGElement {
  const svg = svgElement('svg', {
    ...LUCIDE_ATTRS,
    width: String(size),
    height: String(size),
    'aria-hidden': 'true',
  });
  for (const [tag, attributes] of ICONS[name]) {
    svg.appendChild(svgElement(tag, attributes));
  }
  return svg;
}

// The Nhost brand mark (the folded "N" ribbon), lifted from the dashboard's
// footer logo. Uses currentColor so it follows whatever theme it sits in.
export function nhostLogo(width: number, height: number): SVGElement {
  const svg = svgElement('svg', {
    viewBox: '0 0 44.9165 47.8906',
    width: String(width),
    height: String(height),
    fill: 'currentColor',
    'aria-hidden': 'true',
  });
  svg.appendChild(
    svgElement('path', {
      d: 'M40.724 10.2866L24.0304 0.647089C22.5327 -0.215696 20.6734 -0.215696 19.1727 0.647089C17.6749 1.51291 16.7453 3.12304 16.7453 4.85165V6.10937L15.6577 5.48051C14.16 4.61772 12.3008 4.61772 10.8 5.48051C9.30228 6.34633 8.37266 7.95646 8.37266 9.6881V10.9458L7.28506 10.317C5.78734 9.45418 3.9281 9.45418 2.42734 10.317C0.929617 11.1828 0 12.7929 0 14.5246V44.7281C0 45.597 0.504301 46.4051 1.2881 46.7818C2.06886 47.1615 3.01671 47.0582 3.69722 46.5205L11.9757 39.9919L24.7413 47.362C25.0937 47.5656 25.4886 47.6658 25.8835 47.6658C26.2785 47.6658 26.6734 47.5625 27.0258 47.362C27.7306 46.9549 28.1681 46.1985 28.1681 45.3843V27.2081C28.1681 24.2248 26.5641 21.4481 23.9818 19.9565L19.7954 17.5382V4.85468C19.7954 4.21063 20.1418 3.60911 20.7008 3.28709C21.2597 2.96506 21.9524 2.96506 22.5114 3.28709L39.2051 12.9235C40.8486 13.8714 41.8694 15.6425 41.8694 17.5382V40.1711C41.8694 40.8152 41.523 41.4167 40.964 41.7387L36.5408 44.2937V22.3716C36.5408 19.3884 34.9367 16.6116 32.3544 15.12L22.077 9.18684V12.7018L30.8324 17.757C32.4759 18.7048 33.4967 20.4729 33.4967 22.3716V45.6091C33.4967 46.4203 33.9342 47.1797 34.639 47.5868C34.9914 47.7904 35.3863 47.8906 35.7813 47.8906C36.1762 47.8906 36.5711 47.7873 36.9235 47.5868L42.4891 44.3727C43.9868 43.5068 44.9165 41.8967 44.9165 40.1651V17.5322C44.9104 14.558 43.3063 11.7782 40.724 10.2866ZM22.4537 22.5934C24.0972 23.5413 25.118 25.3094 25.118 27.2081V44.0689L14.5458 37.9656L17.9392 35.2921C19.1149 34.3656 19.7894 32.9772 19.7894 31.4795V21.0592L22.4537 22.5934ZM16.7453 19.2972V31.4734C16.7453 32.0324 16.4932 32.5519 16.0557 32.8952L3.04405 43.1544V14.5215C3.04405 13.8775 3.39038 13.2759 3.94937 12.9539C4.50835 12.6319 5.20101 12.6319 5.76 12.9539L8.37266 14.4608V36.0456L11.4167 33.6456V9.6881C11.4167 9.04405 11.763 8.44253 12.322 8.12051C12.881 7.79848 13.5737 7.79848 14.1327 8.12051L16.7453 9.62734V15.7792L13.7013 14.0203V17.5382L16.7453 19.2972Z',
    }),
  );
  return svg;
}
