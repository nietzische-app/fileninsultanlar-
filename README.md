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

**Oyun modları:** Hızlı Maç / Turnuva / Co-Op / Karşılıklı / Hayatta Kalma
**Diziliş:** 1v1 ve 2v2 · **Format:** Klasik / Tek Set / Antrenman · **Zorluk:** Kolay / Normal / Zor

Beş kurgusal rakip takım seçilebilir (veya rastgele): Atlas Fırtınası, Adriyatik,
Nordik Buz, Balkan Ateşi, Pasifik Dalga.

| Tuş | Aksiyon |
| --- | --- |
| `←` `→` veya `A` `D` | Hareket |
| `↑` veya `W` | Zıpla |
| `↓` veya `S` | **Dalış** — yere düşmek üzere olan topa uzan (havadayken **plase**) |
| `Boşluk` veya `Z` | Vur (manşet / smaç / blok) · **servis**: 1. basış güç, 2. basış nişan |
| `X` | **Sultan Gücü** — alevli smaç |
| `ESC` veya `P` | Duraklat |

### Mobil

Maç ekranı mobilde viewport'un tamamını kaplar: saha oranını koruyarak
ortalanır, dokunmatik tuşlar da **sahanın köşelerine şeffaf olarak biner**.
Skor tablosu ve Sultan barı üstte saydam bir katmanda durur; duraklat /
tam ekran / çık düğmeleri sağ üst köşededir.

- **Yatay tutuş zorunludur.** Saha 9:5 oranında ve dikeyde ekranın ancak
  üçte birine sığıyor. Dokunmatik cihazda dikey tutuşta tam ekran bir
  "cihazı yatay çevir" kapısı çıkar, altındaki her şey erişilemez olur ve
  maç ekranı motoru duraklatır. Yatay dönünce oyun kendiliğinden devam
  etmez — duraklatma katmanı bekler, oyuncu hazır olduğunda başlatır.
  Kapı yalnızca `pointer: coarse` cihazlarda açılır; masaüstünde
  pencereyi dar ve uzun yapan kimse engellenmez.
- Ana ekrana eklenen PWA kısayolu manifest üzerinden doğrudan **yatay**
  açılır (`orientation: landscape`).
- **Tam ekran** düğmesi Fullscreen API'yi kullanır ve destekleniyorsa
  yönü yataya kilitler. iOS Safari `Element.requestFullscreen`'i
  desteklemediği için düğme orada hiç gösterilmez — o cihazlarda ana
  ekrana eklenen PWA kısayolu aynı işi görür.
- Tuşlar `pointer capture` ile çoklu dokunuşu destekler (ör. sağa git +
  zıpla aynı anda).

### Servis

Her ralli servisle başlar. Servis atan dip çizgiye geçer, top elinde
bekler ve yanında iki aşamalı bir gösterge salınır:

1. **Güç** — birinci basış gücü kilitler. Beyaz çizgi en verimli noktadır;
   yüksek güç topu düz ve hızlı, düşük güç yüksek kavisli gönderir.
2. **Nişan** — ikinci basış derinliği kilitler ve servisi atar. Sol uç
   file dibi, sağ uç dip çizgi.

Dört saniye içinde iki aşamayı tamamlamazsan servis olduğu güçle
kendiliğinden atılır — oyun asla beklemede kalmaz.

Servis hızı bilerek ölçülü tutuldu: amaç ralliyi başlatmak, ralliyi tek
başına kazanmak değil.

### Oyunun ritmi

Gerçek voleybol gibi çalışır ve oyunun bel kemiği budur:

1. **Sert gelen topa ilk temasta smaç vuramazsın.** Önce manşetle karşılarsın
   (vuruş tuşuna basmadan). Top kendi sahanda havalanır.
2. **İkinci temas pastır.** Vuruş tuşuyla topu file önüne kaldırırsın.
3. **Üçüncü temas hücumdur.** Zıpla + vuruş tuşu = smaç.

