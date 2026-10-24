import { useCallback, useEffect, useRef } from 'react';
import { suruklemeGirdisi, yuvaSec } from '../game/surukleme.js';
import { t } from '../i18n/index.js';

/**
 * Sahada parmak sürükleyerek yürüme.
 *
 * Yön ve vuruş tuşlarının ÜSTÜNE binmez: o tuşlar `pointer-events-auto`
 * ile bu katmanın üstünde durur, boş sahaya basılan parmak buraya gelir.
 * Parmak kalkınca yatay yön kapanır — basılı kalan bir ok tuşu gibi
 * karakterin koşmaya devam etmemesi için.
 *
 * @param {object} props
 * @param {(action: string, pressed: boolean, slot?: 'p1'|'p2') => void} props.onInput
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.dual] Sol yarı 1. oyuncu, sağ yarı 2. oyuncu
 */
export default function TouchDrag({ onInput, disabled = false, dual = false }) {
  const rootRef = useRef(null);
  /** @type {import('react').MutableRefObject<Map<number, {slot: 'p1'|'p2', x: number, y: number, left: boolean, right: boolean, dive: boolean}>>} */
  const parmaklar = useRef(new Map());

  const birak = useCallback(
    (id) => {
      const p = parmaklar.current.get(id);
      if (!p) return;
      parmaklar.current.delete(id);
      if (p.left) onInput('left', false, p.slot);
      if (p.right) onInput('right', false, p.slot);
      if (p.dive) onInput('dive', false, p.slot);
    },
    [onInput],
  );

  const hepsiniBirak = useCallback(() => {
    const el = rootRef.current;
    [...parmaklar.current.keys()].forEach((id) => {
      if (el?.hasPointerCapture?.(id)) {
        try {
          el.releasePointerCapture(id);
        } catch {
          // ignore
        }
      }
      birak(id);
    });
  }, [birak]);

  useEffect(() => {
    if (!disabled) return undefined;
    hepsiniBirak();
    return undefined;
  }, [disabled, hepsiniBirak]);

  useEffect(() => () => {
    [...parmaklar.current.keys()].forEach((id) => birak(id));
  }, [birak]);

  const bas = (event) => {
    if (disabled) return;
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const slot = yuvaSec(event.clientX - rect.left, rect.width, dual);
    for (const p of parmaklar.current.values()) {
      if (p.slot === slot) return;
    }
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // bazı tarayıcılarda capture olmaz; move yine de gelir
    }
    parmaklar.current.set(event.pointerId, {
      slot,
      x: event.clientX,
      y: event.clientY,
      left: false,
      right: false,
      dive: false,
    });
  };

  const kaydir = (event) => {
    const p = parmaklar.current.get(event.pointerId);
    if (!p || disabled) return;
    event.preventDefault();
    const sonraki = suruklemeGirdisi(event.clientX - p.x, event.clientY - p.y, p);
    if (sonraki.left !== p.left) onInput('left', sonraki.left, p.slot);
    if (sonraki.right !== p.right) onInput('right', sonraki.right, p.slot);
    if (sonraki.dive !== p.dive) onInput('dive', sonraki.dive, p.slot);
    p.left = sonraki.left;
    p.right = sonraki.right;
    p.dive = sonraki.dive;
  };

  const kaldir = (event) => {
    if (event?.pointerId == null) return;
    const el = rootRef.current;
    if (el?.hasPointerCapture?.(event.pointerId)) {
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
    birak(event.pointerId);
  };

  return (
    <div
      ref={rootRef}
      className={`touch-drag absolute inset-0 z-[8] touch-none fine:hidden ${
        disabled ? 'pointer-events-none' : ''
      }`}
      style={{ touchAction: 'none' }}
      aria-label={t('touch.dragAria')}
      onPointerDown={bas}
      onPointerMove={kaydir}
      onPointerUp={kaldir}
      onPointerCancel={kaldir}
      onLostPointerCapture={kaldir}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
