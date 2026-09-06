import { describe, it, expect } from 'vitest';
import {
  macKazanci,
  turnuvaKazanci,
  rozetKazanci,
  gecmisKazanci,
  acikMi,
  kilitliler,
  acilabilirler,
  yeniAcilabilirler,
  sonrakiHedef,
  ac,
  bedel,
  vitrinKadro,
  kademeGruplari,
  koleksiyonOzeti,
  BEDELLER,
  BASLANGIC_KADRO,
  KAZANC,
  PERFORMANS,
} from './ilerleme.js';
import { ROSTER, DEFAULT_PLAYER_ID } from './players.js';
import { DIFFICULTY } from './constants.js';

/** Sade bir kazanılmış maç; testler üstüne alan ekleyip değiştiriyor. */
function macSonucu(ek = {}) {
  return {
    winner: 'home',
    campaign: 'match',
    format: 'classic',
    playMode: 'solo',
    difficulty: 'NORMAL',
    sets: { home: 2, away: 0 },
    stats: {},
    ...ek,
  };
}

describe('kadro ile fiyat listesi TUTARLI', () => {
  /*
   * Bu testin sebebi geçmişte yaşanmış bir arıza: kadro yeniden
   * adlandırılınca `DEFAULT_PLAYER_ID` var olmayan bir oyuncuyu
   * göstermeye başlamıştı ve hiçbir test bunu görmemişti. Aynı hata
   * burada çok daha kötü olurdu — fiyatı olmayan bir oyuncu BEDAVA,
   * kadroda olmayan bir fiyat ise ölü kayıt.
   */
  it('her oyuncu ya başlangıçta açık ya da fiyatlı', () => {
    const fiyatsiz = ROSTER
      .filter((p) => !BASLANGIC_KADRO.includes(p.id) && BEDELLER[p.id] === undefined)
      .map((p) => p.id);
    expect(fiyatsiz).toEqual([]);
  });

  it('fiyat listesinde hayalet oyuncu yok', () => {
    const hayalet = Object.keys(BEDELLER).filter(
      (id) => !ROSTER.some((p) => p.id === id)
    );
    expect(hayalet).toEqual([]);
  });

  it('başlangıç kadrosu gerçek ve fiyatsız', () => {
    BASLANGIC_KADRO.forEach((id) => {
      expect(ROSTER.some((p) => p.id === id), `${id} kadroda yok`).toBe(true);
      expect(BEDELLER[id]).toBeUndefined();
    });
  });

  it('varsayılan oyuncu başlangıçta AÇIK', () => {
    // Kilitli olsaydı oyun, seçili oyuncusu kilitli halde açılırdı
    expect(acikMi(DEFAULT_PLAYER_ID, [])).toBe(true);
  });

  it('başlangıç kadrosu iki kişilik modlara yetiyor', () => {
    // Co-Op ve 2v2 iki oyuncu istiyor; üçüncüsü seçim olsun diye var
    expect(BASLANGIC_KADRO.length).toBeGreaterThanOrEqual(3);
  });

  it('giriş ekranı vitrini KİLİTLİ oyuncu göstermiyor', () => {
    /*
     * Vitrin menüde, satın alma ekranından önce görünüyor; oradaki
     * kadro "işte takımın" diyor. Kilitli bir oyuncuyu koymak yalan
     * olurdu — sabit liste tam olarak bu yüzden kalktı.
     */
    [[], ['zeliha-gunay'], ['handan-balatan', 'melina-vargaz']].forEach((acilanlar) => {
      vitrinKadro(acilanlar).forEach((p) => {
        expect(acikMi(p.id, acilanlar), `${p.id} vitrinde ama kilitli`).toBe(true);
      });
    });
  });
});

