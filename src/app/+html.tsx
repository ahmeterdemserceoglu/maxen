import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Bu dosya statik web derlemesi sırasında sayfa kök HTML kabuğunu oluşturur.
 * iPhone Safari "Ana Ekrana Ekle", tam ekran standalone mod ve Dynamic Island / çentik
 * uyumluluğu için gerekli meta etiketleri ve stilleri barındırır.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.00001, viewport-fit=cover, user-scalable=no"
        />

        {/* Birincil Meta Etiketleri */}
        <title>Maxen</title>
        <meta name="title" content="Maxen - Film & Dizi Platformu" />
        <meta name="description" content="Maxen - Film ve Dizi İzleme Platformu" />
        <meta name="theme-color" content="#000000" />

        {/* iPhone (iOS Safari) Ana Ekrana Ekleme & Standalone App Etiketleri */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Maxen" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* PWA & Evrensel Web Manifesti */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Maxen" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />

        {/* React Native Web ScrollView sıfırlayıcısı */}
        <ScrollViewStyleReset />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                background-color: #000000 !important;
                margin: 0;
                padding: 0;
                overflow-x: hidden;
                -webkit-font-smoothing: antialiased;
                -webkit-tap-highlight-color: transparent;
              }
              body {
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
                padding-left: env(safe-area-inset-left);
                padding-right: env(safe-area-inset-right);
              }
              ::-webkit-scrollbar {
                width: 6px;
                height: 6px;
              }
              ::-webkit-scrollbar-track {
                background: #09090b;
              }
              ::-webkit-scrollbar-thumb {
                background: #27272a;
                border-radius: 4px;
              }
              ::-webkit-scrollbar-thumb:hover {
                background: #e50914;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
