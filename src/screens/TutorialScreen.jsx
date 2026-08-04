import { useState } from 'react';
import MuteButton from '../components/MuteButton.jsx';
import Sfx from '../game/audio.js';

/** Tutorial adımları — dig → set → spike ritmi ve temel kontroller. */
const STEPS = [
  {
    title: 'MANŞET → PAS → SMAÇ',
    body: 'Sert gelen topa önce manşetle karşılarsın (tuşa basmadan). İkinci temasta Boşluk ile pas, üçüncüde zıpla + vur = smaç. En fazla 3 temas; dördüncüsü faul.',
    accent: '#9BE7FF',
  },
  {
    title: 'DALIŞ KURTARİŞİ',
    body: 'Yetişemeyeceğin topa ↓ / S ile dal. Temas alanı alçalıp genişler; kurtarılan top yakına kalkar. Iskalanan dalış seni kısa süre yerde bırakır — son çare olarak kullan.',
    accent: '#9BE7FF',
  },
  {
    title: 'SULTAN GÜCÜ',
    body: 'Sayı, blok ve ralli barı doldurur. Dolduğunda X ile ateşle: bir sonraki vuruş alevli ve daha hızlı olur, rakip tepkisi yavaşlar.',
    accent: '#FFD24A',
  },
  {
    title: 'SERVİS GÜCÜ',
    body: 'Sayı sonrası servisçi arka çizgide topu tutar. Vuruş tuşuna iki kez bas: 1) güç barını kilitle, 2) nişanı seç. Servis atılmadan ralli başlamaz.',
    accent: '#FFD24A',
  },
  {
    title: 'KOMBO ZİNCİRİ',
    body: 'Smaç, blok ve kurtarış peş peşe gelirse kombo artar. x2’den itibaren ekranda görünür; bar daha hızlı dolar. Sayı alırsan kombo kutlanır, sayı kaybedersen zincir kırılır.',
    accent: '#FF7A18',
  },
  {
    title: 'YEREL 2 OYUNCU',
    body: 'CO-OP: iki sultan aynı takımda AI’ya karşı. VS: P1 sol, P2 sağ. P1 = WASD+SPACE, P2 = Oklar+ENTER. Solo’da her iki şema da P1’e yazar.',
    accent: '#9BB0FF',
  },
  {
    title: 'KONTROLLER',
    body: 'P1: WASD hareket · SPACE vur · S dalış · X Sultan. P2: Oklar · ENTER/Num0 vur · ↓ dalış. ESC / P duraklat. Mobilde dokunmatik P1.',
    accent: '#FFFFFF',
  },
];

/**
 * Nasıl oynanır — ilk açılışta veya menüden.
 */
export default function TutorialScreen({ onDone, onBack, muted, onToggleMute }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = (skipped) => {
    if (skipped) Sfx.select();
    else Sfx.confirm();
    onDone();
  };

  const next = () => {
    if (isLast) {
      finish(false);
      return;
    }
    Sfx.select();
    setStep((s) => s + 1);
  };

  const prev = () => {
    if (step === 0) {
      if (onBack) {
        Sfx.select();
        onBack();
      }
      return;
    }
    Sfx.select();
    setStep((s) => s - 1);
  };

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center gap-5 px-4 pb-28 pt-10 sm:gap-6 sm:pb-10 sm:py-10">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <MuteButton muted={muted} onToggle={onToggleMute} />
      </div>

      <div className="text-center">
        <p className="mb-2 text-[8px] tracking-widest text-retro-accent">NASIL OYNANIR</p>
        <h2 className="text-lg text-turkiye-red text-outline-red sm:text-xl">
          SULTAN REHBERİ
        </h2>
      </div>

      {/* Adım göstergesi */}
      <div className="flex items-center gap-2" aria-hidden="true">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-6 border-2 ${
              i === step
                ? 'border-retro-accent bg-retro-accent'
                : i < step
                  ? 'border-white/50 bg-white/40'
                  : 'border-white/25 bg-transparent'
            }`}
          />
        ))}
      </div>

      <div className="retro-panel w-full px-5 py-6">
        <p className="text-[8px] text-white/40">
          ADIM {step + 1} / {STEPS.length}
        </p>
        <h3
          className="mt-3 text-sm leading-relaxed sm:text-base"
          style={{ color: current.accent }}
        >
          {current.title}
        </h3>
        <p className="mt-4 text-[8px] leading-relaxed text-white/75 sm:text-[9px]">
          {current.body}
        </p>
      </div>

      {/* Sticky CTA — mobilde başparmak erişimi */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-4 border-white/15 bg-retro-bg/95 px-3 py-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 pb-[env(safe-area-inset-bottom)]">
          <div className="flex w-full flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="retro-button-ghost min-h-12 flex-1 px-5 py-3 text-[9px] sm:flex-none"
              onClick={prev}
              disabled={step === 0 && !onBack}
            >
              {step === 0 ? (onBack ? '← GERİ' : '←') : '← ÖNCEKİ'}
            </button>
            <button
              type="button"
              className="retro-button min-h-12 flex-[1.4] px-8 py-3 text-[9px] sm:flex-none"
              onClick={next}
            >
              {isLast ? 'ANLADIM' : 'SONRAKİ →'}
            </button>
          </div>
          <button
            type="button"
            className="min-h-10 px-3 py-2 text-[8px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
            onClick={() => finish(true)}
          >
            ATLA VE MAÇA GEÇ
          </button>
        </div>
      </div>
    </div>
  );
}
