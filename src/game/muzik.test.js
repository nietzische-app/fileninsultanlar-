import { describe, it, expect } from 'vitest';
import { muzikUret, MUZIK_SURE } from './muzik.js';

/**
 * Müzik üreticisi testleri.
 *
 * Sesi KULAKLA doğrulayamıyoruz; burada sınanan şey ölçülebilir olan:
 * doğru perdeler, kırpma yok, sessizlik yok, döngü dikişi küçük ve
 * üretim her seferinde AYNI. Bunlar "güzel mi" sorusunu yanıtlamıyor
 * ama "bozuldu mu" sorusunu yanıtlıyor — bir değişiklik müziği
 * sessizleştirir ya da çatırdatırsa burada görünür.
 */

const HIZ = 44100;

/** Tarayıcı `AudioContext`inin bu üreticiye yeten kadarı. */
function sahteCtx(hiz = HIZ) {
  return {
    sampleRate: hiz,
    createBuffer: (kanal, uzunluk, orneklemeHizi) => {
      const veri = new Float32Array(uzunluk);
      return {
        length: uzunluk,
        sampleRate: orneklemeHizi,
        numberOfChannels: kanal,
        getChannelData: () => veri,
      };
    },
  };
}

/** Belirli bir anda baskın frekans — yazılan notanın çalındığını sınamak için. */
function baskinFrekans(veri, bas, uzunluk, altHz, ustHz) {
  let enIyi = 0;
  let enIyiF = 0;
  for (let f = altHz; f <= ustHz; f += 1) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < uzunluk; i += 1) {
      const aci = 2 * Math.PI * f * ((bas + i) / HIZ);
      re += veri[bas + i] * Math.cos(aci);
      im += veri[bas + i] * Math.sin(aci);
    }
    const guc = re * re + im * im;
    if (guc > enIyi) {
      enIyi = guc;
      enIyiF = f;
    }
  }
  return enIyiF;
}

describe('giriş müziği üreticisi', () => {
  it('beklenen uzunlukta tampon üretir', () => {
    const buf = muzikUret(sahteCtx());
    expect(buf.length).toBe(Math.round(MUZIK_SURE * HIZ));
    expect(buf.sampleRate).toBe(HIZ);
  });

  it('sessiz değil ve KIRPMIYOR', () => {
    const v = muzikUret(sahteCtx()).getChannelData(0);
    let tepe = 0;
    let kare = 0;
    for (let i = 0; i < v.length; i += 1) {
      tepe = Math.max(tepe, Math.abs(v[i]));
      kare += v[i] * v[i];
    }
    const rms = Math.sqrt(kare / v.length);

    // Sessizlik: bir değişiklik müziği susturursa oyun sessizce sessiz kalır
    expect(rms).toBeGreaterThan(0.02);
    /*
     * Kırpma: örnekler toplandığı için tepe 1'i aşabilir ve o zaman ses
     * çatırdar. Üretici sonda bir kez ölçekliyor; sınır onun hedefi.
     */
    expect(tepe).toBeLessThanOrEqual(0.86);
  });

  it('yazılan notaları gerçekten çalıyor', () => {
    const v = muzikUret(sahteCtx()).getChannelData(0);
    const vurus = 60 / 150;
    // [vuruş, beklenen Hz] — ezginin başı, ikinci notası ve doruğu
    [[0, 440], [1, 523], [30, 880]].forEach(([n, beklenen]) => {
      const bas = Math.round(n * vurus * HIZ) + 400;
      const f = baskinFrekans(v, bas, 2048, beklenen - 40, beklenen + 40);
      // 1 yarım ton ≈ %6; %2 tolerans yanlış notayı geçirmez
      expect(Math.abs(f - beklenen) / beklenen).toBeLessThan(0.02);
    });
  });

  it('döngü dikişi tık sesi çıkarmayacak kadar küçük', () => {
    const v = muzikUret(sahteCtx()).getChannelData(0);
    // Son örnekten ilk örneğe atlarken oluşan sıçrama
    expect(Math.abs(v[v.length - 1] - v[0])).toBeLessThan(0.25);
  });

  it('her üretimde AYNI sesi verir', () => {
    /*
     * Vurmalılarda gürültü var; tohumsuz bir üreteçle her açılışta
     * farklı bir kayıt çıkardı. Kendi başına felaket değil ama döngü
     * dikişi de her seferinde değişirdi — yani "bazen tık sesi geliyor"
     * gibi teşhis edilmesi zor bir arıza.
     */
    const a = muzikUret(sahteCtx()).getChannelData(0);
    const b = muzikUret(sahteCtx()).getChannelData(0);
    expect(a.length).toBe(b.length);
    let enBuyukFark = 0;
    for (let i = 0; i < a.length; i += 1) {
      enBuyukFark = Math.max(enBuyukFark, Math.abs(a[i] - b[i]));
    }
    expect(enBuyukFark).toBe(0);
  });

  it('farklı örnekleme hızında da çalışır', () => {
    // Tarayıcıya göre 44.1 kHz ya da 48 kHz olabiliyor
    const buf = muzikUret(sahteCtx(48000));
    expect(buf.length).toBe(Math.round(MUZIK_SURE * 48000));
  });
});
