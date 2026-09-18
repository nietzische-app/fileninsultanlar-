import {
  tarayiciAc,
  mobilBaglam,
  masaustuBaglam,
  sayfaAc,
  macaGir,
  kontrolcu,
} from './yardim.mjs';

/**
 * Kenar / çentik: viewport kenarında beyaz pillarbox olmamalı.
 *
 * Canvas 9:5 kalır (cover mahkemeyi kırpar). Yan pay salon veya
 * `#0b0b12` olur; html/body/sahne beyaz gösteremez.
 */

const check = kontrolcu();
const browser = await tarayiciAc();

async function ornekle(page) {
  return page.evaluate(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const noktalar = [
      [2, Math.floor(h / 2)],
      [w - 3, Math.floor(h / 2)],
      [Math.floor(w / 2), 2],
      [Math.floor(w / 2), h - 3],
    ];

    const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const root = document.getElementById('root');
    const rootBg = root ? getComputedStyle(root).backgroundColor : '';

    const beyazCss = (c) => {
      const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c || '');
      if (!m) return false;
      return +m[1] > 240 && +m[2] > 240 && +m[3] > 240;
    };

    const ornek = noktalar.map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return { x, y, miss: true, beyaz: true };
      let pixelBeyaz = false;
      if (el.tagName === 'CANVAS' && el.width && el.height) {
        const r = el.getBoundingClientRect();
        const sx = Math.max(0, Math.min(el.width - 1, Math.floor(((x - r.left) / r.width) * el.width)));
        const sy = Math.max(0, Math.min(el.height - 1, Math.floor(((y - r.top) / r.height) * el.height)));
        try {
          const d = el.getContext('2d').getImageData(sx, sy, 1, 1).data;
          pixelBeyaz = d[3] > 200 && d[0] > 240 && d[1] > 240 && d[2] > 240;
        } catch {
          pixelBeyaz = false;
        }
      }
      const bg = getComputedStyle(el).backgroundColor;
      return {
        x, y,
        tag: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : ''),
        bg,
        beyaz: beyazCss(bg) || pixelBeyaz,
      };
    });

    const stage = document.querySelector('.match-stage');
    const sb = stage?.getBoundingClientRect();
    return {
      htmlBg, bodyBg, rootBg,
      zeminBeyaz: beyazCss(htmlBg) || beyazCss(bodyBg) || beyazCss(rootBg),
      kenar: ornek,
      sahneDolu: sb
        ? Math.abs(sb.width - w) < 3 && Math.abs(sb.height - h) < 3
        : null,
    };
  });
}

const PROFILLER = [
  ['Pixel 5 yatay', 851, 393, true],
  ['iPhone 14 Pro Max yatay', 932, 430, true],
  ['Galaxy S20 yatay', 800, 360, true],
  ['ultra geniş 1280x360', 1280, 360, true],
];

for (const [ad, w, h] of PROFILLER) {
  const ctx = await mobilBaglam(browser, { width: w, height: h });
  const page = await sayfaAc(ctx);

  const menu = await ornekle(page);
  check(
    `${ad} · menü zemini beyaz değil`,
    !menu.zeminBeyaz,
    `html=${menu.htmlBg} body=${menu.bodyBg}`,
  );
  const menuBeyaz = menu.kenar.filter((k) => k.beyaz);
  check(
    `${ad} · menü kenarı beyaz değil`,
    menuBeyaz.length === 0,
    menuBeyaz.length ? menuBeyaz.map((k) => `${k.x},${k.y}:${k.tag}`).join(' ') : 'temiz',
  );

  await macaGir(page);
  const mac = await ornekle(page);
  check(
    `${ad} · maç zemini beyaz değil`,
    !mac.zeminBeyaz,
    `html=${mac.htmlBg} body=${mac.bodyBg}`,
  );
  const macBeyaz = mac.kenar.filter((k) => k.beyaz);
  check(
    `${ad} · maç kenarı beyaz değil`,
    macBeyaz.length === 0,
    macBeyaz.length ? macBeyaz.map((k) => `${k.x},${k.y}:${k.tag}`).join(' ') : 'temiz',
  );
  check(
    `${ad} · sahne viewport'u kaplıyor`,
    mac.sahneDolu === true,
    mac.sahneDolu === null ? 'sahne yok' : '',
  );

  await ctx.close();
}

{
  const ctx = await masaustuBaglam(browser, { width: 1280, height: 720 });
  const page = await sayfaAc(ctx);
  const menu = await ornekle(page);
  check('masaüstü menü zemini beyaz değil', !menu.zeminBeyaz, `html=${menu.htmlBg}`);
  await ctx.close();
}

await browser.close();
check.bitir('kenar / pillarbox');
