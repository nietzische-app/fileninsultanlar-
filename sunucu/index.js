/**
 * Röle sunucusunun giriş noktası.
 *
 *   node sunucu/index.js
 *
 * Ortam değişkeni: PORT (varsayılan 8787).
 */

import { baslat } from './rele.js';

const { port } = await baslat({ port: Number(process.env.PORT ?? 8787) });
console.log(`Röle ayakta — ws://localhost:${port} · sağlık: http://localhost:${port}/saglik`);
