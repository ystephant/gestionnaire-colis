import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        {/* ✅ Manifest pour PWA et OneSignal */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* ✅ Theme color pour navigateur mobile */}
        <meta name="theme-color" content="#4f46e5" />
        
        {/* ✅ Apple touch icon */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        
        {/* ✅ Favicon */}
        <link rel="icon" href="/meeple_final.png" />
        
        {/* ✅ Meta pour iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Le Petit Meeple" />
        
        {/* ✅ Meta pour Android */}
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* ✅ Meta description */}
        <meta name="description" content="Le Petit Meeeple gère ses colis!" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
