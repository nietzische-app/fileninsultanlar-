import { useCallback, useEffect, useRef, useState } from 'react';
import Game from '../game/Game.js';
import { FORMATS, GAME_HEIGHT, GAME_WIDTH, PHASE } from '../game/constants.js';
import { getPlayerById } from '../game/players.js';
import Scoreboard from '../components/Scoreboard.jsx';
import TouchControls from '../components/TouchControls.jsx';
import MuteButton from '../components/MuteButton.jsx';
import GameIcon from '../components/GameIcon.jsx';
import { AudioSettings, ControlSettings } from '../components/SettingsPanels.jsx';
import useFullscreen from '../hooks/useFullscreen.js';
import useViewport from '../hooks/useViewport.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

const INITIAL_HUD = {
  score: { home: 0, away: 0 },
  sets: { home: 0, away: 0 },
  setNumber: 1,
  setHistory: [],
  phase: PHASE.READY,
  running: false,
  streak: { side: null, count: 0 },
  pointsPerSet: 15,
  formatId: 'classic',
  campaign: 'match',
  roundLabel: null,
  survival: null,
  combo: 0,
  comboTier: null,
  opponentName: 'RAKİP',
  opponentAccent: '#9BB0FF',
};

/**
 * Maç ekranı — Canvas oyun alanı, skor tablosu ve mobil dokunmatik
 * kontroller.
 */