describe('vitrin kadrosu', () => {
  it('kayıt boşken başlangıç kadrosunu gösterir', () => {
    expect(vitrinKadro([]).map((p) => p.id)).toEqual(BASLANGIC_KADRO);
  });

  it('EN SON açılan oyuncu vitrine girer, ESKİLER düşer', () => {
    /*
     * Vitrinde üç yer var ve biri kaptanın. Dört oyuncu açmış birinde
     * en yeni ikisi görünmeli — ilk açtıkları değil. Bunu ölçmek için
     * listenin vitrine SIĞMAYACAK kadar uzun olması şart: iki isimle
     * sınasaydık baştan almakla sondan almak aynı sonucu verirdi ve
     * test hiçbir şey sormamış olurdu.
     */
    const sirayla = ['salise-sanli', 'melina-vargaz', 'zeliha-gunay', 'handan-balatan'];
    const vitrin = vitrinKadro(sirayla).map((p) => p.id);

    expect(vitrin[0]).toBe(BASLANGIC_KADRO[0]);
    expect(vitrin).toContain('handan-balatan');
    expect(vitrin).toContain('zeliha-gunay');
    // En eski açılanlar yerini yenilere bıraktı
    expect(vitrin).not.toContain('salise-sanli');
    expect(vitrin).not.toContain('melina-vargaz');
  });

  it('çok sayıda açılışta bile üç kişi ve tekrarsız', () => {
    const hepsi = Object.keys(BEDELLER);
    const vitrin = vitrinKadro(hepsi);
    expect(vitrin.length).toBe(3);
    expect(new Set(vitrin.map((p) => p.id)).size).toBe(3);
  });

  it('kayıttaki çöp id ekrana gitmiyor', () => {
    const vitrin = vitrinKadro(['yok-boyle-biri', 'zeliha-gunay']);
    expect(vitrin.length).toBe(3);
    expect(vitrin.map((p) => p.id)).not.toContain('yok-boyle-biri');
  });
});

