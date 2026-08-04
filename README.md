# 🏐 Filenin Sultanları — Retro Volleyball

Türkiye Kadın Millî Voleybol Takımı'na, yani **Filenin Sultanları**'na saygı
duruşu niteliğinde, tarayıcıda oynanan 8-bit piksel voleybol oyunu.

Amaç basit: takımın sahada bıraktığı izi, retro bir arcade oyununa dönüştürmek.
Eda Erdem'in bloğu, Melissa Vargas'ın smacı, Gizem Örge'nin kurtarışı — hepsi
kırmızı-beyaz bir sahada, Türk bayraklarıyla dolu bir tribünün önünde.

> Hayran yapımı, ticari olmayan bir saygı projesidir; resmî bir ürün değildir.
> Oyuncu istatistikleri oyun dengesi içindir, gerçek performans ölçüsü değildir.
> Forma numaraları örnek değerlerdir (`src/game/players.js` içinden düzenlenebilir).

## Oynanış

**Modlar:** 1v1 ve 2v2 · **Zorluk:** Kolay / Normal / Zor

| Tuş | Aksiyon |
| --- | --- |
| `←` `→` veya `A` `D` | Hareket |
| `↑` veya `W` | Zıpla |
| `Boşluk` veya `Z` | Vur (manşet / smaç / blok) |
| `X` | **Sultan Gücü** — alevli smaç |
| `ESC` veya `P` | Duraklat |

Mobilde ekranın altında dokunmatik butonlar çıkar.

### Oyunun ritmi

Gerçek voleybol gibi çalışır ve oyunun bel kemiği budur:

1. **Sert gelen topa ilk temasta smaç vuramazsın.** Önce manşetle karşılarsın
   (vuruş tuşuna basmadan). Top kendi sahanda havalanır.
2. **İkinci temas pastır.** Vuruş tuşuyla topu file önüne kaldırırsın.
3. **Üçüncü temas hücumdur.** Zıpla + vuruş tuşu = smaç.

Bir taraf topu karşıya göndermeden **en fazla 3 kez** dokunabilir; dördüncüsü
faul, rakibe sayı. Ekranda "TEMAS" göstergesi kaç hakkın kaldığını gösterir.

### Sultan Gücü

Sayı aldıkça, blok yaptıkça ve fileyi geçen her vuruşta bar dolar. Dolduğunda
`X` ile ateşlersin: bir sonraki vuruşun **alevli** ve %55 daha hızlı olur, rakip
yapay zekâsının tepkisi yavaşlar. Ebrar Karakurt'un barı %30 daha hızlı dolar.

### Maç formatı

15 sayılık setler (2 fark, 21 tavan), 3 sette 2 kazanan maçı alır.
Bir maç ortalama 4–9 dakika sürer.

## Kadro

Her sultanın kendi stat dağılımı, forma rengi ve oyunu değiştiren bir bonusu var:

| # | Oyuncu | Mevki | Bonus |
| --- | --- | --- | --- |
| 4 | Eda Erdem (K) | Orta Oyuncu | **Kaptan Duruşu** — dengeli statlar, blokta %20 güç |
| 99 | Melissa Vargas | Pasör Çaprazı | **Top Sallama** — smaç hızı %25 fazla |
| 16 | Zehra Güneş | Orta Oyuncu | **Duvar** — %18 geniş erişim, yüksek kademe |
| 10 | Ebrar Karakurt | Smaçör | **Enerji Patlaması** — Sultan barı %30 hızlı dolar |
| 2 | Cansu Özbay | Pasör | **Hızlı Tempo** — en hızlı hareket, yüksek sıçrama |
| 7 | Gizem Örge | Libero | **Kurtarış** — manşette %30 güç, üstün savunma |
| 11 | Hande Baladın | Smaçör | **Çapraz Plase** — dengeli hücum, keskin açı |

## Kurulum

