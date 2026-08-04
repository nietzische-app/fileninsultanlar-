import { useEffect, useMemo, useState } from 'react';
import PixelAvatar from '../components/PixelAvatar.jsx';
import MuteButton from '../components/MuteButton.jsx';
import { ROSTER, SHOWCASE_IDS } from '../game/players.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

/** Gurur Tablosu — dönüşümlü onur mesajları (henüz maç yokken). */
const PRIDE_MESSAGES = [
  'BİR MİLLETİN GURURU, BİR FİLENİN SULTANLARI',
  'SAHADA YÜREK, FİLEDE ZAFER',
  'KIRMIZI BEYAZ, DÜNYANIN ZİRVESİNDE',
  'HER SMAÇTA BİR MİLLETİN ALKIŞI',
];

export default function StartScreen({ onStart, onTutorial, muted, onToggleMute, records }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const hasRecords = (records?.matchesPlayed ?? 0) > 0;

  // Öne çıkan üç sultan — giriş ekranı vitrini
  const showcase = useMemo(
    () => SHOWCASE_IDS.map((id) => ROSTER.find((p) => p.id === id)).filter(Boolean),
    []
  );

  useEffect(() => {
    if (hasRecords) return undefined;
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % PRIDE_MESSAGES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [hasRecords]);

  const launch = (playMode) => {
    Sfx.unlock();
    Sfx.confirm();
    onStart(playMode);
  };

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center gap-6 px-4 py-8 sm:gap-8 sm:py-10">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <MuteButton muted={muted} onToggle={onToggleMute} />
      </div>

      {/* Başlık */}
      <div className="text-center">
        <p className="mb-2 text-[8px] tracking-[0.35em] text-white/50 sm:mb-3 sm:text-[9px]">
          RETRO VOLLEYBALL
        </p>
        <h1 className="text-2xl leading-relaxed text-turkiye-red text-outline-red sm:text-4xl md:text-5xl">
          FİLENİN
          <br />
          SULTANLARI
        </h1>
        <div className="mx-auto mt-4 h-1 w-32 bg-white/80 sm:mt-5 sm:w-40" />
      </div>

      {/* Gurur Tablosu — yerel rekorlar veya onur mesajı */}
      <div className="retro-panel w-full max-w-xl px-5 py-4 text-center">
        <p className="mb-3 text-[8px] tracking-widest text-retro-accent">★ GURUR TABLOSU ★</p>
        {hasRecords ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <RecordStat label="GALİBİYET" value={records.wins} />
            <RecordStat label="SERİ" value={records.winStreak} />
            <RecordStat label="EN İYİ SERİ" value={records.bestWinStreak} />
            <RecordStat label="EN UZUN RALLİ" value={records.longestRally} />
            <RecordStat label="EN İYİ KOMBO" value={records.bestCombo ?? 0} />
          </div>
        ) : (
          <p
            key={messageIndex}
            className="text-[9px] leading-relaxed text-white/85 sm:text-[11px]"
          >
            {PRIDE_MESSAGES[messageIndex]}
          </p>
        )}
      </div>

      {/* Vitrin */}
      <div className="flex items-end justify-center gap-5 sm:gap-10">
        {showcase.map((player, i) => (
          <div
            key={player.id}
            className="flex flex-col items-center gap-2 animate-float"
            style={{ animationDelay: `${i * 0.35}s` }}
          >
            <PixelAvatar player={player} scale={4} pose={i === 0 ? 'cheer' : 'idle'} />
            <span className="text-[7px] text-white/60">{upper(player.name)}</span>
            {player.captain && (
              <span className="text-[6px] text-retro-accent">★ KAPTAN</span>
            )}
          </div>
        ))}
      </div>

      {/* Mod seçimi */}
      <div className="flex w-full max-w-lg flex-col items-center gap-3">
        <button
          type="button"
          className="retro-button w-full max-w-md px-8 py-4 text-sm"
          onClick={() => launch('solo')}
        >
          SOLO
        </button>
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          <button
            type="button"
            className="retro-button-ghost px-4 py-3 text-[9px]"
            onClick={() => launch('coop')}
          >
            CO-OP
            <span className="mt-1 block text-[6px] text-white/45">TAKIM · 2P</span>
          </button>
          <button
            type="button"
            className="retro-button-ghost px-4 py-3 text-[9px]"
            onClick={() => launch('vs')}
          >
            VS
            <span className="mt-1 block text-[6px] text-white/45">KARŞILIKLI · 2P</span>
          </button>
        </div>
        <button
          type="button"
          className="retro-button-ghost px-5 py-2 text-[8px]"
          onClick={onTutorial}
        >
          NASIL OYNANIR
        </button>
      </div>

      {/* Kontroller özeti */}
      <div className="retro-panel px-4 py-3">
        <p className="mb-2 text-center text-[8px] text-white/50">KONTROLLER</p>
        <div className="grid grid-cols-1 gap-y-2 text-[7px] text-white/70 sm:grid-cols-2">
          <span className="text-turkiye-red">P1 · WASD + SPACE (+ S DAL)</span>
          <span className="text-[#9BB0FF]">P2 · OKLAR + ENTER (+ ↓ DAL)</span>
          <span>X / CTRL · SULTAN GÜCÜ</span>
          <span>ESC / P · DURAKLAT</span>
        </div>
      </div>

      <footer className="max-w-md text-center text-[7px] leading-relaxed text-white/30">
        Türkiye Kadın Millî Voleybol Takımı&apos;na saygıyla yapılmış, ticari olmayan
        bir hayran projesidir.
      </footer>
    </div>
  );
}

function RecordStat({ label, value }) {
  return (
    <div>
      <p className="text-lg text-retro-accent text-shadow-pixel">{value}</p>
      <p className="mt-1 text-[6px] text-white/45">{label}</p>
    </div>
  );
}
