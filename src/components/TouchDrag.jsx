import { useCallback, useEffect, useRef, useState } from 'react';
import { suruklemeGirdisi, yuvaSec } from '../game/surukleme.js';
import { t } from '../i18n/index.js';
import { SwipeHint } from './SuruklemeGosterge.jsx';

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
  /** @type {import('react').MutableRefObject<Map<number, {slot: 'p1'|'p2', x: number, y: number, cx: number, cy: number, left: boolean, right: boolean, dive: boolean}>>} */
  const parmaklar = useRef(new Map());
  const [halkalar, setHalkalar] = useState([]);

  const ciz = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      setHalkalar([]);
      return;
    }
    const rect = root.getBoundingClientRect();
    setHalkalar([...parmaklar.current.entries()].map(([id, p]) => ({
      id,
      x: p.cx - rect.left,
      y: p.cy - rect.top,
    })));
  }, []);

  /*
   * Girdiyi kapatır. Görseli ayrıca çizmek çağıranın işi: sökülürken
   * halkayı güncellemek, kalkan bileşene durum yazmak olurdu.
   */
  const girdiyiKapat = useCallback(
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

  const birak = useCallback(
    (id) => {
      girdiyiKapat(id);
      ciz();
    },
    [girdiyiKapat, ciz],
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
    [...parmaklar.current.keys()].forEach((id) => girdiyiKapat(id));
  }, [girdiyiKapat]);

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
      cx: event.clientX,
      cy: event.clientY,
      left: false,
      right: false,
      dive: false,
    });
    ciz();
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
    p.cx = event.clientX;
    p.cy = event.clientY;
    ciz();
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
    <>
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
      {/*
        Halka şeridin ÜSTÜNDE durmalı: şerit z-10 ve dolgusu opak.
        Bu katman tıklama almaz; vuruş ve zıplama altta kalır.
      */}
      <div className="pointer-events-none absolute inset-0 z-[12] fine:hidden">
        {halkalar.map((h) => (
          <span
            key={h.id}
            className="drag-ring"
            data-drag-ring=""
            style={{ left: h.x, top: h.y }}
          />
        ))}
        {!disabled && <SwipeHint />}
      </div>
    </>
  );
}
