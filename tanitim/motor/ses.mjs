/**
 * Oyunun kendi giriş müziğini dalga dosyasına yazar.
 * `src/game/muzik.js` döngüsü olduğu gibi kullanılır; yeni bir parça yazılmaz.
 */
import { writeFileSync } from "node:fs";
import { muzikUret, MUZIK_SURE } from "../../src/game/muzik.js";

const HIZ = 44100;
const SURE = 20;

function sahteBaglam(sampleRate) {
  return {
    sampleRate,
    createBuffer(kanallar, uzunluk, hiz) {
      const veri = Array.from({ length: kanallar }, () => new Float32Array(uzunluk));
      return {
        sampleRate: hiz,
        length: uzunluk,
        numberOfChannels: kanallar,
        getChannelData: (i) => veri[i],
      };
    },
  };
}

const dongu = muzikUret(sahteBaglam(HIZ)).getChannelData(0);
const ornek = new Float32Array(Math.round(SURE * HIZ));
for (let i = 0; i < ornek.length; i += 1) {
  ornek[i] = dongu[i % dongu.length];
  const sn = i / HIZ;
  if (sn < 0.03) ornek[i] *= sn / 0.03;
  if (sn > SURE - 1.35) ornek[i] *= Math.max(0, (SURE - sn) / 1.35);
}

const tepe = ornek.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const tavan = Math.pow(10, -1 / 20);
const olcek = tepe > 0 ? tavan / tepe : 1;

const veri = Buffer.alloc(44 + ornek.length * 2);
veri.write("RIFF", 0);
veri.writeUInt32LE(36 + ornek.length * 2, 4);
veri.write("WAVE", 8);
veri.write("fmt ", 12);
veri.writeUInt32LE(16, 16);
veri.writeUInt16LE(1, 20);
veri.writeUInt16LE(1, 22);
veri.writeUInt32LE(HIZ, 24);
veri.writeUInt32LE(HIZ * 2, 28);
veri.writeUInt16LE(2, 32);
veri.writeUInt16LE(16, 34);
veri.write("data", 36);
veri.writeUInt32LE(ornek.length * 2, 40);
for (let i = 0; i < ornek.length; i += 1) {
  const n = Math.max(-1, Math.min(1, ornek[i] * olcek));
  veri.writeInt16LE(Math.round(n * 32767), 44 + i * 2);
}

writeFileSync(new URL("../assets/muzik.wav", import.meta.url), veri);
console.log(
  JSON.stringify({
    donguSaniye: MUZIK_SURE,
    sure: SURE,
    hiz: HIZ,
    bayt: veri.length,
  }),
);
