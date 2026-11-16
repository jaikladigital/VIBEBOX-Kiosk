const svgToDataUri = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;

export const DEFAULT_FRAME_MODERN_BLUE = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800" fill="none">
  <rect x="24" y="24" width="1152" height="1752" rx="36" stroke="#3B82F6" stroke-width="16"/>
  <rect x="44" y="44" width="1112" height="1712" rx="24" stroke="#93C5FD" stroke-width="3" stroke-dasharray="14 10" opacity="0.7"/>
  <path d="M24 140 V60 A36 36 0 0 1 60 24 H140" stroke="#60A5FA" stroke-width="24" stroke-linecap="round"/>
  <path d="M1060 24 H1140 A36 36 0 0 1 1176 60 V140" stroke="#60A5FA" stroke-width="24" stroke-linecap="round"/>
  <path d="M24 1660 V1740 A36 36 0 0 0 60 1776 H140" stroke="#60A5FA" stroke-width="24" stroke-linecap="round"/>
  <path d="M1060 1776 H1140 A36 36 0 0 0 1176 1740 V1660" stroke="#60A5FA" stroke-width="24" stroke-linecap="round"/>
</svg>
`);

export const DEFAULT_FRAME_EMERALD_GOLD = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800" fill="none">
  <rect x="28" y="28" width="1144" height="1744" rx="28" stroke="#10B981" stroke-width="14"/>
  <rect x="48" y="48" width="1104" height="1704" rx="18" stroke="#F59E0B" stroke-width="4" opacity="0.85"/>
  <circle cx="80" cy="80" r="14" fill="#F59E0B"/>
  <circle cx="1120" cy="80" r="14" fill="#F59E0B"/>
  <circle cx="80" cy="1720" r="14" fill="#F59E0B"/>
  <circle cx="1120" cy="1720" r="14" fill="#F59E0B"/>
</svg>
`);

export const DEFAULT_SPONSOR_1 = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" fill="none">
  <rect x="2" y="2" width="316" height="96" rx="14" fill="#0F172A" stroke="#334155" stroke-width="3"/>
  <circle cx="52" cy="50" r="22" fill="#3B82F6"/>
  <path d="M44 50 L50 56 L62 44" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="92" y="46" fill="#F8FAFC" font-family="sans-serif" font-size="20" font-weight="800" letter-spacing="2">EVENT</text>
  <text x="92" y="70" fill="#94A3B8" font-family="sans-serif" font-size="14" font-weight="600" letter-spacing="3">PARTNER 01</text>
</svg>
`);

export const DEFAULT_SPONSOR_2 = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" fill="none">
  <rect x="2" y="2" width="316" height="96" rx="14" fill="#0F172A" stroke="#334155" stroke-width="3"/>
  <rect x="30" y="28" width="44" height="44" rx="10" fill="#10B981"/>
  <circle cx="52" cy="50" r="10" fill="#FFFFFF"/>
  <text x="92" y="46" fill="#F8FAFC" font-family="sans-serif" font-size="20" font-weight="800" letter-spacing="2">STUDIO</text>
  <text x="92" y="70" fill="#94A3B8" font-family="sans-serif" font-size="14" font-weight="600" letter-spacing="3">PARTNER 02</text>
</svg>
`);

export const DEFAULT_GAME_PLAYER = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
  <circle cx="100" cy="105" r="76" fill="#1E293B" stroke="#38BDF8" stroke-width="10"/>
  <path d="M46 65 L62 24 L92 50 Z" fill="#38BDF8"/>
  <path d="M154 65 L138 24 L108 50 Z" fill="#38BDF8"/>
  <circle cx="76" cy="98" r="10" fill="#FFFFFF"/>
  <circle cx="124" cy="98" r="10" fill="#FFFFFF"/>
  <path d="M82 126 Q100 142 118 126" stroke="#10B981" stroke-width="8" stroke-linecap="round"/>
</svg>
`);

export const DEFAULT_GOOD_ITEM = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" fill="none">
  <circle cx="75" cy="75" r="60" fill="#F59E0B" stroke="#FEF3C7" stroke-width="8"/>
  <path d="M75 34 L86 58 L112 62 L93 80 L98 106 L75 93 L52 106 L57 80 L38 62 L64 58 Z" fill="#FFFFFF"/>
</svg>
`);

export const DEFAULT_BAD_ITEM = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" fill="none">
  <circle cx="75" cy="82" r="52" fill="#DC2626" stroke="#FCA5A5" stroke-width="7"/>
  <path d="M75 30 V16" stroke="#FCD34D" stroke-width="8" stroke-linecap="round"/>
  <circle cx="75" cy="14" r="7" fill="#F59E0B"/>
  <path d="M55 64 L95 104 M95 64 L55 104" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
</svg>
`);
