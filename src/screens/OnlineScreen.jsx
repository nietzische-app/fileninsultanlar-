import { useCallback, useEffect, useRef, useState } from 'react';
import Sfx from '../game/audio.js';
import { Baglanti, hataMetni } from '../net/baglanti.js';
import { KOD_UZUNLUK } from '../../sunucu/protokol.js';
import { upper } from '../utils/text.js';

/**
 * Çevrimiçi lobi — oda aç ya da koda gir.
 *
 * Maçı odayı AÇAN taraf simüle eder; katılan taraf onun ürettiği
 * durumu çizer ve tuşlarını yollar. Bu yüzden maç ayarları (sultan,
 * rakip takım, format) açanın seçimidir ve eşleşme anında karşıya
 * gönderilir — iki taraf aynı kadroyu kurmazsa aynı maçı çizemezler.
 *
 * Ekran üç durumdan birinde: seçim, bekleme, hata. Ayrı bir "bağlanıyor"
 * durumu var çünkü ücretsiz barındırmada ilk bağlantı uykudan uyanmayı
 * bekleyebiliyor ve donmuş bir ekran gibi görünüyordu.
 */

const DURUM = {
  secim: 'secim',
  baglaniyor: 'baglaniyor',
  bekliyor: 'bekliyor',
  kodGir: 'kod-gir',
  hata: 'hata',
};

