import { AudioSettings, ControlSettings } from '../components/SettingsPanels.jsx';
import Sfx from '../game/audio.js';
import { gizlilikBaglantisi, yerelKabukMu } from '../utils/gizlilik.js';
import { t } from '../i18n/index.js';
import DilSecici from '../i18n/DilSecici.jsx';

/**
 * Ayarlar ekranı — menüden açılan tam sayfa hâli.
 *
 * Bölümlerin kendisi `SettingsPanels` içinde; maç içindeki duraklatma
 * katmanı da aynı bileşenleri kullanıyor, böylece iki yer ayrışmıyor.
 */
export default function SettingsScreen({
  onBack,
  muted,
  onToggleMute,
  musicVolume,
  onMusicVolume,
  sfxVolume,
  onSfxVolume,
  controls,
  onControls,
  onReset,
  onTutorial,
}) {
  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg text-turkiye-red text-outline-red sm:text-2xl">{t('settings.title')}</h1>
          <p className="mt-1 text-[7px] tracking-widest text-white/40">
            {t('settings.saved')}
          </p>
        </div>
        <button type="button" className="retro-button-ghost px-4 py-2 text-[8px]" onClick={onBack}>
          {t('nav.back')}
        </button>
      </header>

      <section className="retro-panel px-5 py-4">
        <h2 className="mb-4 text-[8px] tracking-widest text-retro-accent">{t('lang.section')}</h2>
        <p className="mb-4 text-[7px] leading-relaxed text-white/45">{t('lang.hint')}</p>
        <DilSecici />
      </section>

      <section className="retro-panel px-5 py-4">
        <h2 className="mb-4 text-[8px] tracking-widest text-retro-accent">{t('settings.audio')}</h2>
        <AudioSettings
          muted={muted}
          onToggleMute={onToggleMute}
          musicVolume={musicVolume}
          onMusicVolume={onMusicVolume}
          sfxVolume={sfxVolume}
          onSfxVolume={onSfxVolume}
        />
      </section>

      <section className="retro-panel px-5 py-4">
        <h2 className="mb-1 text-[8px] tracking-widest text-retro-accent">
          {t('settings.touch')}
        </h2>
        <p className="mb-4 text-[7px] leading-relaxed text-white/45">
          {t('settings.touchHint')}
        </p>
        <ControlSettings controls={controls} onControls={onControls} />
      </section>

      {onTutorial && (
        <section className="retro-panel px-5 py-4">
          <h2 className="mb-3 text-[8px] tracking-widest text-retro-accent">{t('tut.kicker')}</h2>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[7px] leading-relaxed text-white/45">
              {t('tut.replayHint')}
            </p>
            <button
              type="button"
              className="retro-button-ghost shrink-0 px-4 py-2 text-[8px]"
              onClick={() => {
                Sfx.select();
                onTutorial();
              }}
            >
              {t('tut.replay')}
            </button>
          </div>
        </section>
      )}

      <section className="retro-panel px-5 py-4">
        <h2 className="mb-3 text-[8px] tracking-widest text-retro-accent">{t('settings.reset')}</h2>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[7px] leading-relaxed text-white/45">
            {t('settings.resetHint')}
          </p>
          <button
            type="button"
            className="retro-button-ghost shrink-0 px-4 py-2 text-[8px]"
            onClick={() => {
              Sfx.select();
              onReset();
            }}
          >
            {t('settings.defaults')}
          </button>
        </div>
      </section>

      {/*
        Gizlilik politikası bağlantısı.

        Mağazalar politikanın hem listelemede hem UYGULAMA İÇİNDE
        erişilebilir olmasını bekliyor. Ayrı bir statik sayfa
        (`public/gizlilik.html`) — oyunun paketini yüklemesi
        gerekmiyor ve oyunda bir hata olsa bile açılıyor.

        Nasıl açılacağı platforma göre değişiyor; sebebi
        `src/utils/gizlilik.js` başında yazılı (kısaca: WebView yeni
        sekme açamıyor ve `_blank` orada ölü bir düğme olurdu).
      */}
      <p className="text-center text-[7px] leading-relaxed text-white/35">
        <a className="underline hover:text-white/70" {...gizlilikBaglantisi(yerelKabukMu())}>
          {t('settings.privacy')}
        </a>
      </p>

      {/*
        YAPI DAMGASI.

        Sebebi yaşanmış bir teşhis çıkmazı: çevrimiçi gecikme
        düzeltildi, oyuncu "hâlâ aynı" dedi ve hangi tarafın eski kodda
        olduğunu kimse söyleyemedi — istemciyi Vercel kendiliğinden
        dağıtıyor, röleyi elle dağıtıyoruz. Röleye `/saglik` damgası
        konuldu; bu satır aynı sorunun istemci yarısı.

        TELEFONDA görünür olması şart: hata bildiren oyuncu telefonda ve
        orada geliştirici konsolu yok. Ayarlar ekranının dibi, kimseyi
        rahatsız etmeyen ama sorulduğunda okunabilen yer.
      */}
      <p className="text-center text-[6px] tracking-widest text-white/20">
        {t('settings.build', { v: __SURUM__ })}
      </p>
    </div>
  );
}
