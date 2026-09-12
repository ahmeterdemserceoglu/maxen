const fs = require('fs');
const path = require('path');
const { generateImageAsync } = require('@expo/image-utils');

async function buildPublicAssets() {
  const publicDir = path.resolve(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write manifest.json
  const manifest = {
    short_name: 'Maxen',
    name: 'Maxen - Film & Dizi Platformu',
    description: 'Maxen - Film ve Dizi İzleme Platformu',
    icons: [
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png'
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ],
    start_url: '/',
    background_color: '#000000',
    theme_color: '#000000',
    display: 'standalone',
    orientation: 'any',
    scope: '/'
  };

  fs.writeFileSync(
    path.join(publicDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  console.log('[build-public-assets] manifest.json created successfully');

  // 2. Generate icons from assets/images/maxen.png
  const src = path.resolve(__dirname, '..', 'assets', 'images', 'maxen.png');
  const projectRoot = path.resolve(__dirname, '..');

  const iconConfigs = [
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'favicon.png', size: 64 },
  ];

  for (const cfg of iconConfigs) {
    const res = await generateImageAsync(
      { projectRoot },
      {
        src,
        width: cfg.size,
        height: cfg.size,
        resizeMode: 'contain',
        backgroundColor: '#000000'
      }
    );
    fs.writeFileSync(path.join(publicDir, cfg.name), res.source);
    console.log(`[build-public-assets] ${cfg.name} (${cfg.size}x${cfg.size}) created: ${res.source.length} bytes`);
  }
}

buildPublicAssets().catch(err => {
  console.error('[build-public-assets] Error:', err);
  process.exit(1);
});
