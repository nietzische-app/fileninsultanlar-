import { useCallback, useEffect, useRef } from 'react';
import Sfx from '../game/audio.js';
import GameIcon from './GameIcon.jsx';

/** Yön tuşundan bu kadar px aşağı kaydırınca dalış tetiklenir. */
const DIVE_DRAG = 26;

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
  disabled = false,
  overlay = false,
  strip = false,
  settings = { scale: 1, opacity: 0.85, swap: false },
  preview = false,
  dimWhenDisabled = true,
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
  /*
   * `dimWhenDisabled=false`: maç içi ayar katmanı açıkken tuşlar
   * girdiyi almaz ama SÖNMEZ — oyuncu kaydırıcıyı çekerken gerçek
   * tuşların değiştiğini görebilsin diye. Sönük tuşlara bakarak boyut
   * ayarlamak kör ayar olurdu.
   */
  const dim = disabled && dimWhenDisabled;
  const styleVars = {
    '--touch-scale': settings.scale ?? 1,
    opacity: dim ? undefined : (settings.opacity ?? 0.85),
  };

  /*
   * Yön tuşları dalışı da taşır: parmağını tuştan AŞAĞI kaydırırsan
   * karakter o yöne dalar.
   *
   * Ayrı bir DAL tuşu vardı ve kullanılamıyordu — dalış yetişilemeyen
   * topa son çare olarak yapılır, yani zaten koşarken. Başparmağı yön
   * tuşundan kaldırıp DAL'a götürmek hem yönü hem zamanlamayı
   * kaybettiriyordu. Kaydırma hareketinde yön zaten basılı kalıyor
   * (`startDive` yönü input'tan okuyor) ve parmak hiç kopmuyor.
   */
  const left = (
    <HoldButton
      onInput={onInput}
      action="left"
      label={<GameIcon name="ArrowLeft" size="45%" />}
      srLabel="Sola git"
      hint="Aşağı kaydır: dalış"
      disabled={disabled}
      dragDive
      className={`tb-dir ${buttonTone}`}
    />
  );
  const right = (
    <HoldButton
      onInput={onInput}
      action="right"
      label={<GameIcon name="ArrowRight" size="45%" />}
      srLabel="Sağa git"
      hint="Aşağı kaydır: dalış"
      disabled={disabled}
      dragDive
      className={`tb-dir ${buttonTone}`}
    />
  );
  const hit = (
    /* Pakette vuruş/smaç için uygun ikon yok; yazı en anlaşılırı */
    <HoldButton
      onInput={onInput}
      action="action"
      label={<span className="tb-label">VUR</span>}
      srLabel="Vur"
      disabled={disabled}
      className={`tb-act ${buttonTone}`}
    />
  );
  const jump = (
    <HoldButton
      onInput={onInput}
      action="up"
      label={<GameIcon name="ArrowRight" size="48%" rotate={-90} />}
      srLabel="Zıpla"
      disabled={disabled}
      className={`tb-jump ${buttonTone}`}
    />
  );

  /*
   * DAL kalkınca yön grubu tek sıraya indi ve her düzende aynı: iki ok.
   * Dalış artık bu okların üstündeki kaydırma hareketiyle yapılıyor.
   */
  const dpad = (
    <div className="tb-gap flex items-center">
      {left}
      {right}
    </div>
  );

  const actions = (
    <div className={`flex gap-2 ${strip ? 'items-center' : 'items-end'}`}>
      {hit}
      {jump}
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
        } ${dim ? 'opacity-40' : ''}`}
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

  if (strip) {
    // `swap`: yön tuşları sağa, aksiyonlar sola — solaklar için
    const stripLeft = settings.swap ? actions : dpad;
    const stripRight = settings.swap ? dpad : actions;

    return (
      <div
        className={`control-strip flex select-none items-center justify-between gap-3 ${
          preview ? '' : 'fine:hidden'
        } ${disabled ? 'pointer-events-none' : ''} ${dim ? 'opacity-40' : ''}`}
        style={styleVars}
        aria-disabled={disabled || undefined}
        onPointerDown={unlock}
      >
        {stripLeft}
        {stripRight}
      </div>
    );
  }

  return (
    <div
      className={`touch-controls flex w-full max-w-[900px] select-none items-end justify-between gap-3 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] fine:hidden ${
        disabled ? 'pointer-events-none' : ''
      } ${dim ? 'opacity-40' : ''}`}
      style={styleVars}
      aria-disabled={disabled || undefined}
      onPointerDown={unlock}
    >
      {dpad}
      {actions}
    </div>
  );
}

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.label Tuşun içeriği (ikon ya da yazı)
 * @param {string} [props.srLabel] Ekran okuyucu etiketi. İkonlu tuşlarda
 *   şart: `label` artık bir React elemanı, doğrudan `aria-label`'a
 *   verilseydi "[object Object]" olarak okunurdu.
 */
function HoldButton({
  onInput,
  action,
  label,
  srLabel,
  hint,
  className = '',
  disabled = false,
  dragDive = false,
}) {
  const pressedRef = useRef(false);
  const buttonRef = useRef(null);
  const originRef = useRef(null);
  const divingRef = useRef(false);

  /** Dalışı bırak (tuş bırakılırken ya da parmak yukarı dönerken). */
  const endDive = useCallback(() => {
    if (!divingRef.current) return;
    divingRef.current = false;
    onInput('dive', false);
    const el = buttonRef.current;
    if (el) el.dataset.diving = 'false';
  }, [onInput]);

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
      originRef.current = null;
      endDive();
      onInput(action, false);
    },
    [action, onInput, endDive]
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
      originRef.current = { x: event.clientX, y: event.clientY };
      onInput(action, true);
    },
    [action, onInput, disabled]
  );

  /*
   * Aşağı kaydırma = dalış.
   *
   * Eşik yalnızca DİKEY mesafeye bakıyor; yatay yön zaten hangi tuşa
   * basıldığından belli (`startDive` yönü input'tan okuyor) ve tuş
   * kaydırma boyunca basılı kalıyor — yani hareket doğal olarak çapraz.
   * Yatay bileşen de şart koşulsaydı tam dikey çeken parmak dalamazdı.
   *
   * Parmak yukarı dönerse dalış bırakılır: yanlışlıkla tetiklenen bir
   * kaydırmadan geri dönülebilsin.
   */
  const move = useCallback(
    (event) => {
      if (!dragDive || !pressedRef.current || disabled) return;
      const origin = originRef.current;
      if (!origin) return;

      const dy = event.clientY - origin.y;
      if (!divingRef.current && dy >= DIVE_DRAG) {
        divingRef.current = true;
        event.currentTarget.dataset.diving = 'true';
        onInput('dive', true);
      } else if (divingRef.current && dy < DIVE_DRAG * 0.5) {
        endDive();
      }
    },
    [dragDive, disabled, onInput, endDive]
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      /*
       * Erişilebilir isim KISA tutulur ("Sola git"); kaydırma ipucu
       * ayrı `title`'a gider. İpucu ismin içine yazıldığında ekran
       * okuyucu her basışta uzun cümleyi okuyor ve tuşun kimliği
       * kayboluyordu.
       */
      aria-label={srLabel ?? (typeof label === 'string' ? label : undefined)}
      title={hint}
      disabled={disabled}
      className={`touch-button ${className}`}
      onPointerDown={press}
      onPointerMove={dragDive ? move : undefined}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
