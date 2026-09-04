import { useCallback, useEffect, useRef, useState } from 'react';
import Sfx from '../game/audio.js';
import { Baglanti, hataMetni } from '../net/baglanti.js';
import { kimlikYukle, kimlikSunucudan, adDegistir, adUret, AD_UZUNLUK } from '../net/kimlik.js';
import { KOD_UZUNLUK } from '../../sunucu/protokol.js';
import { upper } from '../utils/text.js';

/**
 * Çevrimiçi lobi.
 *
 * İki yol var ve ikisi farklı ihtiyaca cevap veriyor:
 *
 *   - HIZLI EŞLEŞ: kimseyi tanımıyorsan. Sunucu seni bekleyen biriyle
 *     buluşturur. Oyunu ilk açan kişinin elinde kod verecek kimse yok;
 *     bu düğme olmadan "ÇEVRİMİÇİ" onun için boş bir odaya açılıyordu.
 *   - ARKADAŞINLA: tanıdığın biriyle. Oda kodu paylaşılır, maç ayarları
 *     (kadro, rakip, format) odayı açanın seçimi olur.
 *
 * Maçı iki yolda da SUNUCU koşturuyor; iki istemci de yalnızca çiziyor
 * ve tuşlarını yolluyor.
 *
 * Rakip bulunamazsa oyuncu çıkmaza sokulmuyor: yapay zekâya karşı
 * oynama teklifi açıkça yapılıyor. Sessizce bot koymak (sektörde
 * yaygın) daha "akıcı" görünürdü ama oyuncuya insanla oynadığını
 * söylemek yalan olurdu.
 */

const DURUM = {
  secim: 'secim',
  baglaniyor: 'baglaniyor',
  sirada: 'sirada',
  bekliyor: 'bekliyor',
  kodGir: 'kod-gir',
  tablo: 'tablo',
  hata: 'hata',
};

