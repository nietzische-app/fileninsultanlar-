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
 */
export default function TouchControls({ onInput, sultanReady, disabled = false }) {
  return (
    <div
      className={`touch-controls flex w-full max-w-[900px] select-none items-end justify-between gap-3 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden ${
        disabled ? 'pointer-events-none opacity-40' : ''
      }`}
      aria-disabled={disabled || undefined}
      onPointerDown={() => {
        if (!disabled) Sfx.unlock();
      }}
    >
      {/* Sol: hareket + dalış */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <HoldButton
            onInput={onInput}
            action="left"
            label="◀"
            disabled={disabled}
            className="h-[3.75rem] w-[3.75rem] text-2xl"
          />
          <HoldButton
            onInput={onInput}
            action="right"
            label="▶"
            disabled={disabled}
            className="h-[3.75rem] w-[3.75rem] text-2xl"
          />
        </div>
        <HoldButton
          onInput={onInput}
          action="dive"
          label="DAL"
          disabled={disabled}
          className="h-12 w-full min-w-[7.75rem] text-[9px]"
        />
      </div>

      {/* Sağ: aksiyonlar */}
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-2">
          <HoldButton
            onInput={onInput}
            action="sultan"
            label="SULTAN"
            disabled={disabled}
            className={`h-12 w-[3.5rem] text-[7px] ${
              sultanReady ? 'animate-pulse-gold border-retro-accent bg-turkiye-red' : ''
            }`}
          />
          <HoldButton
            onInput={onInput}
            action="action"
            label="VUR"
            disabled={disabled}
            className="h-[3.75rem] w-[3.5rem] text-[9px]"
          />
        </div>
        <HoldButton
          onInput={onInput}
          action="up"
          label="ZIPLA"
          disabled={disabled}
          className="h-[7.25rem] w-[4.25rem] text-[9px]"
        />
      </div>
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
