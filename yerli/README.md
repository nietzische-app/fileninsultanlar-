# Yerli (masaüstü) istemci

Tarayıcısız çalışan Retro Voleybol istemcisi: SDL penceresi, Canvas2D
(node-canvas) ve doğrudan WebSocket/QUIC bağlantısı. **Motor birebir
aynı** — `src/game/Game.js` hiç değiştirilmedi.

## Dürüst beklenti

Bu istemcinin ağ gecikmesini düşürmesi **beklenmiyor** ve ölçüm de
düşürmediğini gösterdi. Aynı ağda, aynı röleye karşı:

| ölçüt | Node (tarayıcısız) | Tarayıcı |
| --- | --- | --- |
| ping | 50 ms | 51-56 ms |
| seğirme | 3 ms | 1-5 ms |
| tampon | 33 ms | 31-33 ms |
| gerilik | 30 ms | 32-38 ms |

Yani "tarayıcı gecikme ekliyor" hipotezi ölçüldü ve **doğrulanmadı**.

Kazanabileceği tek yer ekrana basma gecikmesi ve tarayıcının kendi kare
zamanlaması — ikisi de teşhis katmanının ölçmediği şeyler. Bu istemci
onları ölçmeyi mümkün kılıyor, otomatik iyileştirmiyor.

## Ne işe yarar

- Tarayıcının payını denklemden **çıkarmak** (aynı motor, aynı protokol)
- WebTransport'u tarayıcı desteği beklemeden denemek
- Uzun süreli dayanım koşumları

## Kurulum

```bash
cd yerli
npm install
npm start
```

Bağımlılıklar native derleme istiyor (`canvas`, `@kmamal/sdl`).
Linux'ta genelde hazır ikili geliyor; gelmezse derleyici gerekir.

## Kullanım

```bash
RELE=wss://rele.retrovoleybol.online npm start
TANI=1 npm start        # sol üstte canlı teşhis sayıları
OLCEK=2 npm start       # pencere ölçeği
```

Açılınca hızlı eşleşme sırasına giriyor; karşı taraftan
**ÇEVRİMİÇİ → HEMEN OYNA** ile eşleş.

**Tuşlar:** WASD ya da ok tuşları, vuruş `boşluk`/`Z`, dalış `S`/`↓`.

## Ekransız makinede ön kontrol

```bash
node yerli/dogrula.mjs
```

Pencere açmadan üç şeyi sınıyor: kabuk motoru ayakta tutuyor mu, motor
tuvale **gerçekten** piksel basıyor mu, klavye oyuncuyu oynatıyor mu.

İkincisi önemli: `getContext('2d')` hata vermeden boş bir tuval de
döndürebilir — "çöküyor mu" diye bakan bir kontrol siyah bir pencereyi
başarı sayardı. Bu kontrol bir gerçek hata yakaladı: SDL tuş adlarını
`KeyboardEvent.code`a çevirmiştim, oysa motor `event.key` okuyor;
belirtisi "tuşlar çalışmıyor" olurdu ve ağ sorunuyla karıştırılabilirdi.

## Kabuk (`kabuk.mjs`)

Motor tarayıcı için yazıldı ve üç şeye dokunuyor:
`document.createElement('canvas')`, `window.addEventListener` ve
`requestAnimationFrame`. Kabuk o üçünü Node'da karşılıyor.

Motora `if (yerliyse)` dalları **eklemedik**: yerli istemcinin bütün
değeri "aynı motoru çalıştırmak", motoru dallandırmak ölçmek
istediğimiz farkı kodun içine taşırdı.

Ses yok — Web Audio Node'da yok ve ses motoru zaten bağlam kuramayınca
sessiz kalıyor.
