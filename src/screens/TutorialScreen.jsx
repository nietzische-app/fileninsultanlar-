import { useCallback, useEffect, useRef, useState } from 'react';
import MuteButton from '../components/MuteButton.jsx';
import GameIcon from '../components/GameIcon.jsx';
import { Slider } from '../components/SettingsPanels.jsx';
import Sfx from '../game/audio.js';
import { t, yuzde } from '../i18n/index.js';
import {
  padSinirla,
  tutDongu,
  tutKonum,
  yeterinceSuruklendi,
} from '../components/tutorialAnim.js';

const STEP_COUNT = 2;
const GLOW_MS = 2400;

/**
 * Piksel parmak — 16×16, işaret parmağı sol-altta dursun diye
 * tuşun sağ-üstüne oturtuluyor.
 */
function ParmakIkonu() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="100%"
      height="100%"
      className="pixelated"
      aria-hidden="true"
    >
      <g fill="currentColor">
        <rect x="1" y="12" width="4" height="3" />
        <rect x="2" y="10" width="4" height="3" />
        <rect x="3" y="7" width="4" height="4" />
        <rect x="4" y="4" width="4" height="4" />
        <rect x="5" y="1" width="4" height="4" />
        <rect x="8" y="3" width="6" height="8" />
        <rect x="9" y="10" width="5" height="3" />
        <rect x="10" y="12" width="4" height="3" />
        <rect x="7" y="2" width="3" height="2" />
      </g>
    </svg>
  );
}

/**
 * Nasıl oynanır — tuşların yerinin ve boyutunun değişebildiğini
 * animasyonla gösteren iki adım.
 *
 * Eskiden beş metin kartı vardı. Kartlar okunuyordu, tuşun
 * sürüklenebilir olduğu öğrenilmiyordu. Şimdi aynı ekranda gerçek
 * bir tuş duruyor; parmak onu taşıyor, oyuncu da deneyebiliyor.
 */
