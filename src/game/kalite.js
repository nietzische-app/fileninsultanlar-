/**
 * Çizim kalitesi — düşük telefonlarda tribün/iz/CRT kesilir.
 *
 * Karar kare süresinden değil ÇİZİM süresinden çıkar. Fizik zaten
 * sabit adım; bütçeyi aşan şey tribün, kanat canvas'ı ve tarama
 * çizgisi. 16 ms kare payının çoğu çizimde gidince tarayıcı kare
 * atlar, oyun 30 FPS'in altında ağır çekime düşer.
 *
 * Eşikler histerezisli: tek uzun kare kaliteyi indirmez, toparlanma
 * da bir anda tam çizime dönmez.
 */

export const KALITE_TAM = 'tam';
export const KALITE_DUSUK = 'dusuk';

/** Çizim bu süreyi (ms) aşınca düşük kademeye aday. */
export const KALITE_DUSUK_ESIK = 11;
/** Çizim bu sürenin altına inince tam kademeye aday. */
export const KALITE_TAM_ESIK = 7;

let seviye = KALITE_TAM;
let dusukSayac = 0;
let tamSayac = 0;

export function kaliteDusukMu() {
  return seviye === KALITE_DUSUK;
}

export function kaliteSeviye() {
  return seviye;
}

export function kaliteSifirla() {
  seviye = KALITE_TAM;
  dusukSayac = 0;
  tamSayac = 0;
  yazHtml(KALITE_TAM);
}

/**
 * @param {number} ms Çizimin kare süresi (ms)
 * @returns {typeof KALITE_TAM | typeof KALITE_DUSUK}
 */
export function kaliteCizimdenOgren(ms) {
  if (!Number.isFinite(ms)) return seviye;
  if (ms >= KALITE_DUSUK_ESIK) {
    dusukSayac += 1;
    tamSayac = 0;
    if (dusukSayac >= 12) uygula(KALITE_DUSUK);
  } else if (ms <= KALITE_TAM_ESIK) {
    tamSayac += 1;
    dusukSayac = 0;
    if (tamSayac >= 45) uygula(KALITE_TAM);
  } else {
    dusukSayac = 0;
    tamSayac = 0;
  }
  return seviye;
}

function uygula(yeni) {
  if (seviye === yeni) return;
  seviye = yeni;
  yazHtml(yeni);
}

function yazHtml(deger) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.kalite = deger;
}
