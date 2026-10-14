/**
 * İlk maç koçu — sayı sayılmadan tuş öğretilir.
 *
 * Kart okumak hızlı oyunda işe yaramıyor: top durur, doğru tuşa basınca
 * devam eder. Üç adım: hareket, zıpla, vur. Dalış kasıtlı yok; o
 * kaydırma hareketi maç içinde öğrenilir.
 */

export const KOC_ADIM = {
  MOVE: 'move',
  JUMP: 'jump',
  HIT: 'hit',
  DONE: 'done',
};

/** Adım değişince basılı kalan tuş bir sonrakini yemesin. */
export const KOC_KILIT = 0.28;

export function kocBaslangic() {
  return { adim: KOC_ADIM.MOVE, kilit: 0.12 };
}

export function kocGirdiUydu(adim, girdi = {}) {
  if (adim === KOC_ADIM.MOVE) return Boolean(girdi.left || girdi.right);
  if (adim === KOC_ADIM.JUMP) return Boolean(girdi.up);
  if (adim === KOC_ADIM.HIT) return Boolean(girdi.action);
  return false;
}

/**
 * @param {{adim: string, kilit?: number}|null} durum
 * @param {{left?: boolean, right?: boolean, up?: boolean, action?: boolean}} girdi
 * @param {number} dt
 */
export function kocAdimAt(durum, girdi, dt) {
  if (!durum || durum.adim === KOC_ADIM.DONE) return durum;
  const kilit = Math.max(0, (durum.kilit ?? 0) - dt);
  if (kilit > 0) return { ...durum, kilit };
  if (!kocGirdiUydu(durum.adim, girdi)) return { ...durum, kilit: 0 };
  if (durum.adim === KOC_ADIM.MOVE) return { adim: KOC_ADIM.JUMP, kilit: KOC_KILIT };
  if (durum.adim === KOC_ADIM.JUMP) return { adim: KOC_ADIM.HIT, kilit: KOC_KILIT };
  return { adim: KOC_ADIM.DONE, kilit: 0 };
}

export function kocVurgu(adim) {
  if (adim === KOC_ADIM.MOVE) return 'move';
  if (adim === KOC_ADIM.JUMP) return 'jump';
  if (adim === KOC_ADIM.HIT) return 'hit';
  return null;
}

/** Overlay metni: telefonda tuş, masaüstünde klavye. */
export function kocYaziAnahtar(adim, dokunmatik) {
  if (
    dokunmatik
    && (adim === KOC_ADIM.MOVE || adim === KOC_ADIM.JUMP || adim === KOC_ADIM.HIT)
  ) {
    return `koc.${adim}Touch`;
  }
  return `koc.${adim}`;
}

/**
 * Koç yalnız tek kişilik çevrimdışı ilk maçta.
 * Çevrimiçi topu durduramayız; iki kişide diğer oyuncu bekler.
 */
export function kocMacinaAl({ kocSeen, online, playMode, agRol } = {}) {
  if (kocSeen) return false;
  if (online || agRol) return false;
  if (playMode && playMode !== 'solo') return false;
  return true;
}
