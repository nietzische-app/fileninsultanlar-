# Mağaza yolu — Filenin Sultanları

Oyunu Google Play ve App Store'a taşımak için gereken her şey.
**Hangi adımların bittiğini, hangilerinin sende olduğunu ve neyin
şu an engellendiğini** ayrı ayrı yazıyor.

---

## ⛔ Önce: yayınlamayı engelleyen şey

**Telif.** Oyunda üç tane bize ait olmayan varlık var:

| Varlık | Ne | Boyut |
|---|---|---|
| Arka plan fotoğrafı | VNL basın görseli | 84 KB |
| Giriş müziği | Yayınlanmış bir şarkı | 722 KB |
| Arayüz ikonları | Prinbles GUI paketi | — |

Buna bir dördüncüsü eklendi: **uygulama ikonu** artık bir sultanın
piksel görselini taşıyor.

Ayrıca oyun gerçek sporcuların **adlarını ve benzerliklerini**
kullanıyor. İkisi de mağaza incelemesinde ve sonrasında sorun çıkarabilir
— Apple ve Google, telif sahibinin şikâyetiyle uygulamayı yayından
kaldırıyor ve hesaba yaptırım uygulayabiliyor.

TVF'den cevap gelmeden **herkese açık yayınlama.** Aşağıdaki
hazırlıkların hepsi bu cevaptan bağımsız yapılabilir — **kapalı test**
kanalına yükleme dahil, çünkü orada uygulama mağazada listelenmiyor,
yalnız senin davet ettiğin hesaplar kurabiliyor. Bekleyen tek şey
"üretime çıkar" düğmesi.

---

## ✅ Bitmiş olanlar

- **Capacitor kurulumu.** Web oyunu olduğu gibi yerel kabuğa giriyor;
  kod tek kaldı (site, Android ve iOS aynı kaynaktan).
- **Android projesi** (`android/`). Depoda, özelleştirmeleriyle:
  - Yatay kilit (`sensorLandscape`). Web'deki "telefonu çevir" kapısı
    yerel kabukta hiç çıkmıyor — çevrimiçi maçta çevirirken sayı
    kaybetme sorunu da böylece bitiyor.
  - İmza anahtarları `.gitignore`'da (Capacitor'ın şablonunda açıkta
    bırakılmıştı — anahtar depoya girerse ona erişen herkes senin
    adına güncelleme yayınlayabilir).
- **Donanım GERİ tuşu.** İşlenmeseydi varsayılan davranış uygulamayı
  kapatmaktı; maçın ortasında bu, çevrimiçide hükmen mağlubiyet demek.
  Şimdi maçta yutuluyor, öteki ekranlarda menüye dönüyor.
- **Uygulama ikonu** oyunun kendi çizim koduyla üretiliyor
  (`npm run ikon`). Harici bir görsel dosyası yok; sprite değişirse
  ikon da tazeleniyor.
- **Paket testi** (`npm run e2e paket`). Yapılmış `dist/`i düz bir dosya
  sunucusundan servis edip gerçek tarayıcıda açıyor — Capacitor'ın
  yaptığının aynısı. Yakaladığı şeyler:
  - Varlık yolları (mutlak olsalardı WebView'de 404 verir, ekran
    bomboş açılırdı).
  - Röle adresinin **gömülü** olduğu. Gömülü değilse ÇEVRİMİÇİ düğmesi
    hiç çıkmaz ve bunu ancak mağazaya yükledikten sonra fark ederdik.
  - `?rele=` ezmesinin üretimde çalışmadığı.
- **Paketleme ön denetimi.** `npm run paket`, röle adresi eksik, yerel
  ya da şifresizse yapıyı durduruyor.
- **Sürüm numarası tek kaynaktan.** `android/app/build.gradle` sürümü
  `package.json`'dan okuyor (1.2.3 → `versionCode 10203`). Şablondaki
  sabit `versionCode 1` ikinci yüklemede reddedilirdi ve bunu ancak
  dosyayı Play Console'a yükledikten sonra görürdük.
