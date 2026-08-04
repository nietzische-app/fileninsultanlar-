# 🏐 Filenin Sultanları — Retro Volleyball

Türkiye Kadın Millî Voleybol Takımı'na, yani **Filenin Sultanları**'na saygı
duruşu niteliğinde, tarayıcıda oynanan 8-bit piksel voleybol oyunu.

Amaç basit: takımın sahada bıraktığı izi, retro bir arcade oyununa dönüştürmek.
Zehra Güneş'in bloğu, Melissa Vargas'ın smacı, Gizem Örge'nin kurtarışı — hepsi
kırmızı-beyaz bir sahada, Türk bayraklarıyla dolu bir tribünün önünde.

> Hayran yapımı, ticari olmayan bir saygı projesidir; resmî bir ürün değildir.
>
> Forma numarası, mevki, doğum tarihi, boy ve kilo gerçek kadro bilgisidir.
> **Statlar ve bonuslar ise kurgusaldır** — mevki ve fiziksel özelliklerden
> türetilmiş oyun dengesi değerleridir, gerçek sporcu performansının ölçüsü
> değildir. Saç modeli ve aksesuarlar da stilize tercihlerdir.

## Oynanış

**Modlar:** 1v1 ve 2v2 · **Zorluk:** Kolay / Normal / Zor

| Tuş | Aksiyon |
| --- | --- |
| `←` `→` veya `A` `D` | Hareket |
| `↑` veya `W` | Zıpla |
| `↓` veya `S` | **Dalış** — yere düşmek üzere olan topa uzan |
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
faul, rakibe sayı. Duvar skorbordlarının altındaki üç nokta kaç hakkın
kaldığını gösterir.

### Dalış kurtarışı

Koşarak yetişemeyeceğin topa `↓` ile dalarsın: oyuncu yatay olarak fırlar ve
yerde kayar; bu sırada temas alanı alçalıp genişler, yani yere değmek üzere
olan topu yakalar. Kurtarılan top yükseğe ve yakına kalkar, toparlanıp
hücuma geçecek zamanın olur.

Bedeli var: kaymadan sonra oyuncu kısa süre yerde kalır ve yönlendirilemez.
Iskalanan dalış yarım saniyeyi kaybettirir, o yüzden son çare olarak
kullanılmalı — koşarak yetişebiliyorsan koş. Rakip yapay zekâsı da dalar.

### Sultan Gücü

Sayı aldıkça, blok yaptıkça ve fileyi geçen her vuruşta bar dolar. Dolduğunda
`X` ile ateşlersin: bir sonraki vuruşun **alevli** ve %55 daha hızlı olur, rakip
yapay zekâsının tepkisi yavaşlar. Ebrar Karakurt'un barı %30 daha hızlı dolar.

### Maç formatı

15 sayılık setler (2 fark, 21 tavan), 3 sette 2 kazanan maçı alır.
Bir maç ortalama 4–9 dakika sürer.

## Kadro

15 aktif sultan + 2 bonus oyuncu; her birinin kendi statları ve oyunu
değiştiren bir yetenek bonusu var. Künye bilgileri (doğum, boy, kilo)
karakter seçim ekranında görünür.

