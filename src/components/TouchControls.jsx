import { useCallback, useEffect, useRef } from 'react';
import Sfx from '../game/audio.js';

/**
 * Mobil / dokunmatik cihazlar için ekran üstü kontroller.
 *
 * Overlay modunda sahanın köşelerine binen şeffaf konsol düzeni:
 * sol D-pad (◀ ▶ + dalış), sağda dairesel A (vur) / B (zıpla) ve
 * hazırken Sultan tuşu.
 *
 * Pointer capture ile çoklu dokunuş desteklenir. `pointerleave`
 * bilerek yok — kaydırırken tuşun erken bırakılmasını önler.
 */
export default function TouchControls({
  onInput,
  sultanReady,
  disabled = false,
  overlay = false,
}) {
  const unlock = () => {
    if (!disabled) Sfx.unlock();
  };

  const dpad = (
    <div className="touch-dpad flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <HoldButton
          onInput={onInput}
          action="left"
          label="◀"
          ariaLabel="Sola"
          disabled={disabled}
          className={overlay ? 'touch-pad-btn' : 'h-[3.5rem] w-[3.5rem] text-2xl'}
        />
        <HoldButton
          onInput={onInput}
          action="right"
          label="▶"
          ariaLabel="Sağa"
          disabled={disabled}
          className={overlay ? 'touch-pad-btn' : 'h-[3.5rem] w-[3.5rem] text-2xl'}
        />
      </div>
      <HoldButton
        onInput={onInput}
        action="dive"
        label="↓"
        ariaLabel="Dalış"
        disabled={disabled}
        className={overlay ? 'touch-pad-btn touch-pad-btn-wide' : 'h-11 w-full min-w-[7.25rem] text-[9px]'}
      />
    </div>
  );

  const actions = overlay ? (
    <div className="touch-ab flex items-end gap-3">
      <div className="flex flex-col items-center gap-2">
        {sultanReady && (
          <HoldButton
            onInput={onInput}
            action="sultan"
            label="S"
            ariaLabel="Sultan Gücü"
            disabled={disabled}
            className="touch-circle touch-circle-sultan animate-pulse-gold"
          />
        )}
        <HoldButton
          onInput={onInput}
          action="action"
          label="A"
          ariaLabel="Vur / Servis / Smaç"
          disabled={disabled}
          className="touch-circle touch-circle-a"
          caption="VUR"
        />
      </div>
      <HoldButton
        onInput={onInput}
        action="up"
        label="B"
        ariaLabel="Zıpla"
        disabled={disabled}
        className="touch-circle touch-circle-b"
        caption="ZIPLA"
      />
    </div>
  ) : (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-2">
        <HoldButton
          onInput={onInput}
          action="sultan"
          label="SULTAN"
          disabled={disabled}
          className={`h-11 w-[3.25rem] text-[7px] ${
            sultanReady ? 'animate-pulse-gold border-retro-accent bg-turkiye-red' : ''
          }`}
        />
        <HoldButton
          onInput={onInput}
          action="action"
          label="VUR"
          disabled={disabled}
          className="h-[3.5rem] w-[3.25rem] text-[9px]"
        />
      </div>
      <HoldButton
        onInput={onInput}
        action="up"
        label="ZIPLA"
        disabled={disabled}
        className="h-[6.75rem] w-[4rem] text-[9px]"
      />
    </div>
  );

  if (overlay) {
    return (
      <div
        className={`touch-overlay pointer-events-none absolute inset-0 z-10 select-none ${
          disabled ? 'opacity-40' : ''
        }`}
        aria-hidden={disabled || undefined}
        onPointerDown={unlock}
      >
        <div className="pointer-events-auto absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.5rem,env(safe-area-inset-left))]">
          {dpad}
        </div>
        <div className="pointer-events-auto absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] right-[max(0.5rem,env(safe-area-inset-right))]">
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`touch-controls flex w-full max-w-[900px] select-none items-end justify-between gap-3 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] ${
        disabled ? 'pointer-events-none opacity-40' : ''
      }`}
      aria-disabled={disabled || undefined}
      onPointerDown={unlock}
    >
      {dpad}
      {actions}
    </div>
  );
}

function HoldButton({
  onInput,
  action,
  label,
  ariaLabel,
  className = '',
  disabled = false,
  caption,
}) {
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
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      className={`touch-button ${className}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onTouchMove={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="touch-button-label">{label}</span>
      {caption ? <span className="touch-button-caption">{caption}</span> : null}
    </button>
  );
}