- **Yayın imzası yapılandırması.** `android/keystore.properties` varsa
  `bundleRelease` imzalı üretiyor, yoksa imzasız. Anahtar ve parolalar
  `.gitignore`'da.
- **`targetSdk 35`.** Şablon 34 ile geliyordu; Play Store 2025'ten beri
  34'ü reddediyor.
- **Gizlilik politikası** — `public/gizlilik.html`, ayarlar ekranından
  bağlantılı. Aşağıda ayrıntısı var.
- **Mağaza ekran görüntüsü betiği** — `npm run magaza-gorsel`.
- **`.aab` üreten CI işi** — `.github/workflows/aab.yml`. Aşağıda.

---

## 🔧 Sende olanlar

### 1. `.aab` üretimi — Android Studio kurmadan

**Önce dürüst olan kısım:** bu paketi ben bu ortamda üretemedim.
Kaptaki ağ vekili `dl.google.com`'a 403 dönüyor, yani Android SDK
indirilemiyor. JDK ve Gradle var, Gradle dosyalarının sözdizimini
doğruladım (üçü de temiz), ama `bundleRelease` SDK olmadan çalışmıyor.

Bunun yerine işi **GitHub Actions**'a taşıdım: GitHub'ın ubuntu
koşucularında Android SDK **kurulu geliyor**. Sonuç olarak senin
makinene Android Studio kurman `.aab` almak için **gerekmiyor**.
(Emülatörde denemek istersen yine kurabilirsin, ama yayın dosyası için
şart değil.)

#### Bir kerelik kurulum

**1) Anahtarı üret — tek komut:**

```bash
bash scripts/imza-uret.sh
```

Betik ne yapıyor: `keytool`u doğru argümanlarla çağırıyor, hangi
sorunun ne olduğunu önceden yazıyor, parolada ters bölü olmaması
gerektiğini hatırlatıyor, base64'ü üretiyor ve **geri çözüp bayt bayta
karşılaştırarak** doğruluyor. Sonunda GitHub'a girilecek beş değeri
adıyla listeliyor.

Makinende `keytool` yoksa (JDK kurulu değilse) betik Docker'la geçici
bir JDK kabı kullanıyor — kalıcı bir kurulum gerekmiyor.

Çıktı `~/filenin-imza/` altına yazılıyor; **bilerek depo dizinine
değil**, yanlışlıkla commit edilmesin diye.

`keytool` sırayla soracak: parola (iki kez) → ad → kurum/şehir/ülke
(hepsi Enter'la geçilebilir) → `yes` → anahtar parolası (Enter = aynısı).

**Anahtar dosyasını kaybetme.** Kaybedersen uygulamayı bir daha
güncelleyemezsin — Google yeni anahtarla yüklemeyi kabul etmiyor,
uygulamayı sıfırdan yayınlamak zorunda kalırsın ve mevcut kullanıcılar
güncelleme alamaz. Depoya da koyma (`.gitignore`'da dışlı; Capacitor'ın
şablonunda bu satırlar yorumdaydı, açtım): anahtara erişen herkes senin
adına güncelleme imzalayabilir.

Sakla: parola yöneticisi + şifreli ayrı bir yedek.

**2) GitHub → Settings → Secrets and variables → Actions:**

