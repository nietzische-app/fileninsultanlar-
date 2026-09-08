import { Http3Server, WebTransport, quicheLoaded } from '@fails-components/webtransport';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
await quicheLoaded;
const SP='/tmp/claude-0/-home-user-fileninsultanlar-/7e231046-6ba7-50d6-a6aa-5e2ce09e2294/scratchpad';
const cert=readFileSync(`${SP}/c.pem`,'utf8'), key=readFileSync(`${SP}/k.pem`,'utf8');
const der=execFileSync('openssl',['x509','-in',`${SP}/c.pem`,'-outform','der']);
const fp=createHash('sha256').update(der).digest();

const s=new Http3Server({port:8840,host:'127.0.0.1',secret:'x'.repeat(40),cert,privKey:key});
s.startServer(); await s.ready;
const okuyucu=s.sessionStream('/wt').getReader();

(async()=>{
  const {value}=await okuyucu.read();
  console.log('OTURUM NESNESİ anahtarları:', Object.keys(value).join(', '));
  console.log('prototip:', Object.getOwnPropertyNames(Object.getPrototypeOf(value)).join(', '));
  const oturum = value;
  await oturum.ready;
  console.log('ready tamam');
  const r = oturum.incomingBidirectionalStreams.getReader();
  const {value: akis, done} = await r.read();
  console.log('gelen akış:', done ? 'DONE' : (akis ? 'VAR' : 'yok'));
  if (akis) {
    const w = akis.writable.getWriter();
    await w.write(new TextEncoder().encode('merhaba\n'));
    console.log('sunucu yazdı');
  }
})().catch(e=>console.log('SUNUCU HATA:',e.message));

await new Promise(r=>setTimeout(r,500));
const c=new WebTransport('https://127.0.0.1:8840/wt',{serverCertificateHashes:[{algorithm:'sha-256',value:fp}]});
await c.ready;
console.log('istemci hazır');
const akis=await c.createBidirectionalStream();
const w=akis.writable.getWriter();
await w.write(new TextEncoder().encode('selam\n'));
console.log('istemci yazdı');
const rr=akis.readable.getReader();
const {value:gel}=await rr.read();
console.log('istemci okudu:', new TextDecoder().decode(gel));
process.exit(0);