describe('maç kazancı', () => {
  it('galibiyet yenilgiden çok kazandırır', () => {
    const galip = macKazanci(macSonucu()).toplam;
    const maglup = macKazanci(macSonucu({ winner: 'away', sets: { home: 0, away: 2 } })).toplam;
    expect(galip).toBeGreaterThan(maglup);
    // Kaybeden de eli boş dönmüyor — yoksa yenilgi oynamayı cezalandırırdı
    expect(maglup).toBeGreaterThan(0);
  });

  it('zorluk ETİKETİ çarpanı uyguluyor', () => {
    /*
     * En sinsi hata burada olurdu: `Game.emitFinish` zorluğu
     * `difficulty.label` ('ZOR') olarak yolluyor, anahtar ('zor')
     * olarak değil. Anahtarla eşleştirseydik her maç sessizce 1
     * çarpanı alır ve zorluk hiçbir şeye yaramazdı — hiçbir şey
     * patlamadan.
     */
    const kolay = macKazanci(macSonucu({ difficulty: 'KOLAY' })).toplam;
    const normal = macKazanci(macSonucu({ difficulty: 'NORMAL' })).toplam;
    const zor = macKazanci(macSonucu({ difficulty: 'ZOR' })).toplam;
    expect(kolay).toBeLessThan(normal);
    expect(normal).toBeLessThan(zor);
    expect(zor / normal).toBeCloseTo(KAZANC.zorluk.ZOR, 1);
  });

  it('bilinmeyen zorluk çarpanı 1', () => {
    const bilinmeyen = macKazanci(macSonucu({ difficulty: 'KABUS' })).toplam;
    expect(bilinmeyen).toBe(macKazanci(macSonucu({ difficulty: 'NORMAL' })).toplam);
  });

  it('zorluk tablosunun anahtarları ETİKETLERLE aynı', () => {
    /*
     * Yukarıdaki çarpan testi tek başına yetmiyor: 'ZOR' etiketiyle
     * yazılmış bir tablo da, 'zor' anahtarıyla yazılmış bir tablo da o
     * testi geçebilirdi — çünkü tablonun kendisi test verisini
     * belirliyor. Asıl soru, tablonun `DIFFICULTY`nin ETİKETLERİYLE
     * eşleşip eşleşmediği. Kaynak orası olduğu için buradan sorulur.
     */
    const etiketler = Object.values(DIFFICULTY).map((d) => d.label);
    expect(Object.keys(KAZANC.zorluk).sort()).toEqual([...etiketler].sort());
  });

  it('küçük harfli zorluk da tanınıyor', () => {
    // Savunma amaçlı büyütme; olmasa 'zor' sessizce çarpansız kalırdı
    expect(macKazanci(macSonucu({ difficulty: 'zor' })).toplam)
      .toBe(macKazanci(macSonucu({ difficulty: 'ZOR' })).toplam);
  });

  it('antrenman EN VERİMLİ kaynak değil', () => {
    /*
     * Antrenmanda rakip yok denecek kadar zayıf ve maç kısa. Tam
     * kazanç verseydik en hızlı ilerleme yolu oyunu oynamamak olurdu.
     */
    const antrenman = macKazanci(macSonucu({ format: 'practice' })).toplam;
    const klasik = macKazanci(macSonucu()).toplam;
    expect(antrenman).toBeLessThan(klasik * 0.5);
  });

  it('çevrimiçi galibiyet ek kazandırır, çevrimiçi YENİLGİ kazandırmaz', () => {
    const cevrimici = macKazanci(macSonucu({ playMode: 'online' })).toplam;
    const yerel = macKazanci(macSonucu()).toplam;
    expect(cevrimici).toBeGreaterThan(yerel);

    const kayip = macKazanci(
      macSonucu({ playMode: 'online', winner: 'away', sets: { home: 0, away: 2 } })
    ).toplam;
    const yerelKayip = macKazanci(
      macSonucu({ winner: 'away', sets: { home: 0, away: 2 } })
    ).toplam;
    expect(kayip).toBe(yerelKayip);
  });

  it('performans TAVANLI', () => {
    /*
     * Tavansız bırakınca en verimli strateji "topu bitirme, ralliyi
     * sürdür" oluyordu — yani maçı kazanmaya çalışmamak. Uç bir
     * istatistikle sınanıyor.
     */
    const ucuk = macKazanci(
      macSonucu({ stats: { perfects: 500, blocks: 500, saves: 500, tipPoints: 50 } })
    );
    const perf = ucuk.kalemler.find((k) => k.ad === 'PERFORMANS');
    expect(perf.puan).toBe(PERFORMANS.tavan);
  });

  it('kalemler toplamı çarpanla birlikte tutuyor', () => {
    // Sonuç ekranı kalemleri gösteriyor; toplamla tutmazsa yalan söyler
    const k = macKazanci(macSonucu({ difficulty: 'ZOR', stats: { blocks: 3 } }));
    const ham = k.kalemler.reduce((a, x) => a + x.puan, 0);
    expect(k.toplam).toBe(Math.round(ham * k.carpan));
  });

  it('EKRAN SATIRLARI toplandığında tam olarak toplamı verir', () => {
    /*
     * Bu, ekranda görülerek bulunmuş bir hatanın testi. Çarpan önce
     * listenin altında "×1.35" diye ayrı duruyordu; sonuç ekranı maç
     * kalemlerinin yanına rozet ve kupa kalemlerini de eklediği için
     * çarpan hepsine uygulanıyormuş gibi okunuyordu. Kolonu toplayan
     * oyuncu 338 buluyor, başlıkta 275 yazıyordu.
     *
     * Kalem testi bunu göremezdi: `macKazanci` tek başına doğruydu,
     * yanlış olan BİRLEŞTİRİLMİŞ listenin okunuşuydu. O yüzden burada
     * sorulan şey satırların TOPLANABİLİR olması.
     */
    [
      macSonucu({ difficulty: 'ZOR', stats: { blocks: 5, saves: 7 } }),
      macSonucu({ difficulty: 'KOLAY' }),
      macSonucu({ format: 'practice' }),
      macSonucu({ difficulty: 'NORMAL' }),
      { campaign: 'survival', winner: null, survival: { points: 14 }, stats: { blocks: 2 } },
    ].forEach((sonuc) => {
      const k = macKazanci(sonuc);
      const kolon = k.satirlar.reduce((a, x) => a + x.puan, 0);
      expect(kolon, `satır toplamı ${kolon} ≠ ${k.toplam}`).toBe(k.toplam);
    });
  });

  it('birleşik satır listesi de toplanabilir', () => {
    // App üç kaynağı tek listede birleştiriyor; asıl okunan liste o
    const mac = macKazanci(macSonucu({ difficulty: 'ZOR' }));
    const rozet = rozetKazanci(['a', 'b', 'c']);
    const kupa = turnuvaKazanci({ status: 'won' });

    const satirlar = [...mac.satirlar, ...rozet.satirlar, ...kupa.satirlar];
    const toplam = mac.toplam + rozet.toplam + kupa.toplam;
    expect(satirlar.reduce((a, x) => a + x.puan, 0)).toBe(toplam);
  });

  it('hayatta kalma koşusu puanla ödüllendirilir', () => {
    const az = macKazanci({
      campaign: 'survival', winner: null, survival: { points: 5 }, stats: {},
    }).toplam;
    const cok = macKazanci({
      campaign: 'survival', winner: null, survival: { points: 30 }, stats: {},
    }).toplam;
    expect(cok).toBeGreaterThan(az);
    expect(cok - az).toBe(25 * KAZANC.hayattaKalma);
  });

  it('bozuk sonuç patlamıyor ve puan uydurmuyor', () => {
    expect(macKazanci(null).toplam).toBe(0);
    expect(macKazanci({}).toplam).toBeGreaterThanOrEqual(0);
    // Negatif istatistik puana çevrilmemeli
    const negatif = macKazanci(macSonucu({ stats: { blocks: -100 }, sets: { home: -5 } }));
    expect(negatif.toplam).toBeGreaterThan(0);
  });
});

