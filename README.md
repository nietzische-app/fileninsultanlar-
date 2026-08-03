# 🏐 Filenin Sultanları — Retro Voleybol

Türkiye Kadın Millî Voleybol Takımı'na, yani **Filenin Sultanları**'na saygı duruşu
niteliğinde, tarayıcıda çalışan retro piksel voleybol oyunu.

Amaç basit: takımın sahada bıraktığı izi, 8-bit estetiğiyle oynanabilir bir şeye
dönüştürmek. Eda Erdem'in bloğu, Melissa Vargas'ın smacı, Gizem Örge'nin kurtarışı —
hepsi kırmızı-beyaz bir sahada, piksel piksel.

> Bu proje resmî bir ürün değildir; hayran yapımı, ticari olmayan bir saygı projesidir.
> Oyuncu istatistikleri oyun dengesi için uydurulmuştur, gerçek performans ölçüsü değildir.

## Teknoloji

| Katman | Seçim |
| --- | --- |
| Build | Vite 5 |
| UI | React 18 |
| Stil | Tailwind CSS 3 |
| Oyun | HTML5 Canvas 2D + `requestAnimationFrame` |
| Font | Press Start 2P (Google Fonts CDN) |
| Dağıtım | Vercel |

## Kurulum

Node.js 18 veya üzeri gerekir.

```bash
# bağımlılıkları kur
npm install

# geliştirme sunucusu (http://localhost:5173)
npm run dev

# production build
npm run build

# build çıktısını önizle
npm run preview
```

## Vercel'e Dağıtım

Repo'yu Vercel'e bağladığında ayarlar otomatik algılanır. Elle girmen gerekirse:

- **Framework Preset:** Vite
- **Build Command:** `npm run vercel-build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

## Dosya Yapısı

```
.
├── index.html            # Giriş noktası, retro font CDN, #root
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src
    ├── main.jsx          # React mount
    ├── App.jsx           # Canvas + skor tablosu + kadro şeridi
    ├── index.css         # Tailwind katmanları ve retro yardımcı sınıflar
    └── game
        ├── Game.js       # Oyun motoru: rAF döngüsü, fizik, render
        └── players.js    # Kadro verisi, statlar, renkler, diziliş
```

## Kontroller

| Tuş | Aksiyon |
| --- | --- |
| `←` / `→` (veya `A` / `D`) | Hareket |
| `Boşluk` / `↑` / `W` | Zıpla (smaç için) |

## Mimari Notlar

**Motor React'ten bağımsızdır.** `Game.js` sadece bir `<canvas>` elementi alır,
kendi döngüsünü kurar ve dışarıya `onStateChange` callback'i ile skor bilgisi
yollar. React tarafı oyunun her karesinde yeniden render olmaz — sadece skor
değiştiğinde. Bu ayrımı korumak performans açısından önemli.

**Veri katmanı ayrı.** Oyuncu isimleri, statları, renkleri ve dizilişi
`players.js` içinde. Motor bu verileri okur; oyuncu eklemek/çıkarmak için
motora dokunman gerekmez.

**Koordinat sistemi.** Yan görünüş (side-view) arcade düzeni: sol yarı saha
Türkiye, sağ yarı rakip, ortada file. `FORMATION` içindeki `y` değeri sahte
derinlik olarak kullanılır — küçük `y` arka sıra (daha küçük çizilir),
büyük `y` ön sıra.

## Cursor ile Geliştirme

Motorda genişletilmeyi bekleyen yerler `TODO(cursor)` ile işaretli. Aramak için:

```bash
grep -rn "TODO(cursor)" src/
```

### Sıradaki adımlar (öncelik sırasıyla)

1. **Top–oyuncu çarpışması.** `Game.update()` içinde. Topun oyuncunun kol
   hitbox'ına değmesi durumunda `ball.vy` ve `ball.vx`'i oyuncunun
   `stats.attack` / `stats.defense` değerine göre ölçekle.
2. **Sayı kuralları.** `handlePointScored()` şu an topun hangi yarı sahada
   yere düştüğüne bakıyor. Rally sayı sistemi (25 sayı, 2 fark) ve set
   mantığı eklenmeli.
3. **Rakip yapay zekâsı.** Sağ yarı sahaya basit bir takipçi AI — topun
   düşüş noktasını tahmin edip oraya yürüsün, zorluk seviyesine göre hata payı.
4. **Rotasyon ve servis.** `STARTING_SIX` dizisini sayı sonrası kaydır.
5. **Sprite'lar.** `drawPlayer()` şu an blok çiziyor. Sprite sheet'e geçerken
   `players.js`'teki `colors` alanını palet swap için kullan.
6. **Ses.** Vuruş, blok ve sayı sesleri; Web Audio API ile 8-bit tonlar.

### Kodda uyulması beklenenler

- Yorumlar ve arayüz metinleri **Türkçe**.
- Motor içinde React import etme; `Game.js` saf JavaScript kalmalı.
- Renkler `PALETTE` (Game.js) ve `tailwind.config.js` içinde tanımlı —
  yeni sabit renk eklerken ikisini de güncelle.
- Fizik sabitleri `PHYSICS` nesnesinde toplu; sayıları koda gömme.
- `update(dt)` her zaman delta-time kullanır, kare sayısına bağlı mantık yazma.

## Kadro

| # | Oyuncu | Mevki |
| --- | --- | --- |
| 4 | Eda Erdem (K) | Orta Oyuncu |
| 99 | Melissa Vargas | Pasör Çaprazı |
| 16 | Zehra Güneş | Orta Oyuncu |
| 10 | Ebrar Karakurt | Smaçör |
| 2 | Cansu Özbay | Pasör |
| 7 | Gizem Örge | Libero |
| 11 | Hande Baladın | Smaçör |

Forma numaraları örnek değerlerdir; güncel kadroya göre `src/game/players.js`
içinden düzenlenebilir.

## Lisans

MIT — bkz. `LICENSE`.
