import {
  tarayiciAc,
  mobilBaglam,
  masaustuBaglam,
  sayfaAc,
  kontrolcu,
} from './yardim.mjs';

/**
 * Açılış ekranı: mod tuşları ilk bakışta, kaydırmadan.
 *
 * Eskiden RETRO VOLEYBOL başlığı + gurur tablosu + vitrin ilk ekranı
 * yiyor, tuşlar aşağıda kalıyordu. Rekoru olan oyuncuda tablo daha da
 * şişiyordu. Bu dosya o kaydırmayı bekçiliyor.
 */

const check = kontrolcu();
const browser = await tarayiciAc();

const KAYITLI = {
  wins: 12,
  losses: 4,
  matchesPlayed: 16,
  longestRally: 22,
  mostSpikes: 8,
  mostBlocks: 3,
  mostSaves: 5,
  winStreak: 2,
  bestWinStreak: 6,
  tournamentsWon: 1,
  bestTournamentRound: 4,
  bestSurvivalPoints: 48,
  bestSurvivalWave: 5,
};

const PROFILLER = [
  ['masaüstü 1280x720', false, 1280, 720],
  ['masaüstü 1366x768', false, 1366, 768],
  ['iPhone SE yatay', true, 667, 375],
  ['Pixel 5 yatay', true, 851, 393],
  ['Galaxy S20 yatay', true, 800, 360],
];

async function ekranOlcu(page) {
  return page.evaluate(() => {
    const h = window.innerHeight;
    const baslik = document.querySelector('h1');
    const hb = baslik?.getBoundingClientRect();
    const tuslar = [...document.querySelectorAll('[data-mode]')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.getAttribute('data-mode'),
        ad: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        tam: r.height > 8 && r.top >= -2 && r.bottom <= h + 2,
      };
    });
    return {
      h,
      baslikAlt: hb ? Math.round(hb.bottom) : null,
      baslikYazi: (baslik?.textContent || '').replace(/\s+/g, ' ').trim(),
      tuslar,
    };
  });
}

for (const [ad, mobil, w, h] of PROFILLER) {
  const ctx = mobil
    ? await mobilBaglam(browser, { width: w, height: h })
    : await masaustuBaglam(browser, { width: w, height: h });
  const page = await sayfaAc(ctx);
  await page.evaluate((kayit) => {
    localStorage.setItem('retro-voleybol-records', JSON.stringify(kayit));
    localStorage.setItem(
      'retro-voleybol-achievements',
      JSON.stringify(['ilk-mac', 'ilk-galibiyet', 'seri-3']),
    );
  }, KAYITLI);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);

  const olcu = await ekranOlcu(page);
  const eksik = olcu.tuslar.filter((t) => !t.tam);

  check(
    `${ad} · en az beş mod tuşu`,
    olcu.tuslar.length >= 5,
    olcu.tuslar.map((t) => t.id).join(',') || 'hiç',
  );
  check(
    `${ad} · tüm mod tuşları kaydırmadan görünür`,
    eksik.length === 0,
    eksik.length
      ? eksik.map((t) => `${t.id}@${t.top}-${t.bottom}/${olcu.h}`).join(' ')
      : olcu.tuslar.map((t) => t.id).join(' · '),
  );
  check(
    `${ad} · başlık kompakt (ilk 88px)`,
    olcu.baslikAlt !== null && olcu.baslikAlt <= 88,
    `h1 alt=${olcu.baslikAlt} yazi=${olcu.baslikYazi}`,
  );

  await ctx.close();
}

await browser.close();
check.bitir('açılış ekranı');
