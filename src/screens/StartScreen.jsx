import { useEffect, useMemo, useState } from 'react';
import ArenaBackdrop from '../components/ArenaBackdrop.jsx';
import PixelAvatar from '../components/PixelAvatar.jsx';
import MuteButton from '../components/MuteButton.jsx';
import MusicVolume from '../components/MusicVolume.jsx';
import { vitrinKadro, sonrakiHedef, FP_ACIK } from '../game/ilerleme.js';
import { getPlayerById } from '../game/players.js';
import { GAME_MODES } from '../game/modes.js';
import { onlineAcik } from '../net/baglanti.js';
import AchievementGrid from '../components/AchievementGrid.jsx';
import { ACHIEVEMENTS } from '../game/achievements.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

/** Gurur Tablosu — dönüşümlü onur mesajları (henüz maç yokken). */
const PRIDE_MESSAGES = [
  'FİLENİN İKİ YANINDA, TEK BİR YÜREK',
  'SAHADA YÜREK, FİLEDE ZAFER',
  'KIRMIZI BEYAZ, DÜNYANIN ZİRVESİNDE',
  'HER SMAÇTA BİR MİLLETİN ALKIŞI',
];

/*
 * Mod tuşunun sol şeridi — ızgara karolarını birbirinden ayırır.
 * Hepsi aynı koyu panel olunca "hangisi turnuva" okunmuyordu.
 */
const MODE_ACCENT = {
  hemen: '#E30A17',
  online: '#E30A17',
  match: '#FFFFFF',
  tournament: '#FFD24A',
  coop: '#FF7A18',
  versus: '#9BB0FF',
  survival: '#9BE7FF',
};