describe('turnuva ve rozet kazancı', () => {
  it('kupa YALNIZCA şampiyonlukta', () => {
    expect(turnuvaKazanci({ status: 'won' }).toplam).toBe(KAZANC.kupa);
    expect(turnuvaKazanci({ status: 'lost' }).toplam).toBe(0);
    expect(turnuvaKazanci({ status: 'active' }).toplam).toBe(0);
    expect(turnuvaKazanci(null).toplam).toBe(0);
  });

  it('rozet kazancı sayıyla ölçekleniyor', () => {
    expect(rozetKazanci([]).toplam).toBe(0);
    expect(rozetKazanci(['a']).toplam).toBe(KAZANC.rozet);
    expect(rozetKazanci(['a', 'b', 'c']).toplam).toBe(3 * KAZANC.rozet);
    expect(rozetKazanci(null).toplam).toBe(0);
  });
});

describe('kilitler', () => {
  it('başlangıç kadrosu kayıt BOŞ olsa da açık', () => {
    /*
     * Kayda güvenmek, deposu silinmiş bir tarayıcıda oyuncunun
     * seçebileceği kimse kalmaması demekti — oyun hiç açılmazdı.
     */
    BASLANGIC_KADRO.forEach((id) => expect(acikMi(id, [])).toBe(true));
  });

  it('kilitliler ucuzdan pahalıya sıralı', () => {
    const liste = kilitliler([]).map((p) => bedel(p.id));
    expect(liste).toEqual([...liste].sort((a, b) => a - b));
    expect(liste.length).toBe(ROSTER.length - BASLANGIC_KADRO.length);
  });

  it('sonraki hedef EN UCUZ kilitli', () => {
    const hedef = sonrakiHedef(0, []);
    const enUcuz = Math.min(...Object.values(BEDELLER));
    expect(hedef.bedel).toBe(enUcuz);
    expect(hedef.kalan).toBe(enUcuz);
    expect(hedef.oran).toBe(0);
  });

  it('hedefin kalanı ve oranı puana göre ilerliyor', () => {
    const enUcuz = Math.min(...Object.values(BEDELLER));
    const yari = sonrakiHedef(Math.floor(enUcuz / 2), []);
    expect(yari.kalan).toBe(enUcuz - Math.floor(enUcuz / 2));
    expect(yari.oran).toBeGreaterThan(0.4);
    expect(yari.oran).toBeLessThan(0.6);
    // Bedeli aşan puanda oran 1'i geçmiyor — çubuk taşmasın
    expect(sonrakiHedef(enUcuz * 10, []).oran).toBe(1);
  });

  it('hepsi açıkken hedef YOK', () => {
    expect(sonrakiHedef(9999, Object.keys(BEDELLER))).toBeNull();
  });

  it('yeni açılabilirler yalnızca EŞİĞİ BU MAÇTA geçenleri verir', () => {
    const enUcuz = Math.min(...Object.values(BEDELLER));

    // Eşiği geçen maç: haber var
    const gecti = yeniAcilabilirler(enUcuz - 10, enUcuz + 5, []);
    expect(gecti.length).toBeGreaterThan(0);
    expect(gecti.every((p) => bedel(p.id) === enUcuz)).toBe(true);

    // Eşiğin altında kalan maç: haber yok
    expect(yeniAcilabilirler(0, enUcuz - 1, [])).toEqual([]);
  });

  it('bakiyesi ZATEN yetenler her maç tekrar duyurulmuyor', () => {
    /*
     * Bu kuralın sebebi gürültü. Oyuncu bilerek biriktiriyor olabilir;
     * "Salise Şanlı'yı alabilirsin" cümlesini on maç üst üste görmek,
     * cümleyi tamamen görünmez yapar — sonra gerçekten yeni biri
     * açıldığında da fark edilmez.
     */
    const enUcuz = Math.min(...Object.values(BEDELLER));
    expect(yeniAcilabilirler(enUcuz + 50, enUcuz + 120, [])).toEqual([]);
  });

  it('açılmış oyuncu yeniden duyurulmuyor', () => {
    const [id, fiyat] = Object.entries(BEDELLER)[0];
    const hepsi = yeniAcilabilirler(0, fiyat, []);
    expect(hepsi.some((p) => p.id === id)).toBe(true);
    // Aynı oyuncu satın alındıktan sonra artık "açılabilir" değil
    expect(yeniAcilabilirler(0, fiyat, [id]).some((p) => p.id === id)).toBe(false);
  });

  it('tek maçta iki kademe birden geçilebiliyor', () => {
    // Kupa + rozet + zor maç aynı anda gelirse sıçrama büyük olabilir
    const bedeller = [...new Set(Object.values(BEDELLER))].sort((a, b) => a - b);
    const yeni = yeniAcilabilirler(0, bedeller[1], []);
    const kademeler = new Set(yeni.map((p) => bedel(p.id)));
    expect(kademeler.size).toBe(2);
  });

  it('açılabilirler bakiyeye göre süzülüyor', () => {
    expect(acilabilirler(0, [])).toEqual([]);
    const enUcuz = Math.min(...Object.values(BEDELLER));
    expect(acilabilirler(enUcuz, []).length).toBeGreaterThan(0);
    expect(acilabilirler(1e9, []).length).toBe(Object.keys(BEDELLER).length);
  });
});