export default function OnlineScreen({ config, onStart, onBack }) {
  const [durum, setDurum] = useState(DURUM.secim);
  const [kod, setKod] = useState('');
  const [girilenKod, setGirilenKod] = useState('');
  const [hata, setHata] = useState(null);

  const baglantiRef = useRef(null);
  const configRef = useRef(config);
  configRef.current = config;
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  /** Bağlantıyı kur ve olayları bağla — iki yol da (aç/gir) buradan geçer. */
  const baglan = useCallback(async () => {
    if (baglantiRef.current) return baglantiRef.current;
    const baglanti = new Baglanti();
    baglantiRef.current = baglanti;

    baglanti.on('hata', (mesaj) => {
      setHata(hataMetni(mesaj.sebep));
      setDurum(DURUM.hata);
    });

    baglanti.on('kapandi', () => {
      // Maç başladıysa MatchScreen ilgileniyor; lobide isek haber ver
      setHata(hataMetni('koptu'));
      setDurum((onceki) => (onceki === DURUM.secim ? onceki : DURUM.hata));
    });

    /*
     * Eşleşince odayı açan taraf maçı İSTER, ama kurmaz — maçı sunucu
     * koşturuyor. Ayarlar yine açanın seçimi (kadro, rakip, format);
     * sunucu bunları kesinleştirip iki tarafa da aynısını yolluyor.
     */
    baglanti.on('eslesme', (mesaj) => {
      if (mesaj.rol !== 'ev') return;
      const c = configRef.current;
      baglanti.yolla({
        t: 'mac-basla',
        cfg: {
          mode: c.mode,
          homeIds: c.homeIds,
          // Boşsa rakibi sunucu seçer ve ikimize de aynısını bildirir
          opponentId: c.opponentId,
          format: c.format,
          difficulty: c.difficulty,
        },
      });
    });

    /*
     * Maç kuruldu. Artık İKİ taraf da misafir: simülasyon sunucuda,
     * ikimiz de çiziyor ve tuşlarımızı yolluyoruz. `yuva` hangi
     * oyuncuyu sürdüğümüzü söylüyor — sahada kimin biz olduğunu
     * göstermek için gerekli.
     */
    baglanti.on('mac', (mesaj) => {
      const c = mesaj.cfg ?? {};
      baglanti.devredildi = true;
      onStartRef.current({
        ...c,
        playMode: 'vs',
        agRol: 'misafir',
        agYuvam: mesaj.yuva ?? 'p1',
        baglanti,
      });
    });

    await baglanti.baglan();
    return baglanti;
  }, []);

  // Ekrandan çıkarken bağlantıyı bırak — maç başladıysa devralınmıştır
  useEffect(
    () => () => {
      if (baglantiRef.current?.devredildi) return;
      baglantiRef.current?.kapat();
      baglantiRef.current = null;
    },
    [],
  );

  const odaAc = useCallback(async () => {
    Sfx.select();
    setDurum(DURUM.baglaniyor);
    try {
      const baglanti = await baglan();
      const cozul = baglanti.on('oda', (mesaj) => {
        setKod(mesaj.kod);
        setDurum(DURUM.bekliyor);
        cozul();
      });
      baglanti.odaAc();
    } catch {
      setHata(hataMetni('baglanti'));
      setDurum(DURUM.hata);
    }
  }, [baglan]);

  const odayaGir = useCallback(async () => {
    Sfx.select();
    setDurum(DURUM.baglaniyor);
    try {
      const baglanti = await baglan();
      baglanti.odaGir(girilenKod);
    } catch {
      setHata(hataMetni('baglanti'));
      setDurum(DURUM.hata);
    }
  }, [baglan, girilenKod]);

  const bastanBasla = useCallback(() => {
    baglantiRef.current?.kapat();
    baglantiRef.current = null;
    setHata(null);
    setKod('');
    setGirilenKod('');
    setDurum(DURUM.secim);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="w-full max-w-md border-4 border-white/20 bg-retro-panel/85 p-5">
        <p className="text-center text-[11px] text-white">ÇEVRİMİÇİ MAÇ</p>
        <p className="mt-2 text-center text-[7px] leading-relaxed text-white/50">
          {upper('Biri oda açar, diğeri kodu girer')}
        </p>

        {durum === DURUM.secim && (
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" className="retro-button w-full py-3 text-[9px]" onClick={odaAc}>
              ODA AÇ
            </button>
            <button
              type="button"
              className="retro-button-ghost w-full py-3 text-[9px]"
              onClick={() => {
                Sfx.select();
                setDurum(DURUM.kodGir);
              }}
            >
              KODLA KATIL
            </button>
          </div>
        )}

        {durum === DURUM.kodGir && (
          <div className="mt-6 flex flex-col gap-3">
            <label className="text-[7px] text-white/55" htmlFor="oda-kodu">
              ODA KODU
            </label>
            <input
              id="oda-kodu"
              className="w-full border-4 border-white/25 bg-black/40 px-3 py-3 text-center text-[14px] tracking-[0.4em] text-white outline-none focus:border-retro-accent"
              value={girilenKod}
              maxLength={KOD_UZUNLUK}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => setGirilenKod(upper(e.target.value).replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && girilenKod.length === KOD_UZUNLUK) odayaGir();
              }}
            />
            <button
              type="button"
              className="retro-button w-full py-3 text-[9px] disabled:opacity-40"
              disabled={girilenKod.length !== KOD_UZUNLUK}
              onClick={odayaGir}
            >
              KATIL
            </button>
          </div>
        )}

        {durum === DURUM.baglaniyor && (
          <p className="mt-8 text-center text-[9px] text-retro-accent">BAĞLANIYOR…</p>
        )}

        {durum === DURUM.bekliyor && (
          <div className="mt-6 text-center">
            <p className="text-[7px] text-white/55">ARKADAŞINA BU KODU SÖYLE</p>
            <p className="mt-3 text-[28px] tracking-[0.3em] text-retro-accent">{kod}</p>
            <p className="mt-4 text-[8px] text-white/70">RAKİP BEKLENİYOR…</p>
          </div>
        )}

        {durum === DURUM.hata && (
          <div className="mt-6 text-center">
            <p className="text-[8px] leading-relaxed text-turkiye-red">{hata}</p>
            <button
              type="button"
              className="retro-button-ghost mt-4 w-full py-3 text-[9px]"
              onClick={bastanBasla}
            >
              TEKRAR DENE
            </button>
          </div>
        )}
      </div>

      <button type="button" className="retro-button-ghost px-6 py-2 text-[8px]" onClick={onBack}>
        GERİ
      </button>
    </div>
  );
}