export default function TutorialScreen({
  onDone,
  onBack,
  muted,
  onToggleMute,
  controls = { scale: 1 },
  onControls,
}) {
  const [step, setStep] = useState(0);
  const [userPos, setUserPos] = useState(null);
  const [anim, setAnim] = useState({ x: 0, y: 0, press: 0, finger: 0 });
  const [dragging, setDragging] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [padSize, setPadSize] = useState(64);

  const areaRef = useRef(null);
  const padRef = useRef(null);
  const grabRef = useRef({ dx: 0, dy: 0, ox: 0, oy: 0 });
  const draggingRef = useRef(false);
  const userPosRef = useRef(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current =
      typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    const node = areaRef.current;
    if (!node) return undefined;
    const ok = () => {
      const r = node.getBoundingClientRect();
      setArea({ w: r.width, h: r.height });
    };
    ok();
    const ro = new ResizeObserver(ok);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const node = padRef.current;
    if (!node) return undefined;
    const ok = () => setPadSize(node.getBoundingClientRect().width || 64);
    ok();
    const ro = new ResizeObserver(ok);
    ro.observe(node);
    return () => ro.disconnect();
  }, [controls.scale]);

  const uclar = useCallback(() => {
    const spanX = Math.max(0, area.w - padSize);
    const spanY = Math.max(0, area.h - padSize);
    return {
      start: { x: spanX * 0.1, y: spanY * 0.58 },
      end: { x: spanX * 0.46, y: spanY * 0.18 },
    };
  }, [area.w, area.h, padSize]);

  useEffect(() => {
    if (step !== 0 || dragging || userPos) return undefined;
    if (area.w < 8 || area.h < 8) return undefined;

    if (reducedRef.current) {
      const { start } = uclar();
      setAnim({ x: start.x, y: start.y, press: 0, finger: 0.85 });
      return undefined;
    }

    let id = 0;
    const tick = (now) => {
      const { start, end } = uclar();
      const d = tutDongu(now);
      const k = tutKonum(d, start, end);
      setAnim({ x: k.x, y: k.y, press: d.press, finger: d.finger });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [step, dragging, userPos, area.w, area.h, padSize, uclar]);

  const pos = userPos ?? { x: anim.x, y: anim.y };
  const ready = area.w > 8 && area.h > 8;
  const fingerOn = ready && step === 0 && !dragging && anim.finger > 0.04;
  const press = dragging ? 1 : (userPos ? 0 : anim.press);

  const gitIki = useCallback(() => {
    Sfx.confirm();
    setStep(1);
  }, []);

  const finish = (skipped) => {
    if (skipped) Sfx.select();
    else Sfx.confirm();
    onDone();
  };

  useEffect(() => {
    if (step !== 1) return undefined;
    const tmr = setTimeout(() => finish(false), GLOW_MS);
    return () => clearTimeout(tmr);
    // finish her render'da yeni; yalnız adıma bağla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const onPointerDown = (e) => {
    if (step !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    Sfx.unlock();
    draggingRef.current = true;
    userPosRef.current = { x: pos.x, y: pos.y };
    setDragging(true);
    grabRef.current = {
      dx: e.clientX - rect.left - pos.x,
      dy: e.clientY - rect.top - pos.y,
      ox: pos.x,
      oy: pos.y,
    };
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current || !areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const next = padSinirla(
      e.clientX - rect.left - grabRef.current.dx,
      e.clientY - rect.top - grabRef.current.dy,
      padSize,
      rect.width,
      rect.height,
    );
    userPosRef.current = next;
    setUserPos(next);
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const here = userPosRef.current;
    if (here && yeterinceSuruklendi(here.x - grabRef.current.ox, here.y - grabRef.current.oy)) {
      gitIki();
    }
  };

  const { end } = uclar();

  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      data-tutorial-step={step}
    >
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-[8px] tracking-widest text-retro-accent">{t('tut.kicker')}</p>
          <h2 className="text-base text-turkiye-red text-outline-red sm:text-xl">
            {t('tut.title')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          <button
            type="button"
            className="retro-button-ghost min-h-10 px-3 py-2 text-[8px]"
            onClick={() => finish(true)}
          >
            {t('tut.skip')}
          </button>
        </div>
      </header>

      <div className="mt-3 flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <span
            key={i}
            className={`h-2 w-8 border-2 ${
              i === step
                ? 'border-retro-accent bg-retro-accent'
                : i < step
                  ? 'border-white/50 bg-white/40'
                  : 'border-white/25 bg-transparent'
            }`}
          />
        ))}
        <span className="text-[7px] text-white/40">
          {t('tut.step', { n: step + 1, toplam: STEP_COUNT })}
        </span>
      </div>

      <p
        className="mt-3 max-w-xl text-[9px] leading-relaxed text-white sm:text-[11px]"
        data-tutorial-caption
      >
        {step === 0 ? t('tut.customize') : t('tut.saved')}
      </p>
      {step === 1 && (
        <p className="mt-1 text-[7px] text-white/50">{t('tut.savedHint')}</p>
      )}

      <div
        ref={areaRef}
        data-tutorial-court
        className="tut-court relative mt-3 min-h-[min(52dvh,22rem)] w-full flex-1 overflow-hidden border-4 border-white/25"
        style={{ '--touch-scale': controls.scale ?? 1 }}
      >
        {/* Hedef gölge — parmağın götürdüğü yer */}
        {step === 0 && area.w > 0 && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-white/25"
            style={{
              left: end.x,
              top: end.y,
              width: padSize,
              height: padSize,
            }}
            aria-hidden="true"
          />
        )}

        {/* Sağdaki sönük aksiyon tuşları — sahne maç gibi dursun */}
        <div
          className="pointer-events-none absolute bottom-2 right-2 flex items-end gap-2 opacity-35 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]"
          aria-hidden="true"
        >
          <div className="touch-button tb-act">
            <span className="tb-label">{t('touch.hitLabel')}</span>
          </div>
          <div className="touch-button tb-jump">
            <GameIcon name="ArrowRight" size="48%" rotate={-90} />
          </div>
        </div>

        <button
          ref={padRef}
          type="button"
          data-tutorial-pad
          aria-label={t('tut.dragAria')}
          className={`touch-button tb-dir absolute z-10 touch-none ${
            step === 1 ? 'tut-glow' : ''
          }`}
          style={{
            left: pos.x,
            top: pos.y,
            transform: `scale(${1 - press * 0.07})`,
            cursor: step === 0 ? 'grab' : 'default',
            visibility: ready ? 'visible' : 'hidden',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="tb-label">{t('tut.aLabel')}</span>
        </button>

        {fingerOn && (
          <div
            data-tutorial-finger
            className="pointer-events-none absolute z-20 text-white"
            style={{
              left: pos.x + padSize * 0.42,
              top: pos.y + padSize * 0.38,
              width: padSize * 0.72,
              height: padSize * 0.72,
              opacity: anim.finger,
              transform: `scale(${1 - press * 0.08}) rotate(-18deg)`,
              filter: 'drop-shadow(3px 3px 0 rgba(0,0,0,0.65))',
            }}
            aria-hidden="true"
          >
            <ParmakIkonu />
          </div>
        )}
      </div>

      {step === 0 && onControls && (
        <div className="mx-auto mt-3 w-full max-w-md">
          <Slider
            label={t('settings.size')}
            hint={t('tut.sizeHint')}
            value={controls.scale ?? 1}
            min={0.7}
            max={1.4}
            step={0.05}
            format={(v) => yuzde(v * 100)}
            onChange={(v) => onControls({ scale: v })}
          />
        </div>
      )}

      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-3">
        {onBack && step === 0 && (
          <button
            type="button"
            className="retro-button-ghost min-h-12 px-5 py-3 text-[9px]"
            onClick={() => {
              Sfx.select();
              onBack();
            }}
          >
            {t('nav.back')}
          </button>
        )}
        {step === 0 ? (
          <button
            type="button"
            className="retro-button min-h-12 px-8 py-3 text-[9px]"
            onClick={gitIki}
          >
            {t('tut.done')}
          </button>
        ) : (
          <button
            type="button"
            className="retro-button min-h-12 px-8 py-3 text-[9px]"
            onClick={() => finish(false)}
          >
            {t('tut.continue')}
          </button>
        )}
      </div>
    </div>
  );
}