Node.js 18+ gerekir.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # build çıktısını önizle
npm run lint
```

## Vercel'e Dağıtım

Repo'yu Vercel'e bağlaman yeterli — `vercel.json` ayarları içeriyor. Elle
girmen gerekirse:

- **Framework Preset:** Vite
- **Build Command:** `npm run vercel-build`
- **Output Directory:** `dist`

Ortam değişkeni, backend ya da veritabanı yok; tamamen statik bir SPA.

## Teknoloji

| Katman | Seçim |
| --- | --- |
| Build | Vite 5 |
| UI / ekranlar | React 18 |
| Stil | Tailwind CSS 3 |
| Oyun | HTML5 Canvas 2D + `requestAnimationFrame` |
| Ses | Web Audio API (osilatörle üretilen 8-bit efektler, dosya yok) |
| Font | Press Start 2P (Google Fonts) |

## Dosya Yapısı

```
src/
├── main.jsx                  React mount
├── App.jsx                   Ekran akışı: start → select → match → result
├── index.css                 Tailwind katmanları, retro bileşenler, animasyonlar
├── screens/
│   ├── StartScreen.jsx       Giriş, Gurur Tablosu, kontroller
│   ├── CharacterSelect.jsx   Mod, zorluk ve kadro seçimi
│   ├── MatchScreen.jsx       Canvas + skor tablosu + Sultan barı + dokunmatik
│   └── ResultScreen.jsx      Kupa, konfeti, istatistikler, teşekkür mesajı
├── components/
│   ├── PixelAvatar.jsx       Sahadakiyle aynı sprite'ı çizen avatar
│   ├── Scoreboard.jsx        Türkiye vs Rakip, set takibi
│   ├── SultanBar.jsx         Özel yetenek barı
│   ├── StatBar.jsx           Piksel stat çubuğu
│   └── TouchControls.jsx     Mobil kontroller
└── game/
    ├── constants.js          Ölçüler, fizik, kurallar, palet, zorluk kademeleri
    ├── Game.js               Motor: döngü, fizik, çarpışma, skor, çizim
    ├── players.js            Kadro verisi, statlar, bonuslar
    ├── ai.js                 Rakip ve takım arkadaşı yapay zekâsı
    ├── sprites.js            Piksel çizimleri (sultan, top, bayrak, kupa)
    └── audio.js              8-bit ses motoru
```

## Mimari Notlar

**Motor React'ten bağımsızdır.** `Game.js` bir `<canvas>` alır, kendi döngüsünü
kurar ve dışarıya yalnızca `onState` / `onFinish` ile konuşur. React her karede
değil, sadece skor veya aşama değişince render olur (`emitState` imza
karşılaştırması yapar). Bu ayrımı korumak performans için önemli.

**Hücum vuruşları hedefe göre çözülür.** Sabit oranlı bir smaç formülü
(`vx = güç × k`) arka sahadan atıldığında topu kendi yarı sahasına düşürüyordu.
Bunun yerine rakip sahada bir hedef seçilir ve topu oraya götürecek hız
hesaplanır (`computeAttackVelocity`). Gereken hız üst sınırı aşarsa vektör
küçültülmez — uçuş süresi uzatılır, çünkü vektörü küçültmek hedefi bozar.

**Fizik sabitleri tek yerde.** `constants.js` içindeki `PHYSICS`, `RULES`,
`DIFFICULTY` nesnelerini değiştirerek oyunu yeniden dengeleyebilirsin; koda
gömülü sayı yok. Renkler hem burada (`PALETTE`) hem `tailwind.config.js` içinde
tanımlı — birini değiştirirken diğerini de güncelle.

**Zorluk kolu `error` değeridir.** Yapay zekânın tahmini düşüş noktasına
eklediği sapma. Temas dairesi ~53px olduğu için bunun altındaki sapmalar ıskaya
dönüşmez ve rakip hiç sayı vermez — kademeleri ayarlarken bunu göz önünde tut.

**Geliştirme kolaylığı:** dev modda motor `window.__game` üzerinden erişilebilir
(production build'de yoktur).

## Denge Ölçümü

Zorluk kademeleri, motoru headless sürerek ölçüldü — her hücre 7 maç, ortalama
seviyede bir oyuncuyu temsil eden bir bot ile:

| Mod | Kolay | Normal | Zor |
| --- | --- | --- | --- |
| 1v1 | %100 kazanma (32-22) | %43 (27-28) | %0 (17-30) |
| 2v2 | %100 (30-13) | %86 (33-21) | %0 (16-32) |

Yeniden dengeleme yaparsan aynı ölçümü tekrarlamak mantıklı: tek maç örneklemi
çok gürültülü, en az 5–7 maç ortalaması gerekiyor.

## Lisans

MIT — bkz. `LICENSE`.