export default function OnlineScreen({ config, onStart, onBack }) {
  const [durum, setDurum] = useState(DURUM.secim);
  const [kod, setKod] = useState('');
  const [girilenKod, setGirilenKod] = useState('');
  const [hata, setHata] = useState(null);
  const [kimlik, setKimlik] = useState(() => kimlikYukle());
  const [adDuzenle, setAdDuzenle] = useState(false);
  /** Sırada geçen süre (sn) — bekleyene bir şeyin aktığını göstermek için. */
  const [gecen, setGecen] = useState(0);
  /** Sunucu "rakip yok" dedi mi — yapay zekâ teklifi bunda çıkıyor. */
  const [rakipYok, setRakipYok] = useState(false);
  /** Kendi puan/galibiyet durumun — sunucudan gelir. */
  const [istatistik, setIstatistik] = useState(null);
  /** Skor tablosu: { liste, ben, sira }. */
  const [tablo, setTablo] = useState(null);

  const baglantiRef = useRef(null);
  const configRef = useRef(config);
  configRef.current = config;
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;
  const kimlikRef = useRef(kimlik);
  kimlikRef.current = kimlik;

  /** Bağlantıyı kur ve olayları bağla — üç yol da (hızlı/aç/gir) buradan geçer. */
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

    baglanti.on('sirada', () => {
      setRakipYok(false);
      setGecen(0);
      setDurum(DURUM.sirada);
    });

    /*
     * "Rakip yok" sıradan ATILDIN demek değil: sunucu bekletmeye devam
     * ediyor. Bu yüzden ekran da beklemeyi bırakmıyor, yalnızca bir
     * çıkış yolu daha açıyor.
     */
    baglanti.on('rakip-yok', () => setRakipYok(true));

    /*
     * Kimlik cevabı: sunucu kimlik ve (ilk seferinde) gizli anahtar
     * veriyor. Yerelde saklanıyor, yoksa her açılışta yeni oyuncu
     * olur ve puan geçmişi hiç birikmez.
     */
    baglanti.on('kimlik', (mesaj) => {
      setKimlik(kimlikSunucudan(mesaj));
      if (mesaj.ben) setIstatistik({ ...mesaj.ben, sira: mesaj.sira });
    });

    baglanti.on('siralama', (mesaj) => {
      setTablo({ liste: mesaj.liste ?? [], ben: mesaj.ben, sira: mesaj.sira });
    });

    /*
     * Eşleşince odayı açan taraf maçı İSTER, ama kurmaz — maçı sunucu
     * koşturuyor. Bu yalnız ARKADAŞ maçında geçerli; hızlı eşleşmede
     * maçı sunucu kendiliğinden kuruyor.
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
        agRakipAd: mesaj.rakip?.ad ?? null,
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

  /*
   * Sıradaki saniye sayacı. Yalnız süsleme değil: bekleyen oyuncunun
   * ekranı hiç değişmezse "takıldı mı" diye çıkıyor. Akan bir sayı,
   * hiçbir şey olmadığını da bir şeyin çalıştığını da gösteriyor.
   */
  useEffect(() => {
    if (durum !== DURUM.sirada) return undefined;
    const sayac = setInterval(() => setGecen((s) => s + 1), 1000);
    return () => clearInterval(sayac);
  }, [durum]);

  const hizliEsles = useCallback(async () => {
    Sfx.select();
    setDurum(DURUM.baglaniyor);
    try {
      const baglanti = await baglan();
      /*
       * Kimlik ÖNCE bildiriliyor ve cevabı bekleniyor: sıraya kimliksiz
       * girersek sunucu maç sonunda kimin kazandığını yazamaz. Kimlik
       * mesajı bağlantıya yapıştığı için bir kez yeterli.
       */
      await baglanti.kimlikBildir(kimlikRef.current);
      baglanti.hizliEsles();
    } catch {
      setHata(hataMetni('baglanti'));
      setDurum(DURUM.hata);
    }
  }, [baglan]);

  /** Skor tablosunu açar. */
  const tabloAc = useCallback(async () => {
    Sfx.select();
    setDurum(DURUM.baglaniyor);
    setTablo(null);
    try {
      const baglanti = await baglan();
      await baglanti.kimlikBildir(kimlikRef.current);
      baglanti.siralamaIste();
      setDurum(DURUM.tablo);
    } catch {
      setHata(hataMetni('baglanti'));
      setDurum(DURUM.hata);
    }
  }, [baglan]);

  const odaAc = useCallback(async () => {
    Sfx.select();
    setDurum(DURUM.baglaniyor);
    try {
      const baglanti = await baglan();
      await baglanti.kimlikBildir(kimlikRef.current);
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
      await baglanti.kimlikBildir(kimlikRef.current);
      baglanti.odaGir(girilenKod);
    } catch {
      setHata(hataMetni('baglanti'));
      setDurum(DURUM.hata);
    }
  }, [baglan, girilenKod]);

  /**
   * Yapay zekâya karşı oyna — sıradan çıkıp YEREL maç başlatır.
   *
   * Maç sunucuda koşturulmuyor: rakip bot olduğuna göre sunucuya
   * gitmenin tek getirisi gecikme olurdu. Yerel maç hem sıfır
   * gecikmeli hem de sunucuyu boşuna meşgul etmiyor.
   */
  const botaKarsi = useCallback(() => {
    Sfx.select();
    baglantiRef.current?.siradanCik();
    baglantiRef.current?.kapat();
    baglantiRef.current = null;
    const c = configRef.current;
    onStartRef.current({
      mode: c.mode,
      homeIds: c.homeIds,
      opponentId: c.opponentId,
      format: c.format,
      difficulty: c.difficulty,
      playMode: 'solo',
      /*
       * Ağ alanları AÇIKÇA boşaltılıyor. App bu nesneyi mevcut maç
       * ayarının ÜSTÜNE yayıyor; yazmasaydık daha önce çevrimiçi
       * oynanmış bir oturumda eski `agRol` sızabilir ve bot maçı
       * kendini çevrimiçi sanardı — sunucudan hiç paket gelmediği
       * için de "rakip bekleniyor" diye donardı.
       */
      agRol: null,
      agYuvam: null,
      agRakipAd: null,
      baglanti: null,
    });
  }, []);

  const bastanBasla = useCallback(() => {
    baglantiRef.current?.kapat();
    baglantiRef.current = null;
    setHata(null);
    setKod('');
    setGirilenKod('');
    setRakipYok(false);
    setDurum(DURUM.secim);
  }, []);

  const adKaydet = useCallback((yeni) => {
    setKimlik(adDegistir(yeni));
    setAdDuzenle(false);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="w-full max-w-md border-4 border-white/20 bg-retro-panel/85 p-5">
        <p className="text-center text-[11px] text-white">ÇEVRİMİÇİ MAÇ</p>

        {/* Takma ad — rakibin ekranında bu görünüyor */}
        {durum === DURUM.secim && !adDuzenle && (
          <button
            type="button"
            className="mt-3 block w-full text-center text-[7px] leading-relaxed text-white/50 hover:text-white/80"
            onClick={() => {
              Sfx.select();
              setAdDuzenle(true);
            }}
          >
            {upper('Adın')}: <span className="text-retro-accent">{kimlik.ad}</span>
            <span className="ml-2 text-white/35">{upper('(değiştir)')}</span>
          </button>
        )}

        {/*
          Kendi puanın. Yalnız maç oynadıysan çıkıyor: herkes 1000
          puanla başlıyor ve hiç oynamamışa "1000 PUAN · 0 MAÇ"
          göstermek bir başarı gibi görünürdü.
        */}
        {durum === DURUM.secim && !adDuzenle && istatistik?.mac > 0 && (
          <p className="mt-1 text-center text-[7px] text-white/40">
            {istatistik.puan} PUAN · {istatistik.galibiyet}G {istatistik.maglubiyet}M
            {istatistik.sira ? ` · ${istatistik.sira}. SIRA` : ''}
          </p>
        )}

        {durum === DURUM.secim && adDuzenle && (
          <AdKutusu
            baslangic={kimlik.ad}
            onKaydet={adKaydet}
            onVazgec={() => setAdDuzenle(false)}
          />
        )}

        {durum === DURUM.secim && (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              className="retro-button w-full py-3 text-[9px]"
              onClick={hizliEsles}
            >
              HIZLI EŞLEŞ
            </button>
            <p className="text-center text-[7px] leading-relaxed text-white/40">
              {upper('Sunucu seni bekleyen bir oyuncuyla buluşturur')}
            </p>

            <div className="mt-2 border-t-4 border-white/10 pt-4">
              <p className="mb-3 text-center text-[7px] text-white/40">
                {upper('Ya da tanıdığın biriyle')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="retro-button-ghost flex-1 py-3 text-[8px]"
                  onClick={odaAc}
                >
                  ODA AÇ
                </button>
                <button
                  type="button"
                  className="retro-button-ghost flex-1 py-3 text-[8px]"
                  onClick={() => {
                    Sfx.select();
                    setDurum(DURUM.kodGir);
                  }}
                >
                  KODLA KATIL
                </button>
              </div>
            </div>

            <button
              type="button"
              className="retro-button-ghost mt-1 w-full py-2 text-[8px]"
              onClick={tabloAc}
            >
              SKOR TABLOSU
            </button>
          </div>
        )}

        {durum === DURUM.tablo && (
          <SkorTablosu tablo={tablo} onGeri={() => setDurum(DURUM.secim)} />
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

        {durum === DURUM.sirada && (
          <div className="mt-6 text-center">
            <p className="text-[9px] text-retro-accent">RAKİP ARANIYOR…</p>
            <p className="mt-2 text-[8px] text-white/45" aria-live="off">
              {gecen} SANİYE
            </p>

            {/*
              Rakip yoksa çıkmaz yok: teklif açıkça yapılıyor ve sıra
              da bozulmuyor — tam bu sırada biri gelirse gerçek maç
              olur.
            */}
            {rakipYok && (
              <div className="mt-5 border-4 border-white/15 bg-black/40 p-4">
                <p className="text-[7px] leading-relaxed text-white/65">
                  {upper('Şu an bekleyen başka oyuncu yok. Beklemeye devam edebilir ya da yapay zekâya karşı oynayabilirsin.')}
                </p>
                <button
                  type="button"
                  className="retro-button mt-3 w-full py-3 text-[8px]"
                  onClick={botaKarsi}
                >
                  YAPAY ZEKÂYA KARŞI OYNA
                </button>
              </div>
            )}

            <button
              type="button"
              className="retro-button-ghost mt-4 w-full py-2 text-[8px]"
              onClick={bastanBasla}
            >
              VAZGEÇ
            </button>
          </div>
        )}

        {durum === DURUM.bekliyor && (
          <div className="mt-6 text-center">
            <p className="text-[7px] text-white/55">ARKADAŞINA BU KODU SÖYLE</p>
            <p className="mt-3 text-[28px] tracking-[0.3em] text-retro-accent">{kod}</p>
            <p className="mt-4 text-[8px] text-white/70">RAKİP BEKLENİYOR…</p>
            <button
              type="button"
              className="retro-button-ghost mt-5 w-full py-2 text-[8px]"
              onClick={bastanBasla}
            >
              VAZGEÇ
            </button>
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

/**
 * Skor tablosu.
 *
 * Sıralama Elo puanına göre; galibiyet SAYISINA göre değil. Galibiyet
 * sayısı beceriyi değil boş zamanı ölçüyor — yüz maç oynayıp yarısını
 * kazanan, on maç oynayıp dokuzunu kazananın üstünde çıkardı
 * (bkz. sunucu/puan.js).
 *
 * Hiç maç oynamamışlar listede yok: herkes 1000 puanla başlıyor ve
 * girselerdi tablo, oyunu açıp hiç oynamamış kişilerle dolardı.
 */
function SkorTablosu({ tablo, onGeri }) {
  const liste = tablo?.liste ?? [];
  const benimId = tablo?.ben?.id;

  return (
    <div className="mt-6">
      {!tablo && <p className="text-center text-[9px] text-retro-accent">YÜKLENİYOR…</p>}

      {tablo && liste.length === 0 && (
        <p className="text-center text-[7px] leading-relaxed text-white/50">
          {upper('Henüz kimse maç oynamamış. İlk sen ol.')}
        </p>
      )}

      {liste.length > 0 && (
        <ol className="flex flex-col gap-1">
          {liste.map((oyuncu, i) => (
            <li
              key={oyuncu.id}
              className={`flex items-center gap-2 border-4 px-2 py-2 text-[8px] ${
                oyuncu.id === benimId
                  ? 'border-retro-accent/60 bg-retro-accent/10 text-white'
                  : 'border-white/10 bg-black/30 text-white/75'
              }`}
            >
              <span className="w-5 shrink-0 text-white/45">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{oyuncu.ad}</span>
              <span className="shrink-0 text-white/40">
                {oyuncu.galibiyet}G {oyuncu.maglubiyet}M
              </span>
              <span className="w-9 shrink-0 text-right text-retro-accent">{oyuncu.puan}</span>
            </li>
          ))}
        </ol>
      )}

      {/*
        Kendisi ilk 20'de değilse kendi satırını ayrıca göster —
        yoksa tabloya bakan oyuncu kendini hiç bulamıyor.
      */}
      {tablo?.ben?.mac > 0 && !liste.some((o) => o.id === benimId) && (
        <div className="mt-2 border-t-4 border-white/10 pt-2">
          <div className="flex items-center gap-2 border-4 border-retro-accent/60 bg-retro-accent/10 px-2 py-2 text-[8px] text-white">
            <span className="w-5 shrink-0 text-white/45">{tablo.sira ?? '–'}.</span>
            <span className="min-w-0 flex-1 truncate">{tablo.ben.ad}</span>
            <span className="shrink-0 text-white/40">
              {tablo.ben.galibiyet}G {tablo.ben.maglubiyet}M
            </span>
            <span className="w-9 shrink-0 text-right text-retro-accent">{tablo.ben.puan}</span>
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-[6px] leading-relaxed text-white/30">
        {upper('Yalnız hızlı eşleşme maçları sayılır. Sonucu sunucu yazar.')}
      </p>

      <button
        type="button"
        className="retro-button-ghost mt-4 w-full py-2 text-[8px]"
        onClick={onGeri}
      >
        GERİ
      </button>
    </div>
  );
}

/** Takma ad düzenleme kutusu. */
function AdKutusu({ baslangic, onKaydet, onVazgec }) {
  const [taslak, setTaslak] = useState(baslangic);

  return (
    <div className="mt-4 flex flex-col gap-2">
      <label className="text-[7px] text-white/55" htmlFor="takma-ad">
        {upper('Takma adın — rakibin bunu görecek')}
      </label>
      <input
        id="takma-ad"
        className="w-full border-4 border-white/25 bg-black/40 px-3 py-2 text-center text-[10px] text-white outline-none focus:border-retro-accent"
        value={taslak}
        maxLength={AD_UZUNLUK}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setTaslak(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onKaydet(taslak);
          if (e.key === 'Escape') onVazgec();
        }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="retro-button-ghost flex-1 py-2 text-[7px]"
          onClick={() => setTaslak(adUret())}
        >
          RASTGELE
        </button>
        <button
          type="button"
          className="retro-button flex-1 py-2 text-[7px]"
          onClick={() => onKaydet(taslak)}
        >
          KAYDET
        </button>
      </div>
    </div>
  );
}
