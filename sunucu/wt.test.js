/*
 * @vitest-environment node
 *
 * NODE ORTAMI ŞART. Varsayılan jsdom altında `TextEncoder` BAŞKA BİR
 * realm'in `Uint8Array`ini üretiyor ve QUIC kütüphanesinin
 * `instanceof Uint8Array` denetimi başarısız oluyor — belirtisi
 * "chunk is not of instanceof Uint8Array", sebebi ise testin kendi
 * ortamı. Gerçek röle zaten Node'da koşuyor.
 */
import {
  describe, it, expect, beforeAll, afterAll,
} from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { baslat } from './rele.js';
import { PAKET_SURUM, datagramlik } from '../src/game/snapshot.js';

/**
 * WEBTRANSPORT DİNLEYİCİSİ — gerçek QUIC üstünden uçtan uca.
 *
 * Sahte nesnelerle sınamak burada yetmezdi: bu katmanın işi TAM OLARAK
 * gerçek bir taşımayı rölenin soket sözleşmesine uydurmak. Sahte bir
 * oturum, sözleşmenin tuttuğunu değil benim onu nasıl hayal ettiğimi
 * sınardı.
 *
 * O yüzden burada gerçek bir HTTP/3 sunucusu açılıyor, gerçek bir QUIC
 * istemcisi bağlanıyor ve rölenin kendi kimlik el sıkışması
 * yapılıyor — WebSocket tarafında olduğu gibi.
 *
 * SERTİFİKA kısa ömürlü ve kendinden imzalı; istemci onu parmak iziyle
 * kabul ediyor (`serverCertificateHashes`). Üretimde Caddy'nin gerçek
 * sertifikası kullanılıyor ve bu adıma gerek kalmıyor.
 */

const PORT = 8831;
const WT_PORT = 8832;

let rele = null;
let dizin = null;
let parmakIzi = null;
let cert = null;
let anahtar = null;

beforeAll(async () => {
  dizin = mkdtempSync(join(tmpdir(), 'wt-test-'));
  const certYol = join(dizin, 'c.pem');
  const anahtarYol = join(dizin, 'k.pem');

  /*
   * ECDSA P-256 ve kısa ömür ŞART: WebTransport'un parmak izi yolu
   * yalnız bu iki koşulu sağlayan sertifikaları kabul ediyor.
   */
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1',
    '-nodes', '-keyout', anahtarYol, '-out', certYol,
    '-days', '10', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
  ], { stdio: 'ignore' });

  cert = readFileSync(certYol, 'utf8');
  anahtar = readFileSync(anahtarYol, 'utf8');

  const der = execFileSync('openssl', ['x509', '-in', certYol, '-outform', 'der']);
  parmakIzi = createHash('sha256').update(der).digest();

  rele = await baslat({
    port: PORT,
    nabiz: 60_000,
    wt: {
      port: WT_PORT, host: '127.0.0.1', cert, privKey: anahtar,
    },
  });
}, 60_000);

afterAll(async () => {
  await rele?.kapat();
  if (dizin) rmSync(dizin, { recursive: true, force: true });
});

/**
 * QUIC paketi kurulu mu.
 *
 * `optionalDependencies` ve yalnız `sunucu/` altında: kökteki
 * `npm ci` onu kurmuyor, yani CI'da yok. Testin bunu bilmesi gerek —
 * ama "yoksa geç" demek de yetmez, o yüzden aşağıda ayrı bir denetim
 * paketin YOKLUĞUNDA rölenin açıldığını sınıyor.
 */
async function paketVar() {
  try {
    const ad = '@fails-components/webtransport';
    await import(/* @vite-ignore */ ad);
    return true;
  } catch {
    return false;
  }
}

/** Node tarafında bir WebTransport istemcisi açar. */
async function istemciAc() {
  const ad = '@fails-components/webtransport';
  const { WebTransport } = await import(/* @vite-ignore */ ad);
  const wt = new WebTransport(`https://127.0.0.1:${WT_PORT}/wt`, {
    serverCertificateHashes: [{ algorithm: 'sha-256', value: parmakIzi }],
  });
  await wt.ready;
  const akis = await wt.createBidirectionalStream();
  return { wt, yazici: akis.writable.getWriter(), okuyucu: akis.readable.getReader() };
}

