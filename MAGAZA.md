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

TVF'den cevap gelmeden **yayınlama.** Aşağıdaki hazırlıkların hepsi bu
cevaptan bağımsız yapılabilir; yalnız "yayınla" düğmesine basmak
bekliyor.

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

---

## 🔧 Sende olanlar

### 1. Geliştirme ortamı

Android için:

| Gereken | Neden |
|---|---|
| **JDK 17** | Gradle bunu istiyor |
| **Android Studio** | SDK, emülatör ve imzalama arayüzü |

iOS için **Mac ve Xcode şart.** Apple başka yol bırakmıyor. Elinde Mac
yoksa seçenekler: bir Mac ödünç almak, bulut Mac kiralamak (MacStadium,
MacinCloud — aylık ücretli), ya da **önce yalnız Android'e çıkmak.**
Android'den başlamak makul: hem ücret bir kereye mahsus hem de inceleme
süreci daha hızlı.

### 2. Android yapısı

```bash
npm ci
VITE_RELE_URL=wss://rele-178-104-2-249.sslip.io npm run paket
npx cap open android
```

Son komut Android Studio'yu açıyor. Oradan:
- **Deneme:** Run → bağlı cihaz/emülatör.
- **Yayın:** Build → Generate Signed Bundle / APK → **Android App Bundle (.aab)**.
  Play Store artık APK değil AAB istiyor.

`VITE_RELE_URL` **şart** ve `npm run paket` bunu artık denetliyor:
adres verilmezse, yerel (`localhost`) bir adres verilirse ya da
şifresiz (`ws://`) verilirse yapı **durur** ve sebebini söyler.

Denetim eklenmeden önce bu gerçekten yaşandı: paket testinin bıraktığı
`ws://localhost:8805` hem `dist/` hem Android kopyasında duruyordu.
Öyle paketlenseydi uygulama telefonda kendi kendine bağlanmaya
çalışırdı ve oyuncu "çevrimiçi çalışmıyor" derdi — hiçbir hata mesajı
olmadan.

### 3. İmza anahtarı

İlk yayında Android Studio bir anahtar (`.jks`) üretmeni isteyecek.

**Bu dosyayı kaybetme.** Kaybedersen uygulamayı bir daha
güncelleyemezsin — Google yeni anahtarla yüklemeyi kabul etmiyor,
uygulamayı sıfırdan yayınlamak zorunda kalırsın ve mevcut kullanıcılar
güncelleme alamaz. Depoya da koyma (`.gitignore`'da zaten dışlı):
anahtara erişen herkes senin adına güncelleme imzalayabilir.

Sakla: parola yöneticisi, şifreli yedek, ya da fiziksel bir kopya.

### 4. Mağaza hesapları

| Mağaza | Ücret |
|---|---|
| Google Play Console | 25 USD (bir kereye mahsus) |
| Apple Developer | 99 USD / yıl |

### 5. Gizlilik politikası — **zorunlu**

İki mağaza da istiyor ve bizim durumumuzda gerçekten gerekli, çünkü
veri topluyoruz. Politikada dürüstçe yazılması gerekenler:

| Ne topluyoruz | Nerede duruyor | Neden |
|---|---|---|
| Takma ad (oyuncunun yazdığı) | Sunucuda + cihazda | Rakibin ekranında görünsün |
| Rastgele kimlik numarası | Sunucuda + cihazda | Skor tablosu anahtarı |
| Maç sonuçları (galibiyet/mağlubiyet/puan) | Sunucuda | Skor tablosu |
| Oyun tercihleri, rekorlar | Yalnız cihazda | Ayarlar |

**Toplamadığımız** şeyler de yazılmalı, çünkü mağaza formunda tek tek
soruluyor: ad-soyad yok, e-posta yok, telefon yok, konum yok, reklam
kimliği yok, üçüncü taraf analitik yok, reklam yok.

IP adresi bağlantı sırasında zorunlu olarak görülüyor (her sunucuda
öyle) ve kalıcı olarak saklanmıyor — yalnız aynı IP'den açılan
bağlantı sayısı, kötüye kullanımı engellemek için bellekte tutuluyor.

Politikanın herkese açık bir adreste durması gerekiyor. Oyunun kendi
sitesinde bir sayfa yeterli.

### 6. Mağaza görselleri

| Ne | Boyut | Durum |
|---|---|---|
| Uygulama ikonu | 512×512 | ✅ `npm run ikon` üretiyor → `tests/ciktilar/play-store-ikon-512.png` |
| Öne çıkan görsel | 1024×500 | ❌ gerekli |
| Ekran görüntüsü (telefon) | en az 2 adet | ❌ gerekli |
| Ekran görüntüsü (tablet) | isteğe bağlı | — |

Ekran görüntülerini elle almana gerek yok: tarayıcı testleri zaten
`tests/ciktilar/` altına gerçek cihaz boyutlarında görüntü yazıyor.
İstersen bunları mağaza boyutlarında üretecek bir betik yazabilirim.

### 7. İçerik derecelendirmesi

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

1. **Telif cevabı** — her şeyin önünde. (TVF'den bekleniyor.)
2. Google Play Console hesabı (25 USD).
3. Gizlilik politikası sayfası.
4. Mağaza görselleri (öne çıkan görsel + ekran görüntüleri).
5. İlk imzalı `.aab` ve **kapalı test** kanalına yükleme — kendi
   telefonunda gerçek mağaza kurulumuyla denemek için.
6. iOS: Mac erişimi çözülünce.