| Tür | Ad | Değer |
|---|---|---|
| Secret | `KEYSTORE_BASE64` | `~/filenin-imza/sultanlar.b64` dosyasının içeriği |
| Secret | `KEYSTORE_PASSWORD` | belirlediğin parola |
| Secret | `KEY_ALIAS` | `sultanlar` |
| Secret | `KEY_PASSWORD` | aynı parola (Enter'la aynısını seçtiysen) |
| Variable | `VITE_RELE_URL` | `wss://rele-178-104-2-249.sslip.io` |

Secret'lar **Secrets** sekmesinde ("New repository secret"),
`VITE_RELE_URL` ise **Variables** sekmesinde ("New repository
variable") — ikisi ayrı sekme, karıştırılması kolay.

Uzun metni panoya almak: `xclip -sel clip < ~/filenin-imza/sultanlar.b64`
(Linux) ya da `pbcopy < ~/filenin-imza/sultanlar.b64` (macOS).
Yapıştırdıktan sonra `.b64` dosyasını sil — anahtarın kendisini **değil**.

Röle adresi neden secret **değil**: zaten istemci paketinin içinde,
herkes görebiliyor. Secret'a koymak gizlilik değil, yanlış bir güven
duygusu verirdi.

#### Kullanım

GitHub → **Actions** → **android aab** → **Run workflow**.

Bittiğinde koşumun altındaki **Artifacts** bölümünden `.aab` iniyor;
doğrudan Play Console'a yükleniyor.

İş yalnız elle tetikleniyor. Her push'ta paket üretmek gereksiz olurdu:
sürüm numarası değişmediği sürece aynı dosya üst üste yığılırdı.

İçindeki iki denetim, mağazaya yükledikten sonra öğrenilecek iki şeyi
önden yakalıyor:
- `npm run paket` ön denetimi — röle adresi eksik/yerel/şifresizse durur.
- İmza denetimi — Gradle imzasız paketi de sessizce üretiyor; iş
  bitmeden `unzip -l` ile imza var mı diye bakıyoruz.

#### Yerelde yapmak istersen

Android Studio (ya da yalnız `cmdline-tools` + JDK 17) kuruluysa:

```bash
npm ci
VITE_RELE_URL=wss://rele-178-104-2-249.sslip.io npm run paket
cp android/keystore.properties.ornek android/keystore.properties  # doldur
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

`npx cap open android` ile Android Studio'da açıp emülatörde de
deneyebilirsin.

`VITE_RELE_URL` **şart** ve `npm run paket` bunu denetliyor. Denetim
eklenmeden önce bu gerçekten yaşandı: paket testinin bıraktığı
`ws://localhost:8805` hem `dist/` hem Android kopyasında duruyordu.
Öyle paketlenseydi uygulama telefonda kendi kendine bağlanmaya
çalışırdı ve oyuncu "çevrimiçi çalışmıyor" derdi — hiçbir hata mesajı
olmadan.

### 2. Mağaza hesapları

| Mağaza | Ücret | Durum |
|---|---|---|
| Google Play Console | 25 USD (bir kereye mahsus) | ✅ sende var |
| Apple Developer | 99 USD / yıl | — (iOS sonraya) |

iOS için **Mac ve Xcode şart.** Apple başka yol bırakmıyor — GitHub
Actions'ın macOS koşucuları teoride çözer ama sertifika/provisioning
kurulumu Android'dekinden çok daha uzun bir iş. Önce Android'e çıkmak
makul: ücret bir kereye mahsus ve inceleme daha hızlı.

### 3. Gizlilik politikası — ✅ hazır

`public/gizlilik.html` → yayında `https://<site>/gizlilik.html`.
Ayarlar ekranına da bağlantı kondu.

Oyunun React paketinden bağımsız, tek başına duran statik bir sayfa:
mağaza incelemecisi doğrudan tıklıyor ve oyunda bir hata olsa bile
politikanın erişilebilir kalması gerekiyor.

İçerik **koddan doğrulanarak** yazıldı, tahminle değil:

| Ne | Nerede | Kod |
|---|---|---|
| Tercihler, rekorlar, turnuva, rozetler | Yalnız cihazda | 4 `localStorage` anahtarı |
| Takma ad, kimlik no, anahtar özeti, maç sonuçları | Sunucuda | `sunucu/depo.js` |
| IP adresi | Yalnız bellekte, bağlantı kapanınca siliniyor | `sunucu/rele.js` |

Üçüncü taraf analitik/reklam/takip **yok** — kodda `fetch` yalnız bir
yerde geçiyor (`src/game/audio.js`, kendi paketimizdeki müzik dosyası).

Mağaza formunu doldururken **"Kullanıcılar arası etkileşim var"** ve
**"Kullanıcı adı toplanıyor"** kutularını işaretle; ikisi de doğru.

### 4. Mağaza görselleri

| Ne | Boyut | Durum |
|---|---|---|
| Uygulama ikonu | 512×512 | ✅ `npm run ikon` → `tests/ciktilar/play-store-ikon-512.png` |
| Ekran görüntüsü (telefon) | 2732×1536, en az 2 adet | ✅ `npm run magaza-gorsel` |
| Ekran görüntüsü (tablet) | 2560×1600 | ✅ aynı betik |
| Öne çıkan görsel | 1024×500 | 🔸 **sende** |

```bash
npm run dev            # bir uçbirimde açık kalsın
npm run magaza-gorsel  # başka uçbirimde
# → tests/ciktilar/magaza/
```

Menü, kadro seçimi, maç ve (röle adresi tanımlıysa) çevrimiçi ekranı
için ayrı ayrı kare üretiyor. Maç karesi **kuruluyor**, rastgele
yakalanmıyor: skor 22–20, top havada, bir oyuncu smaçta. Rastgele bir
an çoğu zaman topun aut olduğu, kimsenin bir şey yapmadığı sıkıcı bir
kare oluyor.

Boyutlar ölçülerek seçildi. İlk denemede 1920×1080 kullandım ve
görüntünün alt %22'si boş siyah bant çıktı — oyun kendini ~1148×638'de
sınırlıyor. Pencere/saha doldurma oranını ölçüp 1366×768'i seçtim (%71,
ölçülen en iyisi), `deviceScaleFactor: 2` ile çıktı 2732×1536.

### 5. İçerik derecelendirmesi

İki mağazada da bir anket dolduruluyor. Bu oyun için cevaplar sade:
şiddet yok, ürkütücü içerik yok, kumar yok, satın alma yok, reklam yok.
**Kullanıcılar arası etkileşim VAR** — takma ad karşı tarafın ekranında
görünüyor. Bunu belirtmemek sonradan sorun çıkarır.

---

## Karar: neden Capacitor

Üç yol vardı ve seçilen bu:

- **Capacitor** — web oyununu olduğu gibi yerel kabuğa koyuyor. Kod tek
  kalıyor. Canvas oyunu için performans yeterli: ölçüm zaten 60 FPS
  gösteriyor ve sunucu tarafı 256 eşzamanlı maçta tek çekirdeğin
  %17'sini kullanıyor.
- **PWA olarak bırakmak** — bedava ve hızlı ama App Store'da hiç
  görünmüyor. Hedef mağaza olduğu için geçici bir adım olurdu.
- **Yerel yeniden yazım** (Unity/Godot) — motoru, ağ katmanını ve beş
  adımlık çevrimiçi altyapıyı çöpe atmak demek. Bu oyun için gereği yok.

---

## Sırada ne var

1. ~~Google Play Console hesabı~~ ✅
2. ~~Gizlilik politikası~~ ✅ `public/gizlilik.html`
3. ~~Ekran görüntüsü üretimi~~ ✅ `npm run magaza-gorsel`
4. **İmza anahtarını üret ve GitHub secret'larını gir** (yukarıda,
   bölüm 1). Bundan sonrası tek tık.
5. **Öne çıkan görsel** (1024×500) — sende.
6. **İlk imzalı `.aab`** → Play Console **kapalı test** kanalı. Yayın
   değil: kendi telefonunda gerçek mağaza kurulumuyla denemek için.
   Kapalı test telif cevabından bağımsız yapılabilir — uygulama
   herkese açık listelenmiyor.
7. **Telif cevabı** — herkese açık yayının önünde duran tek şey.
   (TVF'den bekleniyor.)
8. iOS: Mac erişimi çözülünce.
