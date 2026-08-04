import { useCallback, useRef } from 'react';
import Sfx from '../game/audio.js';

/**
 * Mobil cihazlar için ekran üstü kontroller.
 *
 * Pointer capture ile çoklu dokunuş desteklenir (ör. sol + zıpla).
 * `pointerleave` bilerek yok — kaydırırken tuşun erken bırakılmasını
 * ve bazı mobil tarayıcılarda takılı kalmayı önler.
 */
export default function TouchControls({ onInput, sultanReady }) {
  return (
    <div
      className="touch-controls flex w-full max-w-[900px] select-none items-end justify-between gap-3 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
      onPointerDown={() => Sfx.unlock()}
    >
      {/* Sol: hareket + dalış */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <HoldButton onInput={onInput} action="left" label="◀" className="h-[3.75rem] w-[3.75rem] text-2xl" />
          <HoldButton onInput={onInput} action="right" label="▶" className="h-[3.75rem] w-[3.75rem] text-2xl" />
        </div>
        <HoldButton
          onInput={onInput}
          action="dive"
          label="DAL"
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
            className={`h-12 w-[3.5rem] text-[7px] ${
              sultanReady ? 'animate-pulse-gold border-retro-accent bg-turkiye-red' : ''
            }`}
          />
          <HoldButton
            onInput={onInput}
            action="action"
            label="VUR"
            className="h-[3.75rem] w-[3.5rem] text-[9px]"
          />
        </div>
        <HoldButton
          onInput={onInput}
          action="up"
          label="ZIPLA"
          className="h-[7.25rem] w-[4.25rem] text-[9px]"
        />
      </div>
    </div>
  );
}

function HoldButton({ onInput, action, label, className = '' }) {
  const pressedRef = useRef(false);

  const press = useCallback(
    (event) => {
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
    [action, onInput]
  );

  const release = useCallback(
    (event) => {
      if (!pressedRef.current) return;
      event.preventDefault();
      event.currentTarget.dataset.pressed = 'false';
      pressedRef.current = false;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }
      onInput(action, false);
    },
    [action, onInput]
  );

  return (
    <button
      type="button"
      aria-label={label}
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
