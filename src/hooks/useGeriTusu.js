import { useEffect, useRef } from 'react';

/**
 * Geri tuşuna basıldığında ne olacağı — SAF karar.
 *
 * Ayrı bir fonksiyon çünkü sınanması gereken tek şey bu ve Capacitor'ın
 * donanım tuşunu tarayıcı testinde tetiklemek mümkün değil. Karar
 * saf bir fonksiyonsa sınanabiliyor; React bileşeninin içine gömülü
 * olsaydı ancak elle denenebilirdi ve elle deneme mağazaya
 * yüklendikten sonra olurdu.
 *
 * @param {string} ekran Şu anki ekran
 * @returns {{yut: boolean, hedef: string|null}}
 *   `yut` false ise uygulama kapanır. `hedef` null ise ekran değişmez.
 */
export function geriKarari(ekran) {
  /*
   * Başlangıç ekranı: yutma. Android'de en üst ekrandan geri tuşu
   * uygulamadan çıkar; bunu değiştirmek kullanıcıyı şaşırtırdı.
   */
  if (ekran === 'start') return { yut: false, hedef: null };

  /*
   * Maç: YUT ama hiçbir şey yapma. Çıkış yolu duraklat menüsünde ve
   * orada onay var. Tek dokunuşla maçtan atılmak, çevrimiçide hükmen
   * mağlubiyet demek — karşı taraf "rakip ayrıldı" alıyor.
   */
  if (ekran === 'match') return { yut: true, hedef: null };

  // Öteki ekranlar: ekrandaki GERİ düğmesinin gittiği yere
  return { yut: true, hedef: ekran === 'online' ? 'select' : 'start' };
}

/**
 * Android'in donanım GERİ tuşu.
 *
 * Neden gerekli: Capacitor kabuğunda bu tuş işlenmezse varsayılan
 * davranış UYGULAMAYI KAPATMAK. Oyuncu maçın ortasında yanlışlıkla
 * dokunduğunda oyun kapanıyor — çevrimiçi maçta bu hükmen mağlubiyet,
 * çünkü karşı taraf "rakip ayrıldı" alıyor. Web'de böyle bir tuş yok,
 * o yüzden bu sorun tarayıcıda hiç görünmüyor ve ancak mağazaya
 * yükledikten sonra fark edilirdi.
 *
 * Tarayıcıda zararsız: `@capacitor/app`'in web uygulaması bu olayı
 * hiç tetiklemiyor, yani dinleyici kurulur ama çalışmaz. Ayrı bir
 * "yerel miyiz" denetimi yazmaya gerek yok — yazsaydık o denetimin
 * kendisi de sınanması gereken bir şey olurdu.
 *
 * Yükleme DİNAMİK: `@capacitor/app` yalnız gerektiğinde çekiliyor.
 * Statik içe aktarma, mağaza kabuğu dışında da paketin web
 * sürümünü ana pakete sokardı.
 *
 * @param {() => boolean} isle Geri tuşuna basıldığında çağrılır.
 *   `true` dönerse olay YUTULUR (uygulama kapanmaz); `false` dönerse
 *   varsayılan davranış (çıkış) uygulanır.
 */
export default function useGeriTusu(isle) {
  /*
   * İşleyici ref'te tutuluyor: her ekran değişiminde dinleyiciyi
   * söküp yeniden kurmak, tam o anda gelen bir basışı kaçırma riski
   * demek. Dinleyici bir kez kuruluyor, hep güncel işleyiciyi
   * çağırıyor.
   */
  const isleRef = useRef(isle);
  isleRef.current = isle;

  useEffect(() => {
    let cozul = null;
    let iptal = false;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const dinleyici = await App.addListener('backButton', () => {
          const yutuldu = isleRef.current?.();
          if (!yutuldu) App.exitApp();
        });
        if (iptal) dinleyici.remove();
        else cozul = () => dinleyici.remove();
      } catch {
        /*
         * Paket yok ya da yüklenemedi (web yapısı). Geri tuşu diye bir
         * şey de yok; sessizce geçmek doğru davranış.
         */
      }
    })();

    return () => {
      iptal = true;
      cozul?.();
    };
  }, []);
}
