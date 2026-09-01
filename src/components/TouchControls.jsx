import { useCallback, useEffect, useRef } from 'react';
import Sfx from '../game/audio.js';

/**
 * Mobil cihazlar için ekran üstü kontroller.
 *
 * Pointer capture ile çoklu dokunuş desteklenir (ör. sol + zıpla).
 * `pointerleave` bilerek yok — kaydırırken tuşun erken bırakılmasını
 * ve bazı mobil tarayıcılarda takılı kalmayı önler.
 *
 * `disabled` (duraklatma) iken basılı tutulan tüm girdiler bırakılır.
 *
 * `overlay` modunda kontroller ayrı bir şerit olmak yerine sahnenin
 * köşelerine biner: kapsayıcı tıklamayı geçirmez, yalnızca tuşların
 * kendisi dokunuş alır — yoksa görünmez bir katman sahanın tamamını
 * kaplayıp oyunu bloke ediyor.
 */
export default function TouchControls({
  onInput,
  sultanReady,
  disabled = false,
  overlay = false,
  settings = { scale: 1, opacity: 0.85, swap: false },
  preview = false,
}) {
  const unlock = () => {
    if (!disabled) Sfx.unlock();
  };

  const buttonTone = overlay ? 'touch-button-overlay' : '';

  /*
   * Boyut ve saydamlık ayarlardan gelir; ölçüler `index.css` içindeki
   * `.tb-*` sınıflarında `--touch-scale` ile çarpılır. Ölçek hem ekran
   * yüksekliğine hem kullanıcı tercihine bağlı: sabit rem değerlerinde
   * kısa ekranlarda tuşlar sahanın oynanan bandını yutuyordu (iPhone
   * SE'de oyuncu tamamen ▶ tuşunun arkasında kalıyordu).
   */
  const styleVars = {
    '--touch-scale': settings.scale ?? 1,
    opacity: disabled ? undefined : (settings.opacity ?? 0.85),
  };

  const dpad = (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <HoldButton
          onInput={onInput}
          action="left"
          label="◀"
          disabled={disabled}
          className={`tb-dir text-2xl ${buttonTone}`}
        />
        <HoldButton
          onInput={onInput}
          action="right"
          label="▶"
          disabled={disabled}
          className={`tb-dir text-2xl ${buttonTone}`}
        />
      </div>
      <HoldButton
        onInput={onInput}
        action="dive"
        label="DAL"
        disabled={disabled}
        className={`tb-wide w-full text-[9px] ${buttonTone}`}
      />
    </div>
  );

  const actions = (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-2">
        <HoldButton
          onInput={onInput}
          action="sultan"
          label="SULTAN"
          disabled={disabled}
          className={`tb-small text-[7px] ${buttonTone} ${
            sultanReady ? 'animate-pulse-gold border-retro-accent bg-turkiye-red' : ''
          }`}
        />
        <HoldButton
          onInput={onInput}
          action="action"
          label="VUR"
          disabled={disabled}
          className={`tb-act text-[9px] ${buttonTone}`}
        />
      </div>
      <HoldButton
        onInput={onInput}
        action="up"
        label="ZIPLA"
        disabled={disabled}
        className={`tb-jump text-[9px] ${buttonTone}`}
      />
    </div>
  );

  if (overlay) {
    // `swap`: yön tuşları sağa, aksiyonlar sola — solaklar için
    const leftSide = settings.swap ? actions : dpad;
    const rightSide = settings.swap ? dpad : actions;

    return (
      <div
        /*
         * `preview`: ayarlar ekranındaki önizleme masaüstünde de
         * görünmeli, yoksa klavye başındaki oyuncu ayarı kör yapar.
         * CSS seçicisiyle `fine:hidden`'ı ezmek yerine sınıfı hiç
         * eklememek daha sağlam.
         */
        className={`pointer-events-none absolute inset-0 z-10 select-none ${
          preview ? '' : 'fine:hidden'
        } ${disabled ? 'opacity-40' : ''}`}
        style={styleVars}
        aria-hidden={disabled || undefined}
        onPointerDown={unlock}
      >
        <div className="pointer-events-auto absolute bottom-2 left-2 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
          {leftSide}
        </div>
        <div className="pointer-events-auto absolute bottom-2 right-2 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
          {rightSide}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`touch-controls flex w-full max-w-[900px] select-none items-end justify-between gap-3 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] fine:hidden ${
        disabled ? 'pointer-events-none opacity-40' : ''
      }`}
      style={styleVars}
      aria-disabled={disabled || undefined}
      onPointerDown={unlock}
    >
      {dpad}
      {actions}
    </div>
  );
}

function HoldButton({ onInput, action, label, className = '', disabled = false }) {
  const pressedRef = useRef(false);
  const buttonRef = useRef(null);

  const release = useCallback(
    (event) => {
      if (!pressedRef.current) return;
      if (event?.preventDefault) event.preventDefault();
      const el = buttonRef.current ?? event?.currentTarget;
      if (el) {
        el.dataset.pressed = 'false';
        if (event?.pointerId != null && el.hasPointerCapture?.(event.pointerId)) {
          try {
            el.releasePointerCapture(event.pointerId);
          } catch {
            // ignore
          }
        }
      }
      pressedRef.current = false;
      onInput(action, false);
    },
    [action, onInput]
  );

  // Duraklatınca / unmount'ta basılı kalan dokunuşu bırak
  useEffect(() => {
    if (!disabled) return undefined;
    if (pressedRef.current) {
      release();
    }
    return undefined;
  }, [disabled, release]);

  useEffect(
    () => () => {
      if (pressedRef.current) {
        pressedRef.current = false;
        onInput(action, false);
      }
    },
    [action, onInput]
  );

  const press = useCallback(
    (event) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // bazı tarayıcılarda capture başarısız olabilir
      }
      event.currentTarget.dataset.pressed = 'true';
      pressedRef.current = true;
      onInput(action, true);
    },
    [action, onInput, disabled]
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      disabled={disabled}
      className={`touch-button ${className}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