Bir taraf topu karşıya göndermeden **en fazla 3 kez** dokunabilir; dördüncüsü
faul, rakibe sayı. Duvar skorbordlarının altındaki üç nokta kaç hakkın
kaldığını gösterir.

### Tam Vuruş ve Kombo

Vuruş tuşuna **topa değmeden hemen önce** basarsan (0.17 sn'lik pencere)
temas **tam vuruş** olur: %14 daha sert vuruş, fazladan bar dolumu ve
kombo +1. Tuşu basılı tutan oyuncu bu pencereyi asla yakalayamaz — eklenen
asıl şey bu, çünkü önceden "tuşa bas ve bırakma" her zaman en iyi
stratejiydi ve ustalaşacak bir zamanlama yoktu.

Komboyu büyüten üç hamle var: tam vuruş, blok ve dalış kurtarışı. Kombo
**her sayıda sıfırlanır** (kazansan da kaybetsen de), yani "bu rallide kaç
iyi temas zincirledim" sorusunun cevabıdır. Kademeler: 3 SÜPER · 6
MÜKEMMEL · 10 SULTAN SERİSİ · 15 DURDURULAMAZ.

Kombo asıl olarak **Sultan barını** hızlandırır; hücum gücüne katkısı
bilerek çok daha zayıf tutuldu (en fazla %16). İkisi aynı hızda büyüseydi
kombo yapan oyuncu geri dönülemez biçimde öne geçerdi.

### Plase

Havadayken `↓` (mobilde **DAL**) ile smaç yerine plase yaparsın: top
filenin hemen ötesine yumuşak düşer. Blok zıpladıysa bedava sayı;
savunma file dibinde bekliyorsa kolay lokma olursun — yani risk/ödül
seçimi. Rakip yapay zekâsı da plase yapar: savunman fileden uzaktaysa
file dibinin boş olduğunu görür.

### Dalış kurtarışı

Koşarak yetişemeyeceğin topa `↓` ile dalarsın: oyuncu yatay olarak fırlar ve
yerde kayar; bu sırada temas alanı alçalıp genişler, yani yere değmek üzere
olan topu yakalar. Kurtarılan top yükseğe ve yakına kalkar, toparlanıp
hücuma geçecek zamanın olur.

Bedeli var: kaymadan sonra oyuncu kısa süre yerde kalır ve yönlendirilemez.
Iskalanan dalış yarım saniyeyi kaybettirir, o yüzden son çare olarak
kullanılmalı — koşarak yetişebiliyorsan koş. Rakip yapay zekâsı da dalar.

### Ses

Her şey osilatör ve filtrelenmiş gürültüyle anlık üretilir; tek bir ses
dosyası yok. Motor katmanlı: master altında ayrı **efekt** ve **tribün**
bus'ları var, böylece kalabalık efektleri bastırmıyor.

Maç boyunca hafif bir **tribün yatağı** çalar ve ralli/coşkuyla şişer —
salonun dolu olduğunu tek bir efekt çalmadan hissettirir. Duraklatınca ve
maçtan çıkınca susar. Aynı sesin mekanik tekrarını kırmak için vuruşlara
küçük bir pitch sapması uygulanır.

### Sultan Gücü

Sayı aldıkça, blok yaptıkça ve fileyi geçen her vuruşta bar dolar. Dolduğunda
`X` ile ateşlersin: bir sonraki vuruşun **alevli** ve %55 daha hızlı olur, rakip
yapay zekâsının tepkisi yavaşlar. Ebrar Karakurt'un barı %30 daha hızlı dolar.

### Maç formatı

| Format | Kural |
| --- | --- |
| **Klasik** | 15 sayı, 3 sette 2 |
| **Tek Set** | Tek set 15 sayı (2 fark) |
| **Antrenman** | Tek set 7 sayı — kısa tempo |

Bir klasik maç ortalama 4–9 dakika sürer.

### İki kişilik oyun — Co-Op ve Karşılıklı

Tek klavyede iki kişi oynanır:

| | 1. Oyuncu | 2. Oyuncu |
| --- | --- | --- |
| Hareket | `W` `A` `S` `D` | ok tuşları |
| Vur | `Boşluk` / `Z` | `Enter` |
| Sultan Gücü | `X` | — |

- **Co-Op** — iki sultan aynı takımda, karşılarında yapay zekâ. 2v2
  zorunludur (iki insan aynı sahada olmalı).
- **Karşılıklı (VS)** — 1. oyuncu Türkiye'yi, 2. oyuncu rakip takımı
  sürer. **Sultan Gücü yalnızca Türkiye'nindir**; iki oyuncu aynı barı
  paylaşsaydı kimin doldurduğu belirsiz olurdu.

Tek kişilik oyunda hem `WASD` hem ok tuşları aynı oyuncuyu sürer —
hangisine alışkınsan. İki kişilik modlarda dokunmatik tuşlar gizlenir:
tek telefonda iki kişi oynayamaz, göstermek yanıltıcı olurdu.

### Turnuva — Kupa Yolu

Beş tur, beş rakip, tek eleme. Her turu kazanan bir üste çıkar; tek yenilgi
turnuvayı bitirir. Turlar hem uzunluk hem rakip gücü olarak kademeli sertleşir
ve final tek maç değildir:

| Tur | Rakip | Format | Rakip rampası |
| --- | --- | --- | --- |
| 1. Tur | Adriyatik | Tek set 11 sayı | — |
| 2. Tur | Atlas Fırtınası | Tek set 11 sayı | +0.4 |
| Çeyrek Final | Pasifik Dalga | Tek set 15 sayı | +0.8 |
| Yarı Final | Balkan Ateşi | Tek set 15 sayı | +1.2 |
| **Final** | Nordik Buz | 15 sayı, 3 sette 2 | +1.6 |

Turlar arasında bracket ekranına dönülür: geçilen turlar, skorlar ve sıradaki
rakibin künyesi orada. Yarım kalan turnuva tarayıcıda saklanır — sekmeyi
kapatsan bile ana menüdeki **TURNUVAYA DEVAM ET** ile kaldığın turdan devam
edersin. Maçtan çıkmak turnuvadan çekilmek anlamına gelir.

Rampa yalnızca **rakibe** uygulanır; 2v2'deki AI takım arkadaşın seçtiğin
zorlukta kalır.

### Hayatta Kalma

Set yok, maç yok — tek uzun sayı zinciri. Kazandığın her sayı **puan**,
kaybettiğin her sayı bir **can**. 5 canın var; bittiğinde koşu kapanır.

Her 3 puanda bir **dalga** yükselir: rakip takım değişir ve bir tık sertleşir.
Eğri seçtiğin zorluğun altından başlar, ~7. puanda seçtiğin kademeye ulaşır
ve oradan yukarı tırmanır; 14. dalgada durur (aksi hâlde mod bir beceri sınavı
olmaktan çıkıp zaman aşımına dönüşüyor).

Koşu sonunda puanına göre bir rütbe alırsın: Çaylak → Genç Takım →
Profesyonel → Millî Oyuncu → Sultan → Efsane.

### Yerel rekorlar ve rehber

Maç sonuçları tarayıcıda saklanır (galibiyet, seri, en uzun ralli, smaç/blok/
kurtarış zirveleri, kazanılan kupa, en ileri turnuva turu, en yüksek hayatta
kalma puanı ve dalgası, en iyi kombo, toplam tam vuruş). Ana menüdeki
**Gurur Tablosu** bu rekorları gösterir; maç sonunda kırılan rekorlar
yıldızla işaretlenir.

**Rozetler:** 12 uzun vadeli hedef (ilk zafer, duvar, kupa, ritim, kurnaz
plase, zamanlama ustası...). Ana menüde ızgara olarak durur — kilitli
olanların adı ve koşulu gizlenmez, hedefi göstermek rozetin işi. Maç
sonunda yeni açılanlar ayrıca duyurulur.

Hayatta kalma koşusu galibiyet/mağlubiyet tablosuna işlemez — koşu her zaman
yenilgiyle biter, onu kayıp saymak galibiyet serisini anlamsızca sıfırlardı.
Ralli/smaç gibi kişisel zirveler orada da geçerlidir.

İlk açılışta (veya menüden **NASIL OYNANIR**) 4 adımlık Sultan Rehberi çıkar:
manşet→pas→smaç, dalış, Sultan Gücü, kontroller.

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
npm test         # Vitest — kurallar, balistik, storage, kadro
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) her push/PR'da `lint` + `test` + `build` çalıştırır.

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
| Ses | Web Audio API — katmanlı motor (master → sfx/tribün bus), dosya yok |
| Font | Arayüzde Press Start 2P; forma numaraları kendi piksel fontumuz |