describe('koleksiyon görünümü', () => {
  it('her oyuncu TAM BİR kademede', () => {
    /*
     * Ekran kademeleri olduğu gibi çiziyor. Bir oyuncu iki kademede
     * birden olsa iki kez görünürdü; hiçbirinde olmasa koleksiyondan
     * sessizce düşerdi ve "17 oyuncu" sayan başlık yalan söylerdi.
     */
    const hepsi = kademeGruplari([]).flatMap((g) => g.oyuncular.map((p) => p.id));
    expect(hepsi.length).toBe(ROSTER.length);
    expect(new Set(hepsi).size).toBe(ROSTER.length);
  });

  it('kademe bedelleri fiyat listesiyle tutuyor', () => {
    kademeGruplari([]).forEach((g) => {
      g.oyuncular.forEach((p) => {
        expect(bedel(p.id), `${p.id} yanlış kademede`).toBe(g.bedel);
      });
    });
  });

  it('kademeler ucuzdan pahalıya, başlangıç en başta', () => {
    const bedeller = kademeGruplari([]).map((g) => g.bedel);
    expect(bedeller[0]).toBe(0);
    expect(bedeller).toEqual([...bedeller].sort((a, b) => a - b));
  });

  it('açık sayaçları AÇILANLARA göre değişiyor', () => {
    const bos = kademeGruplari([]);
    // Kayıt boşken yalnız başlangıç kademesi dolu
    expect(bos[0].acik).toBe(bos[0].toplam);
    expect(bos.slice(1).every((g) => g.acik === 0)).toBe(true);

    const bir = kademeGruplari(['salise-sanli']);
    const kademe150 = bir.find((g) => g.bedel === 150);
    expect(kademe150.acik).toBe(1);
    expect(kademe150.toplam).toBe(4);
  });

  it('özet kadroyla tutuyor', () => {
    const bos = koleksiyonOzeti([]);
    expect(bos.toplam).toBe(ROSTER.length);
    expect(bos.acik).toBe(BASLANGIC_KADRO.length);
    expect(bos.tamam).toBe(false);
    expect(bos.oran).toBeCloseTo(BASLANGIC_KADRO.length / ROSTER.length, 5);

    const hepsi = koleksiyonOzeti(Object.keys(BEDELLER));
    expect(hepsi.acik).toBe(ROSTER.length);
    expect(hepsi.tamam).toBe(true);
    expect(hepsi.oran).toBe(1);
  });

  it('özet kayıttaki ÇÖP id ile şişmiyor', () => {
    /*
     * Elle kurcalanmış ya da eski bir kayıt var olmayan id taşıyabilir.
     * Sayaç onu da sayarsa "18/17 açık" gibi imkânsız bir başlık çıkar.
     */
    const ozet = koleksiyonOzeti(['yok-boyle-biri', 'baska-bir-hayalet']);
    expect(ozet.acik).toBe(BASLANGIC_KADRO.length);
    expect(ozet.acik).toBeLessThanOrEqual(ozet.toplam);
  });
});