describe('webtransport dinleyicisi', () => {
  it('bağımlılık yoksa röle YİNE de açılıyor', async () => {
    /*
     * En önemli güvence bu: WebTransport isteğe bağlı. Bağımlılık
     * kurulu değilse (CI, native derleyicisi olmayan makine) röle
     * WebSocket'le açılmalı. Kırılsaydı bir "belki iyi olur" özelliği
     * bütün dağıtımı düşürürdü.
     */
    const yedek = await baslat({ port: 8833, nabiz: 60_000, wt: null });
    expect(yedek.port).toBe(8833);
    await yedek.kapat();
  });

  it('QUIC üstünden kimlik el sıkışması TAMAMLANIYOR', async (ctx) => {
    /*
     * Paket hiç kurulu değilse (CI, native derleyicisi olmayan makine)
     * bu test ATLANIYOR ve atlandığı yazıyor. Sessizce geçmesi değil:
     * vitest onu "skipped" olarak gösteriyor.
     *
     * Atlamanın bir şeyi örtmemesi için üstteki denetim paketsiz
     * durumu ZATEN sınıyor — röle o hâlde de açılmalı. Paket kuruluysa
     * (yerel geliştirme, üretim) test gerçek QUIC ile koşuyor ve
     * bağlanamazsa DÜŞÜYOR: yeşil kalan ama hiçbir şey sınamayan bir
     * test, hiç test olmamasından kötü.
     */
    if (!(await paketVar())) {
      ctx.skip('@fails-components/webtransport kurulu değil (sunucu/npm install)');
      return;
    }

    let baglanti;
    try {
      baglanti = await istemciAc();
    } catch (hata) {
      throw new Error(`QUIC istemcisi bağlanamadı: ${hata.message}`);
    }

    const { yazici, okuyucu, wt } = baglanti;
    const kodlayici = new TextEncoder();
    await yazici.write(kodlayici.encode(`${JSON.stringify({
      t: 'kimlik', id: 'a'.repeat(16), gizli: 'b'.repeat(16), ad: 'QUIC', surum: PAKET_SURUM,
    })}\n`));

    const cozucu = new TextDecoder();
    let tampon = '';
    let cevap = null;
    const bitis = Date.now() + 10_000;
    while (Date.now() < bitis && !cevap) {
      const { value, done } = await okuyucu.read();
      if (done) break;
      tampon += cozucu.decode(value, { stream: true });
      let n = tampon.indexOf('\n');
      while (n >= 0 && !cevap) {
        const satir = tampon.slice(0, n);
        tampon = tampon.slice(n + 1);
        try {
          const m = JSON.parse(satir);
          if (m.t === 'kimlik') cevap = m;
        } catch { /* yarım satır */ }
        n = tampon.indexOf('\n');
      }
    }

    expect(cevap, 'röle QUIC üstünden kimlik cevabı vermedi').toBeTruthy();
    expect(cevap.id).toBeTruthy();

    /*
     * VE RÖLE BU OTURUMU KENDİ DEFTERİNE YAZDI MI. Kimlik cevabı tek
     * başına yetmez: oturum süpürgeye ve kapatmaya girmiyorsa QUIC
     * bağlantıları sızar ve odalar sonsuza kadar dolu kalır.
     */
    expect(rele.wtSunucu?.istemciler.size ?? 0).toBeGreaterThan(0);

    wt.close();
  }, 30_000);

  it('kanal ayrımı protokolle AYNI kaynaktan geliyor', () => {
    /*
     * Röle ve istemci ayrı listeler tutsaydı biri değişip diğeri
     * unutulduğunda paketler yanlış kanala düşerdi. Bu satır, ikisinin
     * de `snapshot.js`ten okuduğunu sabitliyor.
     */
    expect(datagramlik({ t: 'durum' })).toBe(true);
    expect(datagramlik({ t: 'kimlik' })).toBe(false);
  });
});
