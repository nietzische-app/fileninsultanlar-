/**
 * Tarayıcı testi koşucusu.
 *
 * Kendi geliştirme sunucusunu boş bir portta başlatır, `tests/e2e`
 * altındaki testleri sırayla koşturur ve özet basar. Sunucu her koşumda
 * yeniden kurulur — bu oturumda birkaç kez, DEĞİŞİKLİKTEN ÖNCE açılmış
 * bir sunucuya karşı ölçüm yapıp yanlış sonuç aldım; tazelik garantisi
 * ölçümün kendisi kadar önemli.
 *
 * Kullanım:
 *   npm run e2e              tüm testler
 *   npm run e2e serit dalis  yalnızca adı geçenler
 */

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5199);
const URL = `http://localhost:${PORT}/`;

const istenen = process.argv.slice(2);
const testler = readdirSync(join(KOK, 'e2e'))
  .filter((f) => f.endsWith('.mjs') && !f.startsWith('_') && f !== 'yardim.mjs')
  .map((f) => f.replace(/\.mjs$/, ''))
  .filter((ad) => istenen.length === 0 || istenen.includes(ad))
  .sort();

if (testler.length === 0) {
  console.error('Eşleşen test yok.');
  process.exit(1);
}

/** Sunucu ayağa kalkana kadar bekle. */
async function sunucuyuBekle(ms = 40000) {
  const bitis = Date.now() + ms;
  while (Date.now() < bitis) {
    try {
      const r = await fetch(URL, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return true;
    } catch {
      // henüz hazır değil
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function calistir(komut, args, opts = {}) {
  return new Promise((res) => {
    const p = spawn(komut, args, { stdio: 'inherit', ...opts });
    p.on('close', (kod) => res(kod ?? 1));
  });
}

const sunucu = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: join(KOK, '..'),
  stdio: 'ignore',
});

let kapandi = false;
const sunucuyuKapat = () => {
  if (kapandi) return;
  kapandi = true;
  sunucu.kill('SIGTERM');
};
process.on('exit', sunucuyuKapat);
process.on('SIGINT', () => { sunucuyuKapat(); process.exit(130); });

if (!(await sunucuyuBekle())) {
  console.error(`Sunucu ${URL} adresinde açılmadı.`);
  sunucuyuKapat();
  process.exit(1);
}

const sonuc = [];
for (const ad of testler) {
  console.log(`\n═══ ${ad}`);
  const kod = await calistir('node', [join(KOK, 'e2e', `${ad}.mjs`)], {
    cwd: join(KOK, '..'),
    env: { ...process.env, OYUN_URL: URL },
  });
  sonuc.push({ ad, kod });
}

sunucuyuKapat();

const basarisiz = sonuc.filter((s) => s.kod !== 0);
console.log(`\n${'─'.repeat(46)}`);
for (const s of sonuc) console.log(`${s.kod === 0 ? '✓' : '✗'} ${s.ad}`);
console.log(
  basarisiz.length === 0
    ? `\n${sonuc.length} test geçti.`
    : `\n${basarisiz.length}/${sonuc.length} test başarısız: ${basarisiz.map((s) => s.ad).join(', ')}`
);
process.exit(basarisiz.length === 0 ? 0 : 1);