export default function StartScreen({
  onStart,
  onTutorial,
  muted,
  onToggleMute,
  records,
  resumeTournament = null,
  onResumeTournament,
  achievements = [],
  /** Forma Puanı ve açılan oyuncular (bkz. ilerleme.js). */
  ilerleme = { puan: 0, acilanlar: [] },
  musicVolume = 0.55,
  onMusicVolume,
  onSettings,
  onCollection,
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  /*
   * Röle sunucusu tanımlı değilse çevrimiçi modu listede yok. Basınca
   * "sunucu yok" diyen bir düğme, oyuncuya kendi internetinde sorun
   * varmış gibi hissettirir.
   */
  const modlar = useMemo(
    () => GAME_MODES.filter((mode) => !mode.online || onlineAcik()),
    [],
  );
  const hasRecords = (records?.matchesPlayed ?? 0) > 0;
  const hasSurvivalRecord = (records?.bestSurvivalPoints ?? 0) > 0;

  /*
   * Vitrin — SENİN kadron. Sabit üç isim değil: kaptan ve en son
   * açtığın iki oyuncu. Böylece bir oyuncu açtığında onu bir sonraki
   * açılışta menüde görüyorsun.
   */
  const showcase = useMemo(
    () => vitrinKadro(ilerleme?.acilanlar ?? []),
    [ilerleme]
  );
  /*
   * FP kapalıyken hedef YOK — aşağıdaki cüzdan bloğu zaten `hedef`e
   * bağlı olduğu için tek satırla birlikte kayboluyor.
   */
  const hedef = useMemo(
    () => (FP_ACIK ? sonrakiHedef(ilerleme?.puan ?? 0, ilerleme?.acilanlar ?? []) : null),
    [ilerleme]
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
    Sfx.fetchMusic();
    Sfx.startMusic();

    const kick = () => {
      Sfx.unlock();
      Sfx.startMusic();
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
    <div className="relative isolate flex min-h-full flex-col">
      <TeamBackdrop />

      {/*
        Üst şerit — kelime işareti, dev açılış yazısı değil.

        Eskiden RETRO / VOLEYBOL iki satır, 4xl/5xl, üstüne gurur
        tablosu ve vitrin biniyordu. İlk bakışta yalnız başlık
        görünüyor, mod tuşları için aşağı kaydırmak gerekiyordu.
        Şimdi başlık bir satır; tuşlar hemen altında.
      */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-3 py-2 sm:px-5 sm:py-3">
        <div className="min-w-0">
          <p className="mb-1 hidden text-[6px] tracking-[0.28em] text-white/45 sm:block">
            8 BİT PİKSEL VOLEYBOL
          </p>
          <h1 className="truncate text-[11px] leading-none text-turkiye-red text-outline-red sm:text-sm">
            RETRO VOLEYBOL
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MusicVolume value={musicVolume} onChange={onMusicVolume} muted={muted} />
          <MuteButton muted={muted} onToggle={onToggleMute} />
        </div>
      </header>

      {/*
        Asıl menü: ilk ekranı doldurur. Gurur / vitrin / kontroller
        bunun ALTINDA — kaydırınca gelir, tuşların yerini yemez.

        `flex-1` + `justify-center` masaüstünde tuşları dikey ortalar;
        kısa yatay telefonda `short:justify-start` boşluk yemez.
      */}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-3 px-3 pb-3 short:justify-start short:gap-2 sm:gap-4 sm:px-4">
        {resumeTournament && (
          <button
            type="button"
            className="retro-button w-full px-4 py-2 text-[8px] sm:py-3 sm:text-[9px]"
            onClick={() => {
              Sfx.unlock();
              Sfx.confirm();
              onResumeTournament?.();
            }}
          >
            ★ TURNUVAYA DEVAM ET · {resumeTournament.roundIndex + 1}. TUR ★
          </button>
        )}

        <div
          data-mod-izgara
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
        >
          {modlar.map((mode, i) => (
            <ModeTile
              key={mode.id}
              mode={mode}
              featured={i === 0}
              onClick={() => handleStart(mode.id)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            className="retro-button-ghost px-3 py-1.5 text-[7px] sm:px-5 sm:py-2 sm:text-[8px]"
            onClick={onTutorial}
          >
            NASIL OYNANIR
          </button>
          <button
            type="button"
            className="retro-button-ghost px-3 py-1.5 text-[7px] sm:px-5 sm:py-2 sm:text-[8px]"
            onClick={onCollection}
          >
            KOLEKSİYON
          </button>
          <button
            type="button"
            className="retro-button-ghost px-3 py-1.5 text-[7px] sm:px-5 sm:py-2 sm:text-[8px]"
            onClick={onSettings}
          >
            ⚙ AYARLAR
          </button>
        </div>
      </div>

      {/* İkinci bakış — kaydırınca; ilk ekranı tıkamaz */}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-3 pb-8 sm:gap-5 sm:px-4">
        <div className="retro-panel w-full px-5 py-4 text-center">
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

        {achievements.length > 0 && (
          <div className="retro-panel w-full px-5 py-4">
            <p className="mb-3 text-center text-[8px] tracking-widest text-retro-accent">
              ★ ROZETLER · {achievements.length}/{ACHIEVEMENTS.length} ★
            </p>
            <AchievementGrid unlocked={achievements} />
          </div>
        )}

        <div className="flex items-end justify-center gap-5 short:hidden sm:gap-10">
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

        {hedef && (
          <div className="retro-panel w-full px-5 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[7px] tracking-widest text-white/40">FORMA PUANI</span>
              <span className="text-[10px] text-retro-accent">
                {(ilerleme?.puan ?? 0).toLocaleString('tr-TR')} FP
              </span>
            </div>
            <div className="mt-2 h-2 w-full border border-white/20 bg-black/40">
              <div
                className="h-full bg-retro-accent transition-[width] duration-500"
                style={{ width: `${Math.round(hedef.oran * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[7px] text-white/45">
              {hedef.kalan > 0
                ? `${upper(getPlayerById(hedef.id)?.name ?? '')} İÇİN ${hedef.kalan} FP`
                : `${upper(getPlayerById(hedef.id)?.name ?? '')} AÇILMAYA HAZIR`}
            </p>
          </div>
        )}

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
          Voleybola saygıyla yapılmış, ticari olmayan bağımsız bir oyundur.
          Takımlar ve oyuncular kurgusaldır.
        </footer>
      </div>
    </div>
  );
}

function ModeTile({ mode, featured, onClick }) {
  const accent = MODE_ACCENT[mode.id] ?? '#FFFFFF';
  return (
    <button
      type="button"
      data-mode={mode.id}
      onClick={onClick}
      className={`group flex min-h-[2.85rem] flex-col items-stretch justify-center gap-1 border-4 px-3 py-2 text-left backdrop-blur-[3px] transition short:min-h-[2.5rem] short:px-2.5 short:py-1.5 tall:min-h-[4.25rem] tall:px-4 tall:py-3 ${
        featured
          ? 'col-span-2 border-turkiye-red bg-turkiye-red/35 hover:bg-turkiye-red/50'
          : 'border-white/20 bg-retro-panel/80 hover:border-white/55 hover:bg-retro-panel/95'
      }`}
      style={
        featured
          ? undefined
          : { boxShadow: `inset 4px 0 0 ${accent}` }
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={`min-w-0 text-white ${
            featured ? 'text-[11px] sm:text-sm' : 'text-[9px] sm:text-[11px]'
          }`}
        >
          {mode.label}
        </p>
        <span className="shrink-0 text-[6px] text-retro-accent sm:text-[7px]">
          {mode.tagline}
        </span>
      </div>
      <p className="mt-0.5 hidden text-[6px] leading-relaxed text-white/55 tall:block sm:text-[7px]">
        {mode.description}
      </p>
    </button>
  );
}

/**
 * Giriş ekranı arka planı — kodla çizilen salon.
 *
 * `fixed`, çünkü giriş ekranı dar ekranlarda kayıyor; `absolute` olsaydı
 * arka plan içerikle birlikte kayar ve alt yarıda zemin boşalırdı. Üst
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
      {/*
        Fotoğraf yerine KODLA çizilen salon (bkz. ArenaBackdrop).
        Saydamlık ve doygunluk ayarları olduğu gibi korundu: fotoğraf
        için seçilmişlerdi ama aynı işi görüyorlar — arka planı
        arayüzün altında geride tutmak.
      */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.62,
          // Formaların kırmızısı koyu arayüzün altında sönükleşiyordu
          filter: 'saturate(1.2) contrast(1.06)',
        }}
      >
        <ArenaBackdrop />
      </div>
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
