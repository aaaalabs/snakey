import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0a1a"/>
          <stop offset="100%" style="stop-color:#1a0a2e"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <text x="600" y="280" font-family="monospace" font-size="80" fill="#00f0f0" text-anchor="middle" font-weight="bold">SNAKEY</text>
      <text x="600" y="350" font-family="monospace" font-size="32" fill="#ff00aa" text-anchor="middle">Snake Battle Arena</text>
      <text x="600" y="420" font-family="monospace" font-size="22" fill="#666" text-anchor="middle">Competitive 1v1 Snake. No download needed.</text>
      <!-- Snake body illustration -->
      <rect x="300" y="470" width="20" height="20" fill="#00f0f0" rx="2"/>
      <rect x="320" y="470" width="20" height="20" fill="#00f0f0" rx="2" opacity="0.9"/>
      <rect x="340" y="470" width="20" height="20" fill="#00f0f0" rx="2" opacity="0.8"/>
      <rect x="360" y="470" width="20" height="20" fill="#00f0f0" rx="2" opacity="0.7"/>
      <rect x="380" y="470" width="20" height="20" fill="#00f0f0" rx="2" opacity="0.6"/>
      <text x="420" y="487" font-family="monospace" font-size="18" fill="#444">vs</text>
      <rect x="460" y="470" width="20" height="20" fill="#ff00aa" rx="2" opacity="0.6"/>
      <rect x="480" y="470" width="20" height="20" fill="#ff00aa" rx="2" opacity="0.7"/>
      <rect x="500" y="470" width="20" height="20" fill="#ff00aa" rx="2" opacity="0.8"/>
      <rect x="520" y="470" width="20" height="20" fill="#ff00aa" rx="2" opacity="0.9"/>
      <rect x="540" y="470" width="20" height="20" fill="#ff00aa" rx="2"/>
    </svg>
  `;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(svg);
}
