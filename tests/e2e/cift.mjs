import {
  tarayiciAc,
  mobilBaglam,
  sayfaAc,
  kontrolcu,
} from './yardim.mjs';

/**
 * Yerel Co-Op ve Karşılıklı: dokunmatik tuşlar sahada duruyor mu,
 * ve her takım kendi yuvasına mı yazıyor?
 *
 * Eskiden bu modlarda tuşlar gizleniyordu — "tek telefonda iki kişi
 * oynanamaz". Telefondan Co-Op'a giren oyuncu sahaya tuşsuz düşüyordu.
 */

const check = kontrolcu();

const browser = await tarayiciAc();

async function modaGir(page, { name, start, wait = 2400 } = {}) {
  await page.getByRole('button', { name }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: start }).last().click();
  await page.waitForTimeout(wait);
}

function tuslar(page) {
  return page.evaluate(() => {
    const out = { p1: {}, p2: {}, hepsi: [] };
    document.querySelectorAll('.touch-button').forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width <= 0) return;
      const slot = n.getAttribute('data-slot') || 'p1';
      const etiket = n.getAttribute('aria-label') || (n.textContent || '').trim();
      const kutu = {
        etiket,
        slot,
        x: Math.round(r.x + r.width / 2),
        y: Math.round(r.y + r.height / 2),
        sol: Math.round(r.left),
      };
      out[slot][etiket] = kutu;
      out.hepsi.push(kutu);
    });
    return out;
  });
}

async function bas(page, ctx, kutu) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: kutu.x, y: kutu.y, id: 1 }],
  });
  await page.waitForTimeout(120);
  const girdi = await page.evaluate(() => ({
    p1: { ...window.__game?.inputs?.p1 },
    p2: { ...window.__game?.inputs?.p2 },
  }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(80);
  return girdi;
}

// --- Co-Op ---
{
  const ctx = await mobilBaglam(browser, { width: 851, height: 393 });
  const page = await sayfaAc(ctx, {
    homeIds: ['gizel-orgen', 'derya-basyolu'],
    mode: '2v2',
    format: 'practice',
  });
  await modaGir(page, { name: /CO-OP/, start: /İKİ KİŞİ BAŞLA/ });

  check('Co-Op maç ekranı açıldı', Boolean(await page.evaluate(() => window.__game)));

  const t = await tuslar(page);
  const p1Sayi = Object.keys(t.p1).length;
  const p2Sayi = Object.keys(t.p2).length;
  check('Co-Op: 1. oyuncu tuşları var', p1Sayi >= 4, `p1=${p1Sayi}`);
  check('Co-Op: 2. oyuncu tuşları var', p2Sayi >= 4, `p2=${p2Sayi}`);
  check('Co-Op: çift takım (8 tuş)', t.hepsi.length >= 8, `toplam=${t.hepsi.length}`);

  const p1Sag = t.hepsi.find((b) => b.slot === 'p1' && /Sağa git/.test(b.etiket));
  const p2Sol = t.hepsi.find((b) => b.slot === 'p2' && /Sola git/.test(b.etiket));
  check('Co-Op: 1. takım solda', p1Sag && p2Sol && p1Sag.sol < p2Sol.sol,
    p1Sag && p2Sol ? `p1.sol=${p1Sag.sol} p2.sol=${p2Sol.sol}` : 'tuş yok');

  if (p1Sag) {
    const g = await bas(page, ctx, p1Sag);
    check('Co-Op: sağ tuş p1 yuvasına yazılıyor', g.p1?.right === true && g.p2?.right !== true,
      `p1.right=${g.p1?.right} p2.right=${g.p2?.right}`);
  } else {
    check('Co-Op: p1 sağ tuşu bulundu', false);
  }

  if (p2Sol) {
    const g = await bas(page, ctx, p2Sol);
    check('Co-Op: sol tuş p2 yuvasına yazılıyor', g.p2?.left === true && g.p1?.left !== true,
      `p2.left=${g.p2?.left} p1.left=${g.p1?.left}`);
  } else {
    check('Co-Op: p2 sol tuşu bulundu', false);
  }

  await ctx.close();
}

// --- Karşılıklı ---
{
  const ctx = await mobilBaglam(browser, { width: 851, height: 393 });
  const page = await sayfaAc(ctx, { format: 'practice' });
  await modaGir(page, { name: /KARŞILIKLI/, start: /İKİ KİŞİ BAŞLA/ });

  const t = await tuslar(page);
  check('VS: çift takım görünür', t.hepsi.length >= 8, `toplam=${t.hepsi.length}`);

  const p2Vur = t.hepsi.find((b) => b.slot === 'p2' && /Vur/.test(b.etiket));
  if (p2Vur) {
    const g = await bas(page, ctx, p2Vur);
    check('VS: VUR p2 yuvasına yazılıyor', g.p2?.action === true && g.p1?.action !== true,
      `p2.action=${g.p2?.action} p1.action=${g.p1?.action}`);
  } else {
    check('VS: p2 VUR tuşu bulundu', false);
  }

  await ctx.close();
}

await browser.close();
check.bitir('yerel çift tuş');