describe('açma işlemi', () => {
  const hedefId = Object.keys(BEDELLER)[0];
  const fiyat = BEDELLER[hedefId];

  it('yeterli puanla açılıyor ve puan DÜŞÜYOR', () => {
    const s = ac({ puan: fiyat + 50, acilanlar: [] }, hedefId);
    expect(s.ok).toBe(true);
    expect(s.durum.puan).toBe(50);
    expect(s.durum.acilanlar).toContain(hedefId);
  });

  it('yetersiz puanda açılmıyor ve puana DOKUNMUYOR', () => {
    const s = ac({ puan: fiyat - 1, acilanlar: [] }, hedefId);
    expect(s.ok).toBe(false);
    expect(s.sebep).toBe('yetersiz');
    expect(s.durum.puan).toBe(fiyat - 1);
    expect(s.durum.acilanlar).toEqual([]);
  });

  it('AYNI oyuncu iki kez satın alınamıyor', () => {
    /*
     * Çift tıklama ya da eski bir ekran durumu bunu tetikleyebilir;
     * doğrulama React'te olsaydı iki basış iki kez para öderdi.
     */
    const ilk = ac({ puan: fiyat * 3, acilanlar: [] }, hedefId);
    const ikinci = ac(ilk.durum, hedefId);
    expect(ikinci.ok).toBe(false);
    expect(ikinci.sebep).toBe('zaten-acik');
    expect(ikinci.durum.puan).toBe(ilk.durum.puan);
  });

  it('başlangıç kadrosu satın alınamıyor', () => {
    const s = ac({ puan: 9999, acilanlar: [] }, BASLANGIC_KADRO[0]);
    expect(s.ok).toBe(false);
    expect(s.durum.puan).toBe(9999);
  });

  it('var olmayan oyuncu satın alınamıyor', () => {
    const s = ac({ puan: 9999, acilanlar: [] }, 'yok-boyle-biri');
    expect(s.ok).toBe(false);
    expect(s.sebep).toBe('yok');
    expect(s.durum.puan).toBe(9999);
  });

  it('bozuk durum patlamıyor', () => {
    expect(ac(null, hedefId).ok).toBe(false);
    expect(ac({ puan: NaN, acilanlar: null }, hedefId).durum.puan).toBe(0);
  });
});

