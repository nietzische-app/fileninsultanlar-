import { useEffect, useState } from 'react';

/**
 * TEŞHİS KATMANI — oyuncunun kendi cihazından canlı sayılar.
 *
 * NEDEN VAR: bir oyuncu ısrarla "top gecikmeli ilerliyor" dedi ve
 * bizim ölçümlerimizin hiçbiri bunu doğrulamadı. Bizim taklit ettiğimiz
 * masaüstü tarayıcı 60 fps'i hiç kaçırmıyor, ağı seğirmiyor; oyuncunun
 * telefonu ve mobil verisi öyle olmayabilir. O farkı kapatmanın tek
 * dürüst yolu sayıları ORADAN almak.
 *
 * NASIL AÇILIR: adrese `?tani=1` eklemek. Gizli bir dokunma hareketi
 * değil, çünkü öyle bir şey hem kazara açılır hem de tarif etmesi zor
 * olurdu. Normal oyuncu bu katmanı hiç görmüyor.
 *
 * NEDEN KENDİ SAATİNDE OKUYOR: motorun `emitState`i skor değişince
 * tetikleniyor, yani kare kare bir şey söylemiyor. Katman motordan
 * doğrudan okuyor ve saniyede dört kez tazeleniyor — göz okuyabilsin
 * diye yavaş, bir tökezlemeyi kaçırmayacak kadar da sık.
 */

/** Tazeleme aralığı (ms). Gözün okuyabileceği en hızlı tempo. */
const TAZELE_MS = 250;

/**
 * Bir satırı eşiklere göre renklendirir.
 *
 * Renk KARAR DEĞİL, dikkat çekme: hangi sayının olağandışı olduğunu
 * söylüyor, "sorun bu" demiyor. Eşikler bu projedeki ölçümlerden
 * geliyor (bkz. tests/olcum/).
 */
function renk(deger, iyi, orta) {
  if (deger === null || deger === undefined) return '#8A8A8A';
  if (deger <= iyi) return '#7CE38B';
  if (deger <= orta) return '#FFD24A';
  return '#FF6B6B';
}

function Satir({ ad, deger, birim = 'ms', renkli = '#7CE38B' }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>{ad}</span>
      <span style={{ color: renkli }}>
        {deger === null || deger === undefined ? '—' : `${deger}${birim}`}
      </span>
    </div>
  );
}

/**
 * @param {{ oyun: object|null, tasima: string|null }} props
 *   Motor örneği (`window.__game`) ve kullanılan taşımanın adı
 */
export default function TaniKatmani({ oyun, tasima = null }) {
  const [veri, setVeri] = useState(null);

  useEffect(() => {
    if (!oyun) return undefined;
    const oku = () => setVeri(oyun.agTaniOzeti?.() ?? null);
    oku();
    const t = setInterval(oku, TAZELE_MS);
    return () => clearInterval(t);
  }, [oyun]);

  /*
   * Çevrimdışı maçta hiçbir şey çizilmiyor: `agTaniOzeti` orada null
   * dönüyor. Boş bir kutu göstermek, olmayan bir ağ sorunu varmış
   * izlenimi verirdi.
   */
  if (!veri) return null;

  return (
    <div
      className="pointer-events-none fixed left-1 top-1 z-50 flex flex-col gap-[2px] rounded px-2 py-1 text-[7px] leading-[1.6]"
      style={{ backgroundColor: 'rgba(0,0,0,0.72)', minWidth: 132 }}
    >
      <div className="flex justify-between gap-3">
        <span style={{ color: '#FFD24A' }}>TEŞHİS</span>
        {/*
          Hangi taşıma kullanılıyor. WebTransport sessizce WebSocket'e
          düşebiliyor (Safari'de yok, kurum ağları UDP'yi kapatıyor) ve
          o düşüş DOĞRU davranış — ama görünmezse "açık mı" sorusu yine
          tahmine kalırdı. Bu proje o tuzağa röle sürümüyle bir kez düştü.
        */}
        {tasima && (
          <span style={{ color: tasima === 'webtransport' ? '#7CE38B' : 'rgba(255,255,255,0.45)' }}>
            {tasima === 'webtransport' ? 'WT' : 'WS'}
          </span>
        )}
      </div>

      {/* --- Ağ --- */}
      <Satir ad="ping" deger={veri.ping} renkli={renk(veri.ping, 100, 250)} />
      <Satir ad="seğirme" deger={veri.segirme} renkli={renk(veri.segirme, 15, 40)} />
      {/*
        Paket aralığı ÖLÇÜLEN değer, ayardan okunan değil: röle eski
        sürümdeyse burada beklenenden uzun bir aralık görünür ve "iki
        taraf aynı kodda mı" sorusu tek bakışta cevaplanır.

        Eşikler 60 Hz'e göre: beklenen ~17 ms. 30 ms'nin üstü SARI,
        çünkü orası büyük ihtimalle 30 Hz'de kalmış bir röle — arıza
        değil ama bilinmesi gereken bir şey.
      */}
      <Satir ad="paket" deger={veri.paketAralik} renkli={renk(veri.paketAralik, 22, 40)} />
      <Satir ad="sessizlik" deger={veri.sessizlik} renkli={renk(veri.sessizlik, 200, 600)} />

      {/* --- Ara değerleme --- */}
      <Satir ad="tampon" deger={veri.tampon} renkli={renk(veri.tampon, 70, 120)} />
      <Satir ad="gerilik" deger={veri.gerilik} renkli={renk(veri.gerilik, 90, 150)} />

      {/*
        İleri sarma oranı: 1 = telafi tam çalışıyor, 0 = kapalı. Topun
        rakibe yaklaştığı anlarda düşmesi BEKLENEN davranış; sürekli
        sıfırda takılı kalması değil.
      */}
      <Satir
        ad="ileri sarma"
        deger={veri.ileriSarma}
        birim=""
        renkli={veri.ileriSarma >= 0.8 ? '#7CE38B' : veri.ileriSarma >= 0.3 ? '#FFD24A' : '#FF6B6B'}
      />

      {/* --- Cihaz --- */}
      <Satir ad="kare" deger={veri.kare} renkli={renk(veri.kare, 18, 25)} />
      {/*
        ÇİZİM, "kare"nin içindeki paydır ve ikisi birlikte okunur:
          kare uzun + çizim uzun  → yavaşlatan şey BİZİM çizimimiz
          kare uzun + çizim kısa  → kısıtlama başka yerde (tarayıcı,
                                    pil tasarrufu, ekran tazeleme hızı)
        Bu ayrım olmadan "30 fps" tek başına nereye bakılacağını
        söylemiyor.
      */}
      <Satir ad="çizim" deger={veri.cizim} renkli={renk(veri.cizim, 8, 14)} />
      <Satir
        ad="uzun kare"
        deger={veri.uzunKareYuzde}
        birim="%"
        renkli={renk(veri.uzunKareYuzde, 1, 5)}
      />
    </div>
  );
}
