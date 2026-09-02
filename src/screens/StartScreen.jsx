import { useEffect, useMemo, useState } from 'react';
import teamBackdrop from '../assets/takim-arkaplan.webp';
import menuMusic from '../assets/giris-muzigi.mp3';
import PixelAvatar from '../components/PixelAvatar.jsx';
import MuteButton from '../components/MuteButton.jsx';
import MusicVolume from '../components/MusicVolume.jsx';
import { ROSTER, SHOWCASE_IDS } from '../game/players.js';
import { GAME_MODES } from '../game/modes.js';
import AchievementGrid from '../components/AchievementGrid.jsx';
import { ACHIEVEMENTS } from '../game/achievements.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

/** Gurur Tablosu — dönüşümlü onur mesajları (henüz maç yokken). */
const PRIDE_MESSAGES = [
  'BİR MİLLETİN GURURU, BİR FİLENİN SULTANLARI',
  'SAHADA YÜREK, FİLEDE ZAFER',
  'KIRMIZI BEYAZ, DÜNYANIN ZİRVESİNDE',
  'HER SMAÇTA BİR MİLLETİN ALKIŞI',
];

export default function StartScreen({
  onStart,
  onTutorial,
  muted,
  onToggleMute,
  records,
  resumeTournament = null,
  onResumeTournament,
  achievements = [],
  musicVolume = 0.55,
  onMusicVolume,
  onSettings,
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const hasRecords = (records?.matchesPlayed ?? 0) > 0;
  const hasSurvivalRecord = (records?.bestSurvivalPoints ?? 0) > 0;

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

  /*
   * Giriş müziği.
   *
   * Tarayıcı otomatik oynatmayı kullanıcı hareketi olmadan engelliyor,
   * o yüzden iki yol var: bağlam zaten açıksa (maçtan menüye dönüş)
   * doğrudan başlar; ilk ziyarette pencereye düşen ilk tıklama ya da
   * tuş müziği açar. Dosya indirmesi hareketi beklemez — hareket
   * geldiğinde çalmaya hazır olsun diye hemen başlar.
   */
  useEffect(() => {
    Sfx.fetchMusic(menuMusic);
    Sfx.startMusic(menuMusic);

    const kick = () => {
      Sfx.unlock();
      Sfx.startMusic(menuMusic);
    };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);

    // MatchScreen'deki ile aynı kolaylık: Web Audio hataları sessizce
    // yutulduğu için motoru dışarıdan görebilmek gerekiyor.
    if (import.meta.env.DEV) window.__sfx = Sfx;

    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
      Sfx.stopMusic();
    };
  }, []);

  const handleStart = (modeId) => {
    // Tarayıcı ses politikası: AudioContext ilk kullanıcı hareketinde açılır
    Sfx.unlock();
    Sfx.confirm();
    onStart(modeId);
  };

  return (
    <div className="relative isolate flex min-h-full flex-col items-center justify-center gap-6 px-4 py-8 sm:gap-8 sm:py-10">
      <TeamBackdrop />

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
        <MusicVolume value={musicVolume} onChange={onMusicVolume} muted={muted} />
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
        {hasRecords || hasSurvivalRecord ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <RecordStat label="GALİBİYET" value={records.wins} />
            <RecordStat label="EN İYİ SERİ" value={records.bestWinStreak} />
            <RecordStat label="KUPA" value={records.tournamentsWon ?? 0} />
            <RecordStat
              label="HAYATTA KALMA"
              value={records.bestSurvivalPoints ?? 0}
            />
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

      {/* Rozetler — bir tanesi bile açıldıysa göster */}
      {achievements.length > 0 && (
        <div className="retro-panel w-full max-w-xl px-5 py-4">
          <p className="mb-3 text-center text-[8px] tracking-widest text-retro-accent">
            ★ ROZETLER · {achievements.length}/{ACHIEVEMENTS.length} ★
          </p>
          <AchievementGrid unlocked={achievements} />
        </div>
      )}

      {/* Vitrin */}
      <div className="flex items-end justify-center gap-5 sm:gap-10">
        {showcase.map((player, i) => (
          <div
            key={player.id}
            className="flex flex-col items-center gap-2 animate-float"
            style={{ animationDelay: `${i * 0.35}s` }}
          >
            <PixelAvatar player={player} scale={4} pose={i === 0 ? 'cheer' : 'idle'} />
            <span className="text-[7px] text-white/75 text-shadow-pixel">{upper(player.name)}</span>
            {player.captain && (
              <span className="text-[6px] text-retro-accent text-shadow-pixel">★ KAPTAN</span>
            )}
          </div>
        ))}
      </div>

      {/* Yarım kalan turnuva — varsa her şeyin üstünde */}
      {resumeTournament && (
        <button
          type="button"
          className="retro-button w-full max-w-xl px-6 py-3 text-[9px]"
          onClick={() => {
            Sfx.unlock();
            Sfx.confirm();
            onResumeTournament?.();
          }}
        >
          ★ TURNUVAYA DEVAM ET · {resumeTournament.roundIndex + 1}. TUR ★
        </button>
      )}

      {/* Mod seçimi */}
      <div className="flex w-full max-w-xl flex-col gap-3">
        {GAME_MODES.map((mode, i) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => handleStart(mode.id)}
            /*
             * `backdrop-blur`: arka plan fotoğrafı düğmelerin altından
             * geçiyor; bulanıklık olmadan kalabalık kare açıklama
             * metnini yutuyordu. Opaklık yerine bulanıklık, fotoğrafın
             * varlığını koruyup okunurluğu geri getiriyor.
             */
            className={`group flex w-full items-center gap-3 border-4 px-4 py-3 text-left backdrop-blur-[3px] transition ${
              i === 0
                ? 'border-turkiye-red bg-turkiye-red/30 hover:bg-turkiye-red/40'
                : 'border-white/20 bg-retro-panel/75 hover:border-white/55'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-white sm:text-xs">{mode.label}</p>
              <p className="mt-1.5 text-[7px] leading-relaxed text-white/55">
                {mode.description}
              </p>
            </div>
            <span className="shrink-0 border-2 border-white/25 px-2 py-1 text-[6px] text-retro-accent">
              {mode.tagline}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="retro-button-ghost px-5 py-2 text-[8px]"
            onClick={onTutorial}
          >
            NASIL OYNANIR
          </button>
          <button
            type="button"
            className="retro-button-ghost px-5 py-2 text-[8px]"
            onClick={onSettings}
          >
            ⚙ AYARLAR
          </button>
        </div>
        <p className="animate-blink text-[8px] text-white/50">BİR MOD SEÇ</p>
      </div>

      {/* Kontroller özeti */}
      <div className="retro-panel px-4 py-3">
        <p className="mb-2 text-center text-[8px] text-white/50">KONTROLLER</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[7px] text-white/70 sm:grid-cols-3">
          <span>← → / A D · HAREKET</span>
          <span>↑ / W · ZIPLA</span>
          <span>BOŞLUK / Z · VUR</span>
          <span className="text-[#9BE7FF]">↓ / S · DALIŞ (HAVADA PLASE)</span>
        </div>
      </div>

      <footer className="max-w-md text-center text-[7px] leading-relaxed text-white/30">
        Türkiye Kadın Millî Voleybol Takımı&apos;na saygıyla yapılmış, ticari olmayan
        bir hayran projesidir.
      </footer>
    </div>
  );
}

/**
 * Giriş ekranı arka planı — millî takım karesi.
 *
 * `fixed`, çünkü giriş ekranı dar ekranlarda kayıyor; `absolute` olsaydı
 * fotoğraf içerikle birlikte kayar ve alt yarıda zemin boşalırdı. Üst
 * kapsayıcıdaki `isolate` bir yığın bağlamı açtığı için `-z-10` katmanı
 * içeriğin arkasına, ama sayfa zemininin önüne koyuyor.
 *
 * Örtü tek parça değil, üç katman: fotoğrafın kendi opaklığı, düz bir
 * koyu perde ve dikey degrade. Degrade başlık ile altbilgi hizasında
 * zemini tamamen kapatıyor — metin fotoğrafın kalabalık kısmının
 * üstüne denk geldiğinde okunurluk oradan kayboluyordu.
 */
function TeamBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${teamBackdrop})`,
          opacity: 0.62,
          // Formaların kırmızısı koyu arayüzün altında sönükleşiyordu
          filter: 'saturate(1.2) contrast(1.06)',
        }}
      />
      <div className="absolute inset-0 bg-retro-bg/40" />
      {/*
        Degrade yalnızca uçlarda kapatır: başlık üstte, altbilgi altta
        fotoğrafın kalabalık kısmına denk geliyordu ve okunmuyordu.
        Orta bant açık kalır ki takım gerçekten görünsün.
      */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #0b0b12 0%, rgba(11,11,18,0.5) 26%, rgba(11,11,18,0.5) 68%, #0b0b12 100%)',
        }}
      />
      {/* Kırmızı ışıma — #root üzerindeki salon dokusuyla aynı dil */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(227, 10, 23, 0.16), transparent 64%)',
        }}
      />
      {/* CRT tarama çizgileri fotoğrafı da piksel diline yaklaştırıyor */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 1px, transparent 1px, transparent 3px)',
        }}
      />
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