export default function MatchScreen({
  config,
  onFinish,
  onQuit,
  muted,
  onToggleMute,
  controls,
  onControls,
  musicVolume,
  onMusicVolume,
  sfxVolume,
  onSfxVolume,
}) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const confirmCancelRef = useRef(null);
  const stageRef = useRef(null);

  const [hud, setHud] = useState(INITIAL_HUD);
  const [paused, setPaused] = useState(false);
  const [quitConfirm, setQuitConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fullscreen = useFullscreen(stageRef);
  const { portrait, coarse } = useViewport();

  // --- Motorun kurulumu ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const game = new Game(canvas, {
      mode: config.mode,
      homeIds: config.homeIds,
      difficulty: config.difficulty,
      format: config.format,
      opponentId: config.opponentId,
      // Kampanya alanları — hızlı maçta undefined kalır
      campaign: config.campaign,
      playMode: config.playMode,
      rules: config.rules,
      difficultyRamp: config.difficultyRamp,
      roundLabel: config.roundLabel,
      roundNumber: config.roundNumber,
      roundCount: config.roundCount,
      onState: setHud,
      onFinish: (result) => onFinishRef.current(result),
    });

    gameRef.current = game;
    game.start();

    // Geliştirme kolaylığı: konsoldan motora ve ses motoruna eriş
    // (production build'de yok). Ses motoru da açılır çünkü Web Audio
    // hataları sessizce yutuluyor ve dışarıdan doğrulanamıyor.
    if (import.meta.env.DEV) {
      window.__game = game;
      window.__sfx = Sfx;
    }

    return () => {
      game.destroy();
      gameRef.current = null;
      if (import.meta.env.DEV) {
        delete window.__game;
        delete window.__sfx;
      }
    };
  }, [config]);

  // --- Maç sırasında sayfa kaydırmasını kilitle (mobil) ---
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  const pauseGame = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.finished) return;
    if (game.running) {
      game.stop();
      Sfx.pause();
    }
    setPaused(true);
  }, []);

  const resumeGame = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.finished) return;
    setQuitConfirm(false);
    if (!game.running) game.start();
    setPaused(false);
  }, []);

  /*
   * Dikey tutuşta maçı dondur.
   *
   * Yatay kapısı ekranı kaplıyor ama motor arkada koşmaya devam
   * ediyordu: kullanıcı telefonu çevirene kadar rakip sayı üstüne sayı
   * alıyordu. Yatay dönünce kendiliğinden devam ETMEZ — duraklatma
   * katmanı açık kalır ki oyuncu hazır olduğunda kendisi başlatsın.
   */
  useEffect(() => {
    if (!(portrait && coarse)) return;
    pauseGame();
  }, [portrait, coarse, pauseGame]);

  // --- Sekme arka plana geçince duraklat ---
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && gameRef.current && !gameRef.current.finished) {
        pauseGame();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pauseGame]);

  /*
   * Klavye odağı kaybolunca duraklat.
   *
   * Oyun portalları oyunu iframe'e gömüyor. Oyuncu portal sayfasının bir
   * yerine tıkladığında iframe odağı kaybediyor: tuşlar artık oyuna
   * ulaşmıyor ama motor koşmaya devam ediyordu — yani oyuncu hiçbir şey
   * yapamazken sayı kaybediyor ve sebebini anlamıyordu. Ölçümde
   * doğrulandı. Duraklatma katmanı hem durumu açıklıyor hem de
   * "DEVAM ET"e basmak odağı geri veriyor.
   *
   * Gömülü olmayan dağıtımda da işe yarar: başka bir pencereye tıklamak
   * `blur` üretir ama `visibilitychange` üretmez.
   */
  useEffect(() => {
    const handleBlur = () => {
      const game = gameRef.current;
      if (game && !game.finished && game.running) pauseGame();
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [pauseGame]);

  /*
   * Çoklu dokunuşun sahayı yakınlaştırmasını engelle.
   *
   * CSS'teki `touch-action: none` normal koşulda yetiyor, bu son
   * savunma hattı: Chrome Android'in "Force enable zoom" erişilebilirlik
   * ayarı viewport meta'sındaki ölçek sınırını yok sayıyor ve iki
   * parmakla oynayan oyuncu (ör. sol + zıpla) sahayı yakınlaştırıyordu.
   *
   * Yalnızca `touchmove` engelleniyor, `touchstart` değil: pinch hareket
   * gerektirdiği için bu yeterli, üstelik tuşların pointer capture ile
   * çalışan basma/bırakma akışına hiç dokunmuyor.
   *
   * Menülerde bu kısıt YOK — orada yazılar küçük ve yakınlaştırmak
   * meşru bir ihtiyaç.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const blockPinch = (event) => {
      if (event.touches.length > 1) event.preventDefault();
    };

    // `passive: false` şart — varsayılan pasif dinleyicide
    // preventDefault sessizce yok sayılıyor.
    stage.addEventListener('touchmove', blockPinch, { passive: false });
    return () => stage.removeEventListener('touchmove', blockPinch);
  }, []);

  const requestQuit = useCallback(() => {
    Sfx.unlock();
    Sfx.select();
    pauseGame();
    setQuitConfirm(true);
  }, [pauseGame]);

  const cancelQuit = useCallback(() => {
    Sfx.select();
    setQuitConfirm(false);
  }, []);

  const confirmQuit = useCallback(() => {
    Sfx.unlock();
    Sfx.select();
    setQuitConfirm(false);
    onQuit();
  }, [onQuit]);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.finished) return;

    Sfx.unlock();
    Sfx.select();
    if (quitConfirm) {
      setQuitConfirm(false);
      return;
    }
    // Ayar katmanı açıkken üstteki duraklat düğmesi katmanı kapatır
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    if (game.running) {
      pauseGame();
    } else {
      resumeGame();
    }
  }, [pauseGame, resumeGame, quitConfirm, settingsOpen]);

  // --- Escape / P ile duraklat; onay açıkken iptal ---
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && quitConfirm) {
        event.preventDefault();
        cancelQuit();
        return;
      }
      /*
       * Ayar katmanı açıkken ESC/P onu kapatır, oyunu başlatmaz.
       * Yoksa katman havada kalırken maç arkada koşmaya başlıyordu.
       */
      if (settingsOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setSettingsOpen(false);
        }
        return;
      }
      if (event.key !== 'Escape' && event.key !== 'p' && event.key !== 'P') return;
      if (quitConfirm) return;

      const game = gameRef.current;
      if (!game || game.finished) return;

      if (game.running) {
        pauseGame();
      } else {
        resumeGame();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pauseGame, resumeGame, quitConfirm, cancelQuit, settingsOpen]);

  // Onay diyaloğu açılınca iptal düğmesine odak
  useEffect(() => {
    if (!quitConfirm) return;
    confirmCancelRef.current?.focus?.();
  }, [quitConfirm]);

  const handleTouchInput = useCallback((name, pressed) => {
    if (paused || quitConfirm) return;
    Sfx.unlock();
    gameRef.current?.setInput(name, pressed);
  }, [paused, quitConfirm]);

  const squad = config.homeIds.map((id) => getPlayerById(id)).filter(Boolean);
  const controlsLocked = paused || quitConfirm;
  /*
   * Tek telefonda iki kişi oynayamaz; Co-Op/VS klavyeye özgüdür.
   * Dokunmatik tuşları göstermek 2. oyuncunun kontrolü yokmuş gibi
   * yanıltıcı olurdu.
   */
  const twoPlayer = config.playMode === 'coop' || config.playMode === 'vs';

  // Ham id değil etiket: upper('classic') Türkçe eşlemede "CLASSİC" veriyordu
  const matchLabel =
    config.campaign === 'survival'
      ? 'HAYATTA KALMA'
      : config.roundLabel
        ? `TURNUVA · ${config.roundLabel}`
        : (FORMATS[config.format]?.label ?? FORMATS.classic.label);

  return (
    <div
      ref={stageRef}
      className="match-screen mx-auto flex min-h-full w-full max-w-[960px] flex-col items-center gap-3 px-2 py-3 touch:fixed touch:inset-0 touch:z-40 touch:block touch:h-[100dvh] touch:w-screen touch:max-w-none touch:overflow-hidden touch:overscroll-none touch:bg-black touch:p-0 sm:gap-4 sm:px-3 sm:py-5"
    >
      {/*
        Üst HUD. Mobilde skor tablosu ve hızlı düğmeler tek bir saydam
        katmanda sahnenin üstüne biner; masaüstünde eskisi gibi akışta
        durur.
      */}
      <div className="w-full shrink-0 touch:pointer-events-none touch:absolute touch:inset-x-0 touch:top-0 touch:z-20 touch:flex touch:flex-col touch:gap-1 touch:px-1 touch:pt-[env(safe-area-inset-top)]">
        <div className="flex w-full items-start gap-1">
          <Scoreboard
            score={hud.score}
            sets={hud.sets}
            setNumber={hud.setNumber}
            setHistory={hud.setHistory}
            awayName={hud.opponentName}
            awayAccent={hud.opponentAccent}
            pointsPerSet={hud.pointsPerSet}
            survival={hud.survival}
            roundLabel={hud.roundLabel}
            compact
            overlay={coarse}
          />

          {/* Duraklat / tam ekran / çık — yalnızca mobil */}
          <div className="pointer-events-auto flex shrink-0 gap-1 pr-[env(safe-area-inset-right)] fine:hidden">
            {fullscreen.supported && (
              <button
                type="button"
                className="touch-button touch-button-overlay h-8 w-8 text-[10px]"
                onClick={fullscreen.toggle}
                aria-label={fullscreen.active ? 'Tam ekrandan çık' : 'Tam ekran'}
              >
                {fullscreen.active ? '⤡' : '⛶'}
              </button>
            )}
            <button
              type="button"
              className="touch-button touch-button-overlay h-8 w-8 text-[9px]"
              onClick={togglePause}
              aria-label={paused ? 'Devam et' : 'Duraklat'}
            >
              <GameIcon name={paused ? 'Play' : 'Pause'} size="45%" />
            </button>
            <button
              type="button"
              className="touch-button touch-button-overlay h-8 w-9"
              onClick={requestQuit}
              aria-label="Maçtan çık"
            >
              <GameIcon name="Home" size="42%" />
            </button>
          </div>
        </div>

      </div>

      {/*
        Oyun alanı. Mobilde sahnenin tamamını kaplar ve canvas oranını
        koruyarak ortalanır; kontroller bu kutunun köşelerine biner.
        Önceden canvas 42dvh'ye sıkışıp tuşlar altında ayrı bir şeritte
        duruyordu — saha avuç içi kadar kalıyordu.
      */}
      {/*
        `portrait:pb-…` sahayı yukarı, HUD'ın hemen altına çeker. Saf
        ortalamada 9:5 oranındaki canvas dikey ekranda ortada asılı
        kalıyor, üstünde ve altında eşit iki siyah bant oluşuyordu;
        alttaki bandı tek parça yapıp kontrollere ve maç künyesine
        ayırmak hem daha derli toplu hem başparmak erişimine uygun.
      */}
      <div className="match-stage scanlines relative w-full max-w-[900px] shrink border-4 border-white/85 bg-black touch:absolute touch:inset-0 touch:flex touch:max-w-none touch:items-center touch:justify-center touch:border-0 touch:portrait:pb-[13.5rem]">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="pixelated block h-auto max-h-full w-full touch:stage-canvas touch:w-auto"
          style={{ aspectRatio: `${GAME_WIDTH} / ${GAME_HEIGHT}` }}
          aria-label="Filenin Sultanları voleybol sahası"
        />

        {/*
          Kombo göstergesi — sahanın sol üstünde, tuşlardan uzakta.
          Yalnızca kombo varken görünür; sıfırdayken yer kaplamaz.
        */}
        {hud.combo > 1 && (
          <div
            key={hud.combo}
            className="animate-combo-pop pointer-events-none absolute left-2 top-16 z-20 border-2 px-2 py-1 text-center sm:left-4 sm:top-20"
            style={{
              borderColor: hud.comboTier?.color ?? '#FFFFFF',
              color: hud.comboTier?.color ?? '#FFFFFF',
              backgroundColor: 'rgba(8, 8, 16, 0.55)',
            }}
          >
            <span className="block text-[13px] leading-none sm:text-lg">
              ×{hud.combo}
            </span>
            <span className="mt-1 block text-[6px] leading-none opacity-70">
              {hud.comboTier?.label ?? 'KOMBO'}
            </span>
          </div>
        )}

        {/* Mobil: kontroller sahanın köşelerinde, şeffaf */}
        {!twoPlayer && (
          <TouchControls
            onInput={handleTouchInput}
            disabled={controlsLocked}
            dimWhenDisabled={!settingsOpen}
            settings={controls}
            overlay
          />
        )}

        {/* Dikey ekranda saha ile tuşlar arasındaki bandı künye doldurur */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[12.5rem] z-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 text-center text-[7px] text-white/40 fine:hidden landscape:hidden">
          <span>{upper(config.mode)}</span>
          <span className="text-white/15">|</span>
          <span>{matchLabel}</span>
          <span className="text-white/15">|</span>
          <span>{squad.map((p) => upper(p.name)).join(' + ')}</span>
          {hud.opponentName && (
            <>
              <span className="text-white/15">vs</span>
              <span style={{ color: hud.opponentAccent }}>{hud.opponentName}</span>
            </>
          )}
        </div>


        {/* Duraklatma katmanı */}
        {paused && !quitConfirm && !settingsOpen && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-3"
            role="dialog"
            aria-modal="true"
            aria-label="Oyun duraklatıldı"
          >
            <p className="text-lg text-retro-accent">DURAKLATILDI</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" className="retro-button" onClick={resumeGame}>
                DEVAM ET
              </button>
              <button
                type="button"
                className="retro-button-ghost"
                onClick={() => {
                  Sfx.select();
                  setSettingsOpen(true);
                }}
              >
                ⚙ AYARLAR
              </button>
              <MuteButton muted={muted} onToggle={onToggleMute} />
              <button type="button" className="retro-button-ghost" onClick={requestQuit}>
                MAÇTAN ÇIK
              </button>
            </div>
          </div>
        )}

        {/*
          Maç içi ayarlar.

          Üste yaslı ve yüksekliği sınırlı: alt köşelerdeki GERÇEK
          dokunmatik tuşlar görünür kalsın diye. Ayarı yaparken tuşların
          kendisi anında değişiyor, yani buraya ayrı bir önizleme
          koymak gereksiz — ve tam ekran karartma koysaydık oyuncu
          neyi ayarladığını göremezdi.
        */}
        {settingsOpen && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-3 pt-2"
            role="dialog"
            aria-modal="true"
            aria-label="Maç ayarları"
          >
            {/*
              Kartın yüksekliği tuşların GERÇEK yüksekliğine bağlı.
              Sabit bir oran (74dvh) yetmiyordu: ölçek %140'a çekilince
              tuşlar büyüyüp yukarı taşıyor ve kart onların üstüne
              biniyordu — ölçümde iPhone SE'de ▶ ve SULTAN kalıyordu.
              Tuş yığını yaklaşık 22.5vh × ölçek; pay ekleyip çıkarıyoruz.
            */}
            <div
              className="retro-panel pointer-events-auto w-full max-w-md overflow-y-auto px-4 py-3"
              style={{
                maxHeight: `max(9rem, calc(100dvh - ${24 * (controls?.scale ?? 1)}vh - 2.5rem))`,
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[9px] tracking-widest text-retro-accent">⚙ AYARLAR</p>
                <button
                  type="button"
                  className="retro-button-ghost px-3 py-1.5 text-[8px]"
                  onClick={() => {
                    Sfx.select();
                    setSettingsOpen(false);
                  }}
                >
                  KAPAT
                </button>
              </div>

              <p className="mb-3 text-[7px] leading-relaxed text-white/45">
                Tuşlar aşağıda duruyor; ayarı çekerken değiştiklerini görürsün.
              </p>
              <ControlSettings
                controls={controls}
                onControls={onControls}
                showPreview={false}
              />

              <div className="mt-5 border-t-2 border-white/10 pt-4">
                <p className="mb-3 text-[8px] tracking-widest text-retro-accent">SES</p>
                <AudioSettings
                  muted={muted}
                  onToggleMute={onToggleMute}
                  musicVolume={musicVolume}
                  onMusicVolume={onMusicVolume}
                  sfxVolume={sfxVolume}
                  onSfxVolume={onSfxVolume}
                />
              </div>
            </div>
          </div>
        )}

        {/* Çıkış onayı */}
        {quitConfirm && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quit-confirm-title"
          >
            <p id="quit-confirm-title" className="text-center text-sm text-white sm:text-lg">
              MAÇTAN ÇIKILSIN MI?
            </p>
            <p className="max-w-xs text-center text-[7px] leading-relaxed text-white/55 sm:text-[8px]">
              {config.campaign === 'tournament'
                ? 'Turnuvadan çekilmiş sayılırsın, kupa yolu kapanır.'
                : config.campaign === 'survival'
                  ? 'Koşu burada biter, puanın kaydedilmez.'
                  : 'Skor kaydedilmez. Kadro seçimine dönersin.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                ref={confirmCancelRef}
                type="button"
                className="retro-button px-6 py-3"
                onClick={cancelQuit}
              >
                DEVAM ET
              </button>
              <button
                type="button"
                className="retro-button-ghost px-6 py-3"
                onClick={confirmQuit}
              >
                ÇIK
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alt bilgi — masaüstü */}
      <div className="flex w-full max-w-[900px] shrink-0 flex-wrap items-center justify-between gap-2 touch:hidden">
        <div className="hidden items-center gap-3 text-[7px] text-white/45 sm:flex">
          <span>{upper(config.mode)}</span>
          <span className="text-white/20">|</span>
          <span>{matchLabel}</span>
          <span className="text-white/20">|</span>
          <span>{squad.map((p) => upper(p.name)).join(' + ')}</span>
          {hud.opponentName && (
            <>
              <span className="text-white/20">vs</span>
              <span style={{ color: hud.opponentAccent }}>{hud.opponentName}</span>
            </>
          )}
        </div>

        <div className="flex w-full justify-end gap-2 sm:w-auto sm:gap-3">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          {fullscreen.supported && (
            <button
              type="button"
              className="retro-button-ghost px-4 py-2 text-[8px]"
              onClick={fullscreen.toggle}
            >
              {fullscreen.active ? 'TAM EKRANDAN ÇIK' : 'TAM EKRAN'}
            </button>
          )}
          <button
            type="button"
            className="retro-button-ghost px-4 py-2 text-[8px]"
            onClick={togglePause}
          >
            {paused ? 'DEVAM' : 'DURAKLAT'}
          </button>
          <button
            type="button"
            className="retro-button-ghost px-4 py-2 text-[8px]"
            onClick={requestQuit}
          >
            ÇIK
          </button>
        </div>
      </div>

      <p className="hidden text-center text-[7px] leading-relaxed text-white/35 fine:block">
        {twoPlayer
          ? '1. OYUNCU: W A S D · BOŞLUK VUR · X SULTAN   ·   2. OYUNCU: ← → ↑ ↓ · ENTER VUR   ·   ESC DURAKLAT'
          : '← → HAREKET · ↑ ZIPLA · ↓ DALIŞ (HAVADA PLASE) · BOŞLUK VUR (TAM ZAMANINDA BAS!) · X SULTAN GÜCÜ · ESC DURAKLAT'}
      </p>
    </div>
  );
}
