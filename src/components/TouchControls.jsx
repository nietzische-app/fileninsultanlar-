import { useCallback, useRef } from 'react';

/**
 * Mobil cihazlar için ekran üstü kontroller.
 *
 * Pointer olaylarını motorun `setInput` API'sine bağlar. Parmak
 * butondan kayarsa tuş takılı kalmasın diye pointer capture ve
 * pointercancel/pointerleave da dinlenir.
 */
export default function TouchControls({ onInput, sultanReady }) {
  return (
    <div className="flex w-full max-w-[900px] select-none items-end justify-between gap-4 md:hidden">
      {/* Sol: hareket */}
      <div className="flex gap-3">
        <HoldButton onInput={onInput} action="left" label="◀" className="h-16 w-16 text-xl" />
        <HoldButton onInput={onInput} action="right" label="▶" className="h-16 w-16 text-xl" />
      </div>

      {/* Sağ: aksiyon */}
      <div className="flex items-end gap-3">
        <HoldButton
          onInput={onInput}
          action="sultan"
          label="SULTAN"
          className={`h-14 w-16 text-[7px] ${
            sultanReady ? 'animate-pulse-gold border-retro-accent bg-turkiye-red' : ''
          }`}
        />
        <HoldButton
          onInput={onInput}
          action="action"
          label="VUR"
          className="h-16 w-16 text-[9px]"
        />
        <HoldButton
          onInput={onInput}
          action="up"
          label="ZIPLA"
          className="h-20 w-20 text-[9px]"
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
      event.currentTarget.setPointerCapture?.(event.pointerId);
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
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
