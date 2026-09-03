# Röle sunucusu

Çevrimiçi maçların buluşma noktası. Oyunu **simüle etmez**: oda koduyla
iki istemciyi eşleştirir ve aralarındaki mesajları taşır. Maçı odayı
açan taraf koşturur, katılan taraf onun ürettiği durumu çizer.

## Neden röle, neden lockstep değil

Lockstep mimaride sunucu yalnız tuşları taşır, iki makine de simülasyonu
kendi çalıştırır — ve aynı girdiden aynı sonucu üretmek zorundadır.
Bu oyunun simülasyon yolunda 30'dan fazla `Math.random()` çağrısı var
(ai.js 7, Game.js 6, serve.js 8, effects.js 15). Hepsini tohumlu üretece
çevirmek ayrı bir proje; çevirmeden lockstep denenirse iki taraftaki maç
birkaç saniyede birbirinden kopar.

Ev sahibi yetkili (host-authoritative) mimaride rastgelelik tek yerde
çalışıyor, öbür taraf sonucu okuyor. Determinizm gerekmiyor.

## Çalıştırma

```bash
npm install          # bu dizinde
npm start            # ws://localhost:8787
```

Depo kökünden `npm run rele` de aynı işi yapar.

Oyunu ona bağlamak için `VITE_RELE_URL` ile yapı alın:

```bash
VITE_RELE_URL=wss://rele.example.com npm run build
```

Bu değişken tanımlı değilse menüde **ÇEVRİMİÇİ** seçeneği hiç
görünmez — çalışmayan bir düğme, basılana kadar süren bir yalandır.

Geliştirmede `?rele=ws://localhost:8787` sorgu parametresiyle de
ezilebilir. Üretim yapısında bu parametre okunmaz: paylaşılan bir
bağlantının oyuncuyu yabancı bir sunucuya bağlaması istenmiyor.

## Dağıtım

Vercel kalıcı WebSocket taşımıyor; röle ayrı bir yerde durmalı.
Fly.io, Railway ve Render'ın küçük katmanları yeter — sunucu durum
tutuyor ama ağır değil (oda başına iki soket, mesaj başına tek
`send`).

İki nokta:

- **Uyuyan örnek.** Ücretsiz katmanlar boştaki örneği uyutuyor ve ilk
  bağlantı 10-20 saniye sürüyor. Oda kodunu girip bekleyen iki arkadaş
  o sürede vazgeçer. `/saglik` ucu bunun için var: dışarıdan dakikada
  bir çağrılırsa örnek uyanık kalır. Kalıcı çözüm uyumayan bir katman.
- **TLS.** Oyun `https://` üzerinden servis ediliyorsa tarayıcı `ws://`
  bağlantısına izin vermez; röle `wss://` olmalı. Barındırma katmanları
  bunu genelde kendi veriyor.

## Protokol

Sunucu oyun protokolünü **bilmez**. `oda-*` ve `ayril` dışındaki her
mesaj karşı tarafa ham metin olarak aktarılır; oyun paketleri değişince
sunucuyu yeniden dağıtmak gerekmez.

| Yön | Mesaj | Anlam |
|---|---|---|
| → | `{t:'oda-ac'}` | Yeni oda aç |
| → | `{t:'oda-gir', kod}` | Odaya katıl |
| → | `{t:'ayril'}` | Odadan çık |
| ← | `{t:'oda', kod, rol}` | Oda kuruldu / katılındı |
| ← | `{t:'eslesme', rol}` | İki taraf da hazır |
| ← | `{t:'ayrildi', kapandi}` | Karşı taraf gitti |
| ← | `{t:'hata', sebep}` | İstek reddedildi |
| ↔ | diğer her şey | Karşı tarafa aktarılır |

Oyun paketleri (`durum`, `girdi`, `mac`, `bitis`) `src/game/snapshot.js`
ve `src/screens/OnlineScreen.jsx` içinde tanımlı.

## Sınırlar

- Tek mesaj en fazla 16 KB (`maxPayload`).
- Saniyede 150 mesaj; aşan bağlantı kapatılır. Normal akış ~80
  (ev sahibi 20 durum, misafir tuş değiştikçe).
- Aynı anda 500 oda.
- 30 saniyede bir ping/pong; yanıtsız soket düşürülür. Mobilde ağ
  değişince soket "açık" görünüp hiçbir şey taşımayabiliyor; bu
  olmadan oda sonsuza kadar dolu kalır ve kimse o koda katılamaz.
- Kimse katılmazsa oda 15 dakikada süpürülür.

## Testler

`npm test` (depo kökünde) sunucu testlerini de koşturur:

- `oda.test.js` — eşleşme mantığı, soketsiz.
- `rele.test.js` — gerçek WebSocket'lerle tel üzerindeki davranış.

Uçtan uca sınamayı `npm run e2e online` yapıyor: iki gerçek tarayıcı,
bu sunucunun bir örneği, menüden sahaya kadar tam yol.
