import { useEffect, useMemo, useState } from 'react';
import PixelAvatar from '../components/PixelAvatar.jsx';
import { ROSTER } from '../game/players.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

/** Gurur Tablosu — dönüşümlü onur mesajları. */
const PRIDE_MESSAGES = [
  'BİR MİLLETİN GURURU, BİR FİLENİN SULTANLARI',
  'SAHADA YÜREK, FİLEDE ZAFER',
  'KIRMIZI BEYAZ, DÜNYANIN ZİRVESİNDE',
  'HER SMAÇTA BİR MİLLETİN ALKIŞI',
];

export default function StartScreen({ onStart, muted, onToggleMute }) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Öne çıkan üç sultan — giriş ekranı vitrini
  const showcase = useMemo(
    () => ['eda-erdem', 'melissa-vargas', 'ebrar-karakurt'].map((id) => ROSTER.find((p) => p.id === id)),
    []
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % PRIDE_MESSAGES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const handleStart = () => {
    // Tarayıcı ses politikası: AudioContext ilk kullanıcı hareketinde açılır
    Sfx.unlock();
    Sfx.confirm();
    onStart();
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 px-4 py-10">
      {/* Başlık */}
      <div className="text-center">
        <p className="mb-3 text-[9px] tracking-[0.35em] text-white/50">RETRO VOLLEYBALL</p>
        <h1 className="text-2xl leading-relaxed text-turkiye-red text-outline-red sm:text-4xl md:text-5xl">
          FİLENİN
          <br />
          SULTANLARI
        </h1>
        <div className="mx-auto mt-5 h-1 w-40 bg-white/80" />
      </div>

      {/* Gurur Tablosu */}
      <div className="retro-panel w-full max-w-xl px-5 py-4 text-center">
        <p className="mb-2 text-[8px] tracking-widest text-retro-accent">★ GURUR TABLOSU ★</p>
        <p
          key={messageIndex}
          className="text-[9px] leading-relaxed text-white/85 sm:text-[11px]"
        >
          {PRIDE_MESSAGES[messageIndex]}
        </p>
      </div>

      {/* Vitrin */}
      <div className="flex items-end justify-center gap-5 sm:gap-10">
        {showcase.map((player, i) => (
          <div
            key={player.id}
            className="flex flex-col items-center gap-2 animate-float"
            style={{ animationDelay: `${i * 0.35}s` }}
          >
            <PixelAvatar player={player} scale={4} pose={i === 1 ? 'cheer' : 'idle'} />
            <span className="text-[7px] text-white/60">{upper(player.name)}</span>
          </div>
        ))}
      </div>

      {/* Başla */}
      <div className="flex flex-col items-center gap-4">
        <button type="button" className="retro-button px-10 py-4 text-sm" onClick={handleStart}>
          BAŞLA
        </button>
        <p className="animate-blink text-[8px] text-white/50">DEVAM ETMEK İÇİN BAŞLA'YA BAS</p>
      </div>

      {/* Kontroller özeti + ses */}
      <div className="flex flex-col items-center gap-4">
        <div className="retro-panel px-4 py-3">
          <p className="mb-2 text-center text-[8px] text-white/50">KONTROLLER</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[7px] text-white/70 sm:grid-cols-4">
            <span>← → / A D · HAREKET</span>
            <span>↑ / W · ZIPLA</span>
            <span>BOŞLUK / Z · VUR</span>
            <span className="text-retro-accent">X · SULTAN GÜCÜ</span>
          </div>
        </div>

        <button
          type="button"
          className="retro-button-ghost px-4 py-2 text-[8px]"
          onClick={() => {
            Sfx.unlock();
            onToggleMute();
          }}
        >
          SES: {muted ? 'KAPALI' : 'AÇIK'}
        </button>
      </div>

      <footer className="max-w-md text-center text-[7px] leading-relaxed text-white/30">
        Türkiye Kadın Millî Voleybol Takımı'na saygıyla yapılmış, ticari olmayan
        bir hayran projesidir.
      </footer>
    </div>
  );
}