## Dosya Yapısı

```
src/
├── main.jsx                  React mount
├── App.jsx                   Ekran akışı: start → select → (bracket) → match → result
├── index.css                 Tailwind katmanları, retro bileşenler, animasyonlar
├── screens/
│   ├── StartScreen.jsx       Giriş, mod seçimi, Gurur Tablosu (rekorlar)
│   ├── TutorialScreen.jsx    Nasıl oynanır rehberi
│   ├── CharacterSelect.jsx   Diziliş, zorluk ve kadro seçimi
│   ├── TournamentScreen.jsx  Kupa yolu bracket'i — turlar arası ekran
│   ├── MatchScreen.jsx       Canvas + skor tablosu + Sultan barı + dokunmatik
│   └── ResultScreen.jsx      Kupa, konfeti, istatistikler, yeni rekorlar
├── components/
│   ├── PixelAvatar.jsx       Sahadakiyle aynı sprite'ı çizen avatar
│   ├── Scoreboard.jsx        Türkiye vs Rakip, set takibi
│   ├── SultanBar.jsx         Özel yetenek barı
│   ├── StatBar.jsx           Piksel stat çubuğu
│   ├── MuteButton.jsx        Ses aç/kapa (tüm ekranlar)
│   ├── RotateGate.jsx        Dikey tutuşta oyunu kapatan yatay uyarısı
│   ├── AchievementGrid.jsx   Rozet ızgarası (açık/kilitli)
│   ├── TouchControls.jsx     Mobil kontroller (sahaya binen şeffaf varyant)
│   └── ErrorBoundary.jsx     Yakalanmamış hata ekranı
├── game/
│   ├── constants.js          Ölçüler, fizik, kurallar, palet, zorluk kademeleri
│   ├── Game.js               Motor: döngü, fizik, çarpışma, skor, çizim
│   ├── rules.js              Saf set/maç/üç-temas kuralları
│   ├── combo.js              Kombo kademeleri, çarpanlar, tam vuruş penceresi
│   ├── serve.js              Servis metresi, güç/nişan ve balistiği
│   ├── achievements.js       Rozet tanımları ve değerlendirme
│   ├── modes.js              Oyun modu tanımları (hızlı maç / turnuva / hayatta kalma)
│   ├── tournament.js         Kupa yolu turları ve saf durum makinesi
│   ├── survival.js           Dalga hesabı, zorluk rampası, rütbeler
│   ├── ballistics.js         Saf smaç/pas balistiği
│   ├── effects.js            Parçacık, darbe halkası, top izi
│   ├── math.js               clamp yardımcısı
│   ├── opponents.js          Rakip takımlar ve away kadrosu
│   ├── players.js            Kadro verisi, statlar, bonuslar, görünüm
│   ├── ai.js                 Rakip ve takım arkadaşı yapay zekâsı
│   ├── sprites.js            Piksel çizimleri (sultan, top, bayrak, kupa, rakamlar)
│   ├── arena.js              Salon, tribün, zemin ve file çizimi
│   └── audio.js              8-bit ses motoru
├── hooks/
│   ├── useFullscreen.js      Tam ekran durumu + geçiş
│   └── useViewport.js        Ölçü, yön ve dokunmatik cihaz tespiti
└── utils/
    ├── text.js               Türkçe büyük harf yardımcısı
    ├── fullscreen.js         Fullscreen API sarmalayıcı (webkit/iOS farkları)
    └── storage.js            Mute / seçim / rekorlar / turnuva kaydı localStorage
```

