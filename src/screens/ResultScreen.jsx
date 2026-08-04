import { useEffect, useMemo, useRef } from 'react';
import PixelAvatar from '../components/PixelAvatar.jsx';
import MuteButton from '../components/MuteButton.jsx';
import { drawTrophy } from '../game/sprites.js';
import { getPlayerById } from '../game/players.js';
import { FORMATS } from '../game/constants.js';
import { upper } from '../utils/text.js';

const CONFETTI_COLORS = ['#E30A17', '#FFFFFF', '#FFD24A', '#FF7A18', '#9BE7FF'];

/**
 * Maç sonu ekranı — kupa, konfeti ve Filenin Sultanları'na
 * onurlandırma mesajı.
 */
export default function ResultScreen({
  result,
  brokenRecords,
  onRematch,
  onHome,
  muted,
  onToggleMute,
}) {
  const won = result.winner === 'home';
  const formatLabel = FORMATS[result.format]?.label ?? result.format ?? 'KLASİK';
  const practice = result.format === 'practice';

  const squad = useMemo(
    () => result.homeIds.map((id) => getPlayerById(id)).filter(Boolean),
    [result.homeIds]
  );

  const newRecords = useMemo(() => {
    if (!brokenRecords) return [];
    const labels = [];
    if (brokenRecords.firstWin) labels.push('İLK GALİBİYET');
    if (brokenRecords.bestWinStreak) labels.push('YENİ GALİBİYET SERİSİ');
    if (brokenRecords.longestRally) labels.push('EN UZUN RALLİ');
    if (brokenRecords.mostSpikes) labels.push('EN ÇOK SMAÇ');
    if (brokenRecords.mostBlocks) labels.push('EN ÇOK BLOK');
    if (brokenRecords.mostSaves) labels.push('EN ÇOK KURTARIŞ');
    if (brokenRecords.bestCombo) labels.push('EN İYİ KOMBO');
    return labels;
  }, [brokenRecords]);

  // Konfeti parçaları — yalnızca zaferde
  const confetti = useMemo(() => {
    if (!won) return [];
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3.5,
      duration: 2.8 + Math.random() * 2.6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: 6 + Math.random() * 7,
      height: 10 + Math.random() * 9,
    }));
  }, [won]);

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center gap-7 overflow-hidden px-4 py-10">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <MuteButton muted={muted} onToggle={onToggleMute} />
      </div>

      {/* Konfeti katmanı */}
      {won && (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={{
                left: `${piece.left}%`,
                width: `${piece.width}px`,
                height: `${piece.height}px`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-7">
        {/* Başlık */}
        <div className="text-center">
          <h2
            className={`text-2xl leading-relaxed sm:text-4xl ${
              won ? 'text-retro-accent text-outline-red' : 'text-white/80'
            }`}
          >
            {won ? 'ŞAMPİYON!' : 'MAÇ BİTTİ'}
          </h2>
          <p className="mt-3 text-[9px] text-white/55">
            {won
              ? 'FİLENİN SULTANLARI KAZANDI'
              : `${result.opponent?.name ?? 'RAKİP'} BU MAÇI ALDI`}
          </p>
          <p className="mt-2 text-[7px] tracking-widest text-white/35">
            {formatLabel}
            {result.opponent?.shortName ? ` · vs ${result.opponent.shortName}` : ''}
            {practice ? ' · REKORLARA YAZILMAZ' : ''}
          </p>
        </div>

        {/* Kupa */}
        {won && <PixelTrophy />}

        {/* Skor özeti */}
        <div className="retro-panel w-full px-5 py-5">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-[9px] text-turkiye-red">TÜRKİYE</p>
              <p className="mt-2 text-3xl text-shadow-pixel">{result.sets.home}</p>
            </div>
            <span className="text-lg text-white/30">—</span>
            <div className="text-center">
              <p className="text-[9px] text-[#9BB0FF]">
                {result.opponent?.shortName ?? 'RAKİP'}
              </p>
              <p className="mt-2 text-3xl text-shadow-pixel">{result.sets.away}</p>
            </div>
          </div>

          {/* Set skorları */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t-2 border-white/15 pt-4">
            {result.setHistory.map((set, i) => (
              <span
                key={i}
                className={`border-2 px-3 py-1 text-[7px] ${
                  set.winner === 'home'
                    ? 'border-turkiye-red text-turkiye-red'
                    : 'border-[#9BB0FF]/60 text-[#9BB0FF]'
                }`}
              >
                {i + 1}. SET {set.home}-{set.away}
              </span>
            ))}
          </div>

          {/* Maç istatistikleri */}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t-2 border-white/15 pt-4 text-center sm:grid-cols-5">
            <Stat label="SMAÇ" value={result.stats.spikes} highlight={brokenRecords?.mostSpikes} />
            <Stat label="BLOK" value={result.stats.blocks} highlight={brokenRecords?.mostBlocks} />
            <Stat label="KURTARIŞ" value={result.stats.saves} highlight={brokenRecords?.mostSaves} />
            <Stat
              label="EN UZUN RALLİ"
              value={result.stats.longestRally}
              highlight={brokenRecords?.longestRally}
            />
            <Stat
              label="EN İYİ KOMBO"
              value={result.stats.bestCombo ?? 0}
              highlight={brokenRecords?.bestCombo}
            />
          </div>
        </div>

        {/* Yeni rekorlar */}
        {newRecords.length > 0 && (
          <div className="w-full border-2 border-retro-accent/80 bg-retro-accent/10 px-4 py-3 text-center">
            <p className="text-[8px] tracking-widest text-retro-accent">★ YENİ REKOR ★</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {newRecords.map((label) => (
                <span
                  key={label}
                  className="border border-retro-accent/50 px-2 py-1 text-[7px] text-retro-accent"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sahaya çıkan kadro */}
        <div className="flex items-end justify-center gap-6">
          {squad.map((player, i) => (
            <div
              key={player.id}
              className="flex flex-col items-center gap-2"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <div className={won ? 'animate-float' : ''}>
                <PixelAvatar player={player} scale={4} pose={won ? 'cheer' : 'idle'} />
              </div>
              <span className="text-[7px] text-white/60">{upper(player.name)}</span>
            </div>
          ))}
        </div>

        {/* Onurlandırma mesajı */}
        <div className="retro-panel w-full px-5 py-5 text-center">
          <p className="mb-3 text-[8px] tracking-widest text-retro-accent">
            ★ FİLENİN SULTANLARI&apos;NA ★
          </p>
          <p className="text-[8px] leading-relaxed text-white/75 sm:text-[9px]">
            Bir topun peşinde koşarken bir milletin umudunu taşıdınız.
            <br />
            Her blokta yürek, her smaçta gurur verdiniz.
            <br />
            <span className="text-turkiye-red">Teşekkürler Sultanlar.</span>
          </p>
        </div>

        {/* Butonlar */}
        <div className="flex flex-wrap justify-center gap-4 pb-6">
          <button type="button" className="retro-button px-8 py-4" onClick={onRematch}>
            TEKRAR OYNA
          </button>
          <button type="button" className="retro-button-ghost px-8 py-4" onClick={onHome}>
            ANA MENÜ
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = false }) {
  return (
    <div>
      <p className="text-lg text-retro-accent">
        {value}
        {highlight && <span className="ml-1 text-[7px] text-turkiye-red">★</span>}
      </p>
      <p className={`mt-1 text-[7px] ${highlight ? 'text-retro-accent/80' : 'text-white/45'}`}>
        {label}
      </p>
    </div>
  );
}

/** Canvas üzerine çizilen piksel şampiyonluk kupası. */
function PixelTrophy() {
  const canvasRef = useRef(null);
  const size = 8;
  const width = size * 16;
  const height = size * 16;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    drawTrophy(ctx, width / 2, height - size * 2, size);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="pixelated animate-float"
      aria-label="Şampiyonluk kupası"
    />
  );
}
