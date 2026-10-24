import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TouchControls from './TouchControls.jsx';
import TouchDrag from './TouchDrag.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const AYAR = { scale: 1, opacity: 1, gap: 1, swap: false, scheme: 'buttons' };

/** @type {import('react-dom/client').Root[]} */
const kokler = [];

afterEach(() => {
  while (kokler.length) {
    const root = kokler.pop();
    act(() => root.unmount());
  }
  document.body.innerHTML = '';
});

function yerlestir(ui) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  kokler.push(root);
  act(() => root.render(ui));
  return { host, root };
}

function isaret(el, type, { pointerId = 1, clientX = 0, clientY = 0 } = {}) {
  /*
   * jsdom'da PointerEvent yok. React işaretçi dinleyicisi olayın
   * türüne ve `pointerId` alanına bakıyor; MouseEvent yeterli.
   */
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  act(() => {
    el.dispatchEvent(event);
  });
}

describe('kontrol tipi', () => {
  it('buton düzeninde oklar durur', () => {
    const { host } = yerlestir(
      <TouchControls onInput={() => {}} strip preview settings={AYAR} />,
    );
    expect(host.querySelector('[aria-label="Sola git"]')).toBeTruthy();
    expect(host.querySelector('[aria-label="Sağa git"]')).toBeTruthy();
    expect(host.querySelector('.control-strip').className).not.toContain('pointer-events-none');
  });

  it('serbest sürüklemede oklar gider, vuruş ve zıplama sağda kalır', () => {
    const { host } = yerlestir(
      <TouchControls
        onInput={() => {}}
        strip
        preview
        settings={{ ...AYAR, scheme: 'drag' }}
      />,
    );
    const strip = host.querySelector('.control-strip');
    expect(host.querySelector('[aria-label="Sola git"]')).toBeNull();
    expect(host.querySelector('[aria-label="Sağa git"]')).toBeNull();
    expect(host.querySelector('[aria-label="Vur"]')).toBeTruthy();
    expect(host.querySelector('[aria-label="Zıpla"]')).toBeTruthy();
    expect(strip.className).toContain('pointer-events-none');
    expect(host.querySelector('[aria-label="Vur"]').className).toContain('pointer-events-auto');
    const [sol, sag] = strip.children;
    expect(sol.querySelector('button')).toBeNull();
    expect(sol.getAttribute('data-drag-track')).toBe('');
    expect(sag.querySelector('[aria-label="Vur"]')).toBeTruthy();
    expect(sol.style.opacity).toBe('0.3');
  });

  it('solak düzende vuruş solda kalır', () => {
    const { host } = yerlestir(
      <TouchControls
        onInput={() => {}}
        strip
        preview
        settings={{ ...AYAR, scheme: 'drag', swap: true }}
      />,
    );
    const [sol, sag] = host.querySelector('.control-strip').children;
    expect(sol.querySelector('[aria-label="Vur"]')).toBeTruthy();
    expect(sag.querySelector('button')).toBeNull();
    expect(sag.getAttribute('data-drag-track')).toBe('');
  });
});

describe('TouchDrag', () => {
  function sahne(props) {
    const calls = [];
    const { host, root } = yerlestir(
      <TouchDrag onInput={(name, pressed, slot) => calls.push([name, pressed, slot])} {...props} />,
    );
    const el = host.querySelector('.touch-drag');
    el.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 200,
      height: 120,
      right: 200,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON() { return {}; },
    });
    return { calls, el, root, host };
  }

  it('sağa kayınca sağ açılır, parmak kalkınca kapanır', () => {
    const { calls, el } = sahne();
    isaret(el, 'pointerdown', { clientX: 40, clientY: 30 });
    isaret(el, 'pointermove', { clientX: 44, clientY: 30 });
    expect(calls).toEqual([]);
    isaret(el, 'pointermove', { clientX: 52, clientY: 30 });
    expect(calls).toEqual([['right', true, 'p1']]);
    isaret(el, 'pointerup', { clientX: 52, clientY: 30 });
    expect(calls).toEqual([['right', true, 'p1'], ['right', false, 'p1']]);
  });

  it('aşağı kaydırınca dalış, bırakınca ikisi de kapanır', () => {
    const { calls, el } = sahne();
    isaret(el, 'pointerdown', { clientX: 40, clientY: 20 });
    isaret(el, 'pointermove', { clientX: 60, clientY: 50 });
    expect(calls).toEqual([['right', true, 'p1'], ['dive', true, 'p1']]);
    isaret(el, 'pointerup', { clientX: 60, clientY: 50 });
    expect(calls.filter((c) => c[1] === false)).toEqual([
      ['right', false, 'p1'],
      ['dive', false, 'p1'],
    ]);
  });

  it('çift oyunculuda sağ yarı ikinci oyuncu, aynı yuvaya ikinci parmak yazmaz', () => {
    const { calls, el } = sahne({ dual: true });
    isaret(el, 'pointerdown', { pointerId: 1, clientX: 160, clientY: 40 });
    isaret(el, 'pointermove', { pointerId: 1, clientX: 180, clientY: 40 });
    isaret(el, 'pointerdown', { pointerId: 2, clientX: 170, clientY: 50 });
    isaret(el, 'pointermove', { pointerId: 2, clientX: 140, clientY: 50 });
    expect(calls).toEqual([['right', true, 'p2']]);
  });

  it('duraklatılınca basılı yönü bırakır', () => {
    const calls = [];
    const onInput = (name, pressed, slot) => calls.push([name, pressed, slot]);
    const { el, root } = sahne({ onInput });
    isaret(el, 'pointerdown', { clientX: 20, clientY: 20 });
    isaret(el, 'pointermove', { clientX: 40, clientY: 20 });
    expect(calls).toContainEqual(['right', true, 'p1']);
    act(() => root.render(<TouchDrag onInput={onInput} disabled />));
    expect(calls).toContainEqual(['right', false, 'p1']);
  });

  it('kaydırma ipucu iki saniye durur, sonra solar', () => {
    vi.useFakeTimers();
    try {
      const { host } = yerlestir(<TouchDrag onInput={() => {}} />);
      expect(host.querySelector('.drag-hint')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(host.querySelector('.drag-hint').className).toContain('is-out');
      act(() => { vi.advanceTimersByTime(400); });
      expect(host.querySelector('.drag-hint')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('halka parmağı izler, kalkınca kaybolur', () => {
    const { calls, el, host } = sahne();
    expect(host.querySelector('.drag-hint')).toBeTruthy();
    expect(host.querySelector('[data-drag-ring]')).toBeNull();
    isaret(el, 'pointerdown', { clientX: 40, clientY: 30 });
    const halka = host.querySelector('[data-drag-ring]');
    expect(halka).toBeTruthy();
    expect(halka.style.left).toBe('40px');
    expect(halka.style.top).toBe('30px');
    isaret(el, 'pointermove', { clientX: 70, clientY: 36 });
    expect(host.querySelector('[data-drag-ring]').style.left).toBe('70px');
    expect(host.querySelector('[data-drag-ring]').style.top).toBe('36px');
    isaret(el, 'pointerup', { clientX: 70, clientY: 36 });
    expect(host.querySelector('[data-drag-ring]')).toBeNull();
    expect(calls.map((c) => c[0])).toContain('right');
  });
});