describe('geçmişe dönük kazanç (sürüm geçişi)', () => {
  it('eski oyuncunun KULLANDIĞI kadro bedelsiz açılıyor', () => {
    /*
     * Bu maddenin yokluğu, aylardır oynayan birinin güncellemeden
     * sonra dün kullandığı oyuncuyu mağazada bulması demekti. Sistem
     * değil ceza olurdu.
     */
    const kullanilan = ['handan-balatan', 'zeliha-gunay'];
    const { acilanlar } = gecmisKazanci({}, [], kullanilan);
    expect(acilanlar).toEqual(expect.arrayContaining(kullanilan));
  });

  it('başlangıç kadrosu taşıma listesine yazılmıyor', () => {
    // Zaten açık; kayda eklemek ölü veri olurdu
    const { acilanlar } = gecmisKazanci({}, [], [BASLANGIC_KADRO[0], 'zeliha-gunay']);
    expect(acilanlar).not.toContain(BASLANGIC_KADRO[0]);
  });

  it('var olmayan id taşınmıyor', () => {
    const { acilanlar } = gecmisKazanci({}, [], ['gizem-orge', 'zeliha-gunay']);
    expect(acilanlar).toEqual(['zeliha-gunay']);
  });

  it('geçmiş rekorlar puana çevriliyor', () => {
    const bos = gecmisKazanci({}, [], []).puan;
    const dolu = gecmisKazanci(
      { wins: 10, matchesPlayed: 20, tournamentsWon: 1, bestSurvivalPoints: 12 },
      ['a', 'b'],
      []
    ).puan;
    expect(bos).toBe(0);
    expect(dolu).toBe(
      10 * KAZANC.galibiyet
      + 20 * KAZANC.taban
      + 1 * KAZANC.kupa
      + 12 * KAZANC.hayattaKalma
      + 2 * KAZANC.rozet
    );
  });

  it('çok oynamış bir oyuncu geçişte ELİ BOŞ kalmıyor', () => {
    /*
     * Sayının kendisi değil, YETTİĞİ ölçülüyor: 40 galibiyeti olan
     * biri geçişten sonra en az bir kilidi hemen açabilmeli.
     */
    const { puan } = gecmisKazanci(
      { wins: 40, matchesPlayed: 70, tournamentsWon: 2 }, ['a', 'b', 'c'], []
    );
    expect(acilabilirler(puan, []).length).toBeGreaterThan(0);
  });

  it('bozuk kayıt patlamıyor', () => {
    expect(gecmisKazanci(null, null, null).puan).toBe(0);
    expect(gecmisKazanci({ wins: 'çok' }, [], []).puan).toBe(0);
  });
});