Saf motor mantığı (`rules.js`, `ballistics.js`, `effects.js`, `tournament.js`,
`survival.js`, `combo.js`) ve `storage.js` Vitest ile test edilir
(`*.test.js`). `Game.js` bu modülleri çağırır; canvas/React sarmalayıcı
kalır.

Üretim build'inde hafif bir service worker (`public/sw.js`) çevrimdışı
kabuk sağlar. **HTML asla cache-first servis edilmez:** Vite içerik-hash'li
paket ürettiği için eski HTML eski hash'i ister ve yeni bir dağıtımdan
sonra o dosya sunucuda kalmaz — kullanıcı ya eski oyunu görür ya da
yarım yüklenmiş bir sürümü. Bölüşüm şöyle: gezinme/HTML → ağ önce,
`/assets/*` (hash'li, değişmez) → önbellek önce, diğerleri →
önbelleği ver arkada tazele. Yeni worker `skipWaiting` ile hemen
devralır ve sayfa bir kez tazelenir, yoksa güncelleme tüm sekmeler
kapanana kadar beklerdi. PWA ikonları çalışma anında canvas'tan üretilir
(`createAppIconDataUrl`) — repoda PNG yoktur.

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
    hairStyle: 'braided-bun',    // bkz. HAIR_STYLES
    headband: null,              // kafa bandı — null ise takmaz
    wristband: null,             // bileklik — null ise takmaz
    kneePads: '#1B1B2E',         // dizlik — null ise takmaz
    necklace: null,              // kolye rengi — null ise takmaz
    earring: null,               // küpe rengi — null ise takmaz
    tattoos: false,              // kol dövmeleri
  },
}
```

Liberolar (Gizem Örge, Eylül Akarçeşme Yatgın) kural gereği farklı renkte forma
giyer; bu `LIBERO_KIT` sabitiyle verilir.

Saç stilleri: `short`, `short-spiky`, `short-fade`, `ponytail`, `high-ponytail`,
`half-ponytail`, `bun`, `sleek-bun`, `high-bun`, `braided-bun`, `long`,
`curly-long`, `half-up`, `braid`.

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

| Diziliş | Kolay | Normal | Zor |
| --- | --- | --- | --- |
| 1v1 | %100 kazanma (32-19) | %57 (31-34) | %0 (23-34) |
| 2v2 | %100 (30-15) | %14 (33-38) | %0 (24-35) |

Hayatta kalma da aynı yöntemle ayarlandı (12 koşu ortalaması, ortalama beceride
bot — medyan puan):

| Zorluk | Zayıf oyuncu | Ortalama | Usta |
| --- | --- | --- | --- |
| Kolay | 2 puan | 9 puan (~3.8 dalga) | 10 puan |
| Normal | 2 puan | 5 puan (~2.3 dalga) | 10 puan (~3.9 dalga) |
| Zor | 1 puan | 2 puan | 3 puan |

İlk deneme (3 can, yumuşama yok) ortalama oyuncuyu **0–1 puanda** eliyordu:
rakip ilk ralliden itibaren tam güçte olduğu için koşu ~15 saniyede kapanıyor,
mod dalga bile göstermeye fırsat bulamıyordu. `SURVIVAL.startEase` ve can
sayısı bu ölçüm üzerine ayarlandı.

Yeniden dengeleme yaparsan aynı ölçümü tekrarlamak mantıklı: tek maç örneklemi
çok gürültülü, en az 5–7 maç (hayatta kalmada ~12 koşu) ortalaması gerekiyor.

## Lisans

MIT — bkz. `LICENSE`.
