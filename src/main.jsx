import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { createAppIconDataUrl, createFaviconDataUrl } from './game/sprites.js';
import './index.css';

/**
 * Sekme simgesi + PWA / Apple dokunmatik ikonları — çalışma anında canvas'tan.
 * Repoda PNG tutulmaz.
 */
function installIcons() {
  try {
    const favicon = createFaviconDataUrl();
    if (favicon) {
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.type = 'image/png';
      link.href = favicon;
    }

    const icon180 = createAppIconDataUrl(180);
    if (icon180) {
      let apple = document.querySelector("link[rel='apple-touch-icon']");
      if (!apple) {
        apple = document.createElement('link');
        apple.rel = 'apple-touch-icon';
        document.head.appendChild(apple);
      }
      apple.href = icon180;
    }

    const icon192 = createAppIconDataUrl(192);
    const icon512 = createAppIconDataUrl(512);
    if (icon192 && icon512) {
      // start_url ve scope MUTLAK olmalı: manifest blob: URL'den
      // servis edildiği için göreli '/' değerleri blob adresine göre
      // çözülüyor ve geçersiz sayılıyordu. Chrome bunları yok sayınca
      // uygulama kurulabilir olmaktan çıkıyor ("ana ekrana ekle"
      // düzgün çalışmıyor).
      const origin = window.location.origin;

      const manifest = {
        name: 'Filenin Sultanları',
        short_name: 'Sultanlar',
        description: "Filenin Sultanları'na adanmış retro piksel voleybol oyunu.",
        start_url: `${origin}/`,
        scope: `${origin}/`,
        display: 'standalone',
        background_color: '#0b0b12',
        theme_color: '#E30A17',
        lang: 'tr',
        // Saha 9:5 — dikeyde oynanmıyor. Ana ekrana eklenen kısayol
        // doğrudan yatay açılsın; tarayıcıda ise RotateGate devreye girer.
        orientation: 'landscape',
        categories: ['games', 'sports'],
        icons: [
          { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      };

      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
      const url = URL.createObjectURL(blob);
      let manifestLink = document.querySelector("link[rel='manifest']");
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = url;
    }
  } catch {
    // İkonlar kritik değil
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW opsiyonel — sessizce geç
    });
  });
}

installIcons();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
