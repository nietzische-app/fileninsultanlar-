import { describe, it, expect } from 'vitest';
import { adresSorunu } from './rele-adresi.js';

/**
 * Paketleme denetimi testleri.
 *
 * Bu denetimin değeri, YANLIŞ paketi durdurmasında. Ama asıl risk
 * bunun tersi: yanlış alarm veren bir denetim kapatılır ve o günden
 * sonra hiçbir şeyi korumaz. O yüzden burada "yakalaması gerekenler"
 * kadar "GEÇMESİ gerekenler" de sınanıyor.
 */

describe('röle adresi denetimi', () => {
  it('adres yoksa durduruyor', () => {
    expect(adresSorunu('')?.kod).toBe('yok');
    expect(adresSorunu(null)?.kod).toBe('yok');
    expect(adresSorunu(undefined)?.kod).toBe('yok');
  });

  it('yerel adresi durduruyor', () => {
    /*
     * Bu tam olarak yaşandı: paket testinin bıraktığı `ws://localhost`
     * adresi `dist/`te kalmış ve Android'e kopyalanmıştı.
     */
    ['ws://localhost:8805', 'wss://127.0.0.1:8787', 'wss://[::1]:8787', 'ws://0.0.0.0:80']
      .forEach((a) => expect(adresSorunu(a)?.kod, a).toBeTruthy());
  });

  it('şifresiz bağlantıyı durduruyor', () => {
    expect(adresSorunu('ws://rele.retrovoleybol.online')?.kod).toBe('sifresiz');
  });

  it("IP'ye bağlı adresi durduruyor", () => {
    /*
     * Alan adı almanın SEBEBİ bu. sslip.io adresi IP'yi adın içinde
     * taşıyor ve `.aab`'ye gömülünce sunucunun IP'si değiştiği gün
     * mağazadaki uygulamanın çevrimiçi modu ölüyor — düzeltmenin tek
     * yolu yeni sürüm yayınlamak.
     */
    [
      'wss://rele-178-104-2-249.sslip.io',
      'wss://rele-1-2-3-4.nip.io',
      'wss://rele.10-0-0-1.xip.io',
      'wss://178.104.2.249',
      'wss://178.104.2.249:8787',
      'wss://178.104.2.249/ws',
    ].forEach((a) => expect(adresSorunu(a)?.kod, a).toBe('ip-bagli'));
  });

  it('gerçek alan adlarını GEÇİRİYOR', () => {
    [
      'wss://rele.retrovoleybol.online',
      'wss://retrovoleybol.online/ws',
      'wss://benim-relem.fly.dev',
      'wss://rele.example.com:8787',
    ].forEach((a) => expect(adresSorunu(a), a).toBeNull());
  });

  it('YANLIŞ ALARM vermiyor', () => {
    /*
     * Bunlar denetimin en önemli kısmı. Yanlış alarm veren bir denetim
     * kapatılır ve o günden sonra hiçbir şeyi korumaz — yani yanlış
     * alarm, kaçırılan hatadan daha pahalı.
     *
     * Üçü de kalıba yakın duruyor ama hiçbiri IP'ye bağlı değil:
     * sürüm numarası içeren alt alan adı, yıl içeren ad ve içinde
     * "sslip.io" dizisi geçen ama o servis olmayan bir ad.
     */
    [
      'wss://rele.v4.example.com',
      'wss://rele-2024.example.com',
      'wss://sslipio-degil.example.com',
      'wss://nip-io.example.com',
      'wss://rele.1a2b3c.example.com',
    ].forEach((a) => expect(adresSorunu(a), a).toBeNull());
  });

  it('IP kalıbı yalnızca SUNUCU ADINDA arıyor, yolda değil', () => {
    /*
     * Kalıp `//` ile çapalı. Çapasız yazsaydık sürüm numaralı bir yol
     * (`/v1.2.3/ws` — WebSocket uçlarında sıradan) IP sanılırdı ve
     * denetim tamamen geçerli bir adresi reddederdi.
     *
     * Bu ayrımı önceki tuzaklar SORAMIYORDU: hiçbirinde nokta ayraçlı
     * üç sayı grubu yoktu, yani gevşetilmiş bir kalıp da onları
     * geçirirdi. Mutasyon bunu gösterdi.
     */
    expect(adresSorunu('wss://rele.example.com/v1.2.3/ws')).toBeNull();
    expect(adresSorunu('wss://rele.example.com/1.2.3.4')).toBeNull();
    // Ama sunucu adının KENDİSİ IP ise yakalanmalı
    expect(adresSorunu('wss://1.2.3.4/v1/ws')?.kod).toBe('ip-bagli');
  });

  it('sslip.io denetimi ADIN PARÇASI olan dizeyi yakalamıyor', () => {
    /*
     * Sözcük sınırı (`\b`) olmasaydı, içinde "sslip.io" dizisi geçen
     * bambaşka bir alan adı da IP'ye bağlı sayılırdı. Yukarıdaki
     * "sslipio-degil" tuzağı bunu ölçemiyordu — orada nokta yok, yani
     * sınırsız kalıp da onu geçirirdi.
     */
    expect(adresSorunu('wss://mysslip.iodine.example.com')).toBeNull();
    expect(adresSorunu('wss://anip.iodine.example.com')).toBeNull();
    // Gerçek sslip.io hâlâ yakalanıyor
    expect(adresSorunu('wss://rele-1-2-3-4.sslip.io')?.kod).toBe('ip-bagli');
  });

  it('bilerek geçmek mümkün', () => {
    // Denetim zorlamak için değil unutmamak için; kaçış yolu olmalı
    const a = 'wss://rele-178-104-2-249.sslip.io';
    expect(adresSorunu(a)?.kod).toBe('ip-bagli');
    expect(adresSorunu(a, { ipAdresiTamam: true })).toBeNull();
  });

  it('kaçış yolu DİĞER denetimleri açmıyor', () => {
    /*
     * `PAKET_IP_ADRESI_TAMAM` yalnızca IP denetimini geçmeli. Genel bir
     * "hepsini atla" anahtarına dönüşseydi, birinin IP uyarısını
     * susturmak için koyduğu değişken sessizce localhost'lu bir paketin
     * de mağazaya gitmesine izin verirdi.
     */
    expect(adresSorunu('ws://localhost:8805', { ipAdresiTamam: true })?.kod).toBe('yerel');
    expect(adresSorunu('', { ipAdresiTamam: true })?.kod).toBe('yok');
    expect(adresSorunu('ws://rele.example.com', { ipAdresiTamam: true })?.kod).toBe('sifresiz');
  });

  it('sorun NESNE döner, çıplak dize değil', () => {
    /*
     * `sunucu/rele.js`'teki `surumSorunu` bir kez tam bu yüzden
     * bozulmuştu: "sorun yok" değeriyle sorunun kendisi aynı türden
     * olunca ikisi karışıyor ve denetim sessizce hep "sorun yok"
     * diyordu. Dönüş ya null ya nesne.
     */
    const s = adresSorunu('wss://178.104.2.249');
    expect(s).toBeTypeOf('object');
    expect(s.baslik).toBeTypeOf('string');
    expect(Array.isArray(s.satirlar)).toBe(true);
    expect(adresSorunu('wss://rele.retrovoleybol.online')).toBeNull();
  });
});
