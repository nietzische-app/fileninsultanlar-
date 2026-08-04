import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { createFaviconDataUrl } from './game/sprites.js';
import './index.css';

/**
 * Sekme simgesini çalışma anında canvas'tan üret.
 *
 * Projede hiçbir görsel dosyası tutulmaz (PNG/JPG/SVG yok); favicon da
 * oyundaki voleybol topunun aynı piksel çizimidir.
 */
function installFavicon() {
  try {
    const href = createFaviconDataUrl();
    if (!href) return;

    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = href;
  } catch {
    // Favicon kritik değil — üretilemezse sessizce geç
  }
}

installFavicon();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
