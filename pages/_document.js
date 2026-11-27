import { Html, Head, Main, NextScript } from 'next/document';

// Filet de sécurité au lancement : l'écran de chargement est animé même si le code de
// l'appli n'arrive pas. Ce script, indépendant du reste, recharge une fois puis propose « Réessayer ».
const BOOT_GUARD = `
(function () {
  var KEY = 'lpm_boot_retry';
  function tried() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return true; } }
  function show() {
    if (window.__lpmReady || document.getElementById('lpm-boot')) return;
    if (!document.body) { setTimeout(show, 200); return; }
    var box = document.createElement('div');
    box.id = 'lpm-boot';
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:24px;z-index:9999;text-align:center;color:#fff;background:#1f2937;border:1px solid #4b5563;border-radius:16px;padding:16px;font-family:sans-serif';
    box.innerHTML = '<p style="margin:0 0 12px">Le chargement prend trop de temps. Vérifiez votre connexion.</p>';
    var btn = document.createElement('button');
    btn.textContent = 'Réessayer';
    btn.style.cssText = 'background:#4f46e5;color:#fff;border:0;border-radius:12px;padding:12px 28px;font-size:16px;font-weight:bold';
    btn.onclick = function () { location.reload(); };
    box.appendChild(btn);
    document.body.appendChild(box);
  }
  function recover() {
    if (window.__lpmReady) return;
    if (!tried() && navigator.onLine !== false) {
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      location.reload();
    } else show();
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT' && t.src.indexOf('/_next/') !== -1) setTimeout(recover, 800);
  }, true);
  setTimeout(recover, 12000);
})();
`;

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_GUARD }} />
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