**Kaptan:** Gizem Örge (`captain: true` — sprite'ta pazıbandı).

| # | Oyuncu | Mevki | Boy | Bonus |
| --- | --- | --- | --- | --- |
| 1 | Gizem Örge ★ | Libero | 170 | **Kurtarış** — manşette %30 güç, üstün savunma |
| 3 | Cansu Özbay | Pasör | 182 | **Hızlı Tempo** — en hızlı hareket, yüksek sıçrama |
| 6 | Saliha Şahin | Smaçör | 186 | **Çift Yönlü** — hücum ve savunmada dengeli |
| 7 | Hande Baladın | Smaçör | 190 | **Çapraz Plase** — keskin açı |
| 8 | Sinead Jack-Kısal | Orta Oyuncu | 190 | **Tecrübeli Duvar** — blokta %22 güç |
| 10 | Eylül Akarçeşme Yatgın | Libero | 173 | **Seri Refleks** — sahanın en hızlısı |
| 12 | Elif Şahin | Pasör | 189 | **Uzun Pasör** — pasör hızı + orta oyuncu erişimi |
| 13 | Dilay Özdemir | Pasör | 187 | **Sakin Dağıtım** — istikrarlı pas |
| 15 | Deniz Uyanık | Orta Oyuncu | 195 | **Yüksek Kademe** — file üstünde erişim |
| 16 | Berka Buse Özden | Orta Oyuncu | 187 | **Genç Enerji** — Sultan barı %20 hızlı dolar |
| 18 | Zehra Güneş | Orta Oyuncu | 198 | **Duvar** — en geniş erişim, en sert blok |
| 20 | Yaprak Erkek | Smaçör | 182 | **Hafif Ayak** — en çevik smaçör |
| 22 | İlkin Aydın | Smaçör | 183 | **Servis Ateşi** — sert servis ve smaç |
| 44 | Melissa Vargas | Pasör Çaprazı | 194 | **Top Sallama** — smaç hızı %25 fazla |
| 91 | Defne Başyolcu | Smaçör | 192 | **Taze Kan** — çevik, bar hızlı dolar |

### Bonus kadro

Milletler Ligi'nde dinlenen sultanlar — seçim ekranında ayrı bölümde,
`guest: true` ile işaretli:

| # | Oyuncu | Mevki | Boy | Bonus |
| --- | --- | --- | --- | --- |
| 14 | Eda Erdem | Orta Oyuncu | 188 | **Efsane Duvar** — blokta %24 güç |
| 99 | Ebrar Karakurt | Pasör Çaprazı | 195 | **Kara Kurt** — sert smaç, bar %30 hızlı dolar |

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
| Grafik | %100 kod — PNG/JPG/SVG yok, `drawImage` yok |
| Ses | Web Audio API (osilatörle üretilen 8-bit efektler, dosya yok) |
| Font | Arayüzde Press Start 2P; forma numaraları kendi piksel fontumuz |

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
│   ├── MuteButton.jsx        Ses aç/kapa (tüm ekranlar)
│   └── TouchControls.jsx     Mobil kontroller
├── game/
│   ├── constants.js          Ölçüler, fizik, kurallar, palet, zorluk kademeleri
│   ├── Game.js               Motor: döngü, fizik, çarpışma, skor, çizim
│   ├── players.js            Kadro verisi, statlar, bonuslar, görünüm
│   ├── ai.js                 Rakip ve takım arkadaşı yapay zekâsı
│   ├── sprites.js            Piksel çizimleri (sultan, top, bayrak, kupa, rakamlar)
│   ├── arena.js              Salon, tribün, zemin ve file çizimi
│   └── audio.js              8-bit ses motoru
└── utils/
    ├── text.js               Türkçe büyük harf yardımcısı
    └── storage.js            Mute / son seçim localStorage
```

## Karakter Özelleştirme

Projede **tek bir görsel dosyası yok**. Sultanlar, voleybol topu, file, tribün,
Türk bayrakları, kupa ve forma numaraları dahil her şey `src/game/sprites.js`
içinde Canvas 2D API'siyle (`ctx.fillRect`, `ctx.arc`) blok blok çizilir.
Sekme simgesi bile çalışma anında canvas'tan üretilir (`createFaviconDataUrl`).

Bir karakterin görünümü tamamen `src/game/players.js` içinden değiştirilir:

```js
{
  name: 'İlkin Aydın',
  number: 22,                    // formaya piksel fontla basılır
  captain: false,                // true ise kaptan pazıbandı çizilir
  guest: false,                  // true ise bonus kadro bölümünde listelenir
  birthDate: '2000-01-05',       // bilinmiyorsa null → arayüzde '—'
  height: 183,
  weight: 67,
  colors: {
    primary: '#E30A17',          // forma gövdesi
    secondary: '#FFFFFF',        // yaka, yan şerit, numara rengi
    skin: '#EFC7A6',
    hair: '#1F1410',             // saç rengi
    accent: '#FF7A18',           // kaptan pazıbandı ve arayüz vurgusu
  },
  appearance: {
    hairStyle: 'short',          // 'short'|'ponytail'|'bun'|'long'|'braid'
    headband: '#FF7A18',         // kafa bandı — null ise takmaz
    wristband: '#FF7A18',        // bileklik — null ise takmaz
    kneePads: '#1B1B2E',         // dizlik — null ise takmaz
  },
}
```

Liberolar (Gizem Örge, Eylül Akarçeşme Yatgın) kural gereği farklı renkte forma
giyer; bu `LIBERO_KIT` sabitiyle verilir.

Aksesuar alanlarında `null` "bu parçayı çizme" demektir; eksik bırakılan alanlar
`DEFAULT_APPEARANCE` ile tamamlanır. Yeni bir saç modeli eklemek için
`HAIR_STYLES` dizisine adını yaz ve `sprites.js` içindeki `drawHair`
fonksiyonuna bir `case` ekle.

Aynı çizim fonksiyonu hem sahada hem karakter seçim ekranındaki avatarlarda
kullanılır (`PixelAvatar`), yani bir renk değişikliği iki yerde birden görünür.

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

**Dalış bir son çaredir, motor bunu bilir.** Yapay zekâ (ve denge testindeki
bot) yalnızca koşarak yetişemeyeceği, dalışın gerçekten kapatabileceği ve
yakında yere inecek toplara dalar (`diveDistance`). Bu koşullar olmadan
"yetişemiyorsam dalayım" demek, yetişilebilecek toplara dalıp yerde kilitli
kalmak oluyordu — dalış kazandırmaktan çok kaybettiriyordu.

**Zorluk kolu `error` değeridir.** Yapay zekânın tahmini düşüş noktasına
eklediği sapma. Temas dairesi ~53px olduğu için bunun altındaki sapmalar ıskaya
dönüşmez ve rakip hiç sayı vermez — kademeleri ayarlarken bunu göz önünde tut.

**Forma numaraları kendi bitmap fontuyla çizilir.** Önce "Press Start 2P" ile
yazılıyordu; font geç yüklendiğinde ölçüm kayıyor ve numara bulanıklaşıyordu.
`sprites.js` içindeki 3×5 piksel rakam tablosu font yüklemesinden bağımsızdır.

**Türkçe büyük harf.** `String.toUpperCase()` İngilizce eşlemesi yapar ve
"Gizem" → "GIZEM" verir. Arayüz tamamen Türkçe olduğu için her yerde
`src/utils/text.js` içindeki `upper()` kullanılır (`GİZEM`).

**Geliştirme kolaylığı:** dev modda motor `window.__game` üzerinden erişilebilir
(production build'de yoktur).

## Denge Ölçümü

Zorluk kademeleri, motoru headless sürerek ölçüldü — her hücre 7 maç, ortalama
seviyede bir oyuncuyu temsil eden bir bot ile:

| Mod | Kolay | Normal | Zor |
| --- | --- | --- | --- |
| 1v1 | %100 kazanma (32-19) | %57 (31-34) | %0 (23-34) |
| 2v2 | %100 (30-15) | %14 (33-38) | %0 (24-35) |

Yeniden dengeleme yaparsan aynı ölçümü tekrarlamak mantıklı: tek maç örneklemi
çok gürültülü, en az 5–7 maç ortalaması gerekiyor.

## Lisans

MIT — bkz. `LICENSE`.
