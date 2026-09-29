# Play Console doldurma föyü — Retro Voleybol

Play Console'un kendi sırasına göre, alan alan. Solda konsolda gördüğün
başlık, sağda yazacağın/işaretleyeceğin şey.

**Sende olan dosyalar:**

| Dosya | Nereden |
|---|---|
| `app-release.aab` | Actions → android aab koşumu → Artifacts → `retro-voleybol-aab` (zip içinden çıkar) |
| `play-store-ikon-512.png` | sohbette gönderildi |
| `one-cikan-1024x500.png` | sohbette gönderildi |
| `telefon-1-menu / 2-kadro / 3-mac .png` | sohbette gönderildi |
| `tablet-1-menu / 3-mac .png` | sohbette gönderildi |

Paket adı: **`app.retrovoleybol.oyun`** (`.aab`'den otomatik okunur,
elle girmen gerekmez). Sürüm: **0.1.8 (108)**.

> 0.1.0 (100) Play tarafından reddedildi: hedef API düzeyi 35'ti, artık
> en az 36 isteniyor. Düzeltildi. Bu dal **0.1.8**: Forma Puanı yalnız
> Play paketinde, web'de kadro açık; ödüllü reklam (AdMob) native'de.
> Aynı sürüm kodunu ikinci kez yüklemek reddedilir; 108 Play'de yoksa
> sorun yok.

---

## 1. Create app

| Alan | Değer |
|---|---|
| App name | `Retro Voleybol` |
| Default language | Türkçe (tr-TR) |
| App or game | **Game** |
| Free or paid | **Free** |
| Declarations | Developer Program Policies ✓ · US export laws ✓ |

> "Free" sonradan ücretliye çevrilemez. Bu oyun ücretsiz, sorun yok.

---

## 2. Dahili test (Internal testing) → Yeni sürüm oluştur

> **Dahili test mi kapalı test mi?** Dahili test daha hızlı: inceleme
> beklemiyor, en fazla 100 test kullanıcısı alıyor ve **asgari test
> kullanıcısı sayısı ya da asgari süre şartı yok**. Kendi telefonunda
> denemek için doğru kanal bu.
>
> 12 kullanıcı / 14 gün şartı **kapalı test** içindir ve yalnız
> **kişisel** geliştirici hesaplarını bağlar: üretime (Production)
> çıkmadan önce tamamlanması gerekir. Kurumsal hesaplar muaf. Kendi
> hesabına hangisinin uygulandığını Play Console → Pano → "Üretim
> erişimi" bölümü açıkça yazıyor.

1. **Test and release → Testing → Internal testing → Create new release**
2. Play App Signing çıkarsa → **Kabul et** (Continue).
3. `app-release.aab` dosyasını sürükle. Yükleme bitince **0.1.8 (108)**
   yazmalı.
4. **Release name:** `0.1.8 (108)` (kendiliğinden gelir, dokunma)
5. **Release notes** — `<tr-TR>` bloğunun içine:

   ```
   Forma Puanı ile kadro kilidi, hayatta kalmada reklam izle devam et,
   maç sonunda 2× FP. Web sitesinde kilit ve reklam yok.
   ```

6. **Testers** sekmesi → **Create email list** → listeye kendi Google
   hesabının e-postasını ekle → listeyi bu sürüme bağla.
7. Sayfanın altındaki **katılım bağlantısını (opt-in URL)** kopyala ve
   bir yere kaydet — telefonda bunu açacaksın.

---

## 3. Zorunlu formlar

Dashboard'da "Set up your app" altında listelenirler. Sırası önemsiz.

### App access
| Soru | Cevap |
|---|---|
| Is all functionality available without special access? | **All functionality is available without special access** |

Oyunun tamamı giriş yapmadan oynanıyor; çevrimiçi mod da hesap istemiyor
(takma ad sunucu tarafından veriliyor).

### Ads
| Soru | Cevap |
|---|---|
| Does your app contain ads? | **Yes** |

Ödüllü video (AdMob): hayatta kalmada "reklam izle, devam et" ve maç
sonunda 2× Forma Puanı. Web sitesinde reklam yok. İzlemeden oyun
oynanır; günde en fazla 8 ödüllü reklam.

Konsolda Ads=Yes deyince reklam kimliği (AD_ID) bildirimi de açılır.
`AndroidManifest.xml` içinde `com.google.android.gms.permission.AD_ID`
var.

### Content rating
E-posta adresini girip anketi doldur. Kategori: **Game**.

| Soru | Cevap |
|---|---|
| Şiddet (violence) | Hayır |
| Cinsellik | Hayır |
| Küfür / kaba dil | Hayır |
| Uyuşturucu, alkol, tütün | Hayır |
| Kumar / şans oyunu | Hayır |
| Korku öğeleri | Hayır |
| **Kullanıcılar arası etkileşim** | **EVET** |
| Kullanıcı konumu paylaşılıyor mu | Hayır |
| Dijital satın alma | Hayır |

> "Kullanıcılar arası etkileşim" EVET çünkü çevrimiçi maçta takma adın
> karşı tarafın ekranında görünüyor. İşaretlememek sonradan sorun çıkarır.

### Data safety
| Soru | Cevap |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (WSS/TLS) |
| Do you provide a way for users to request that their data is deleted? | **Yes** → e-posta adresini ver |

Toplanan veri türleri:

| Kategori | Tür | Toplanıyor | Paylaşılıyor | Zorunlu mu | Amaç |
|---|---|---|---|---|---|
| Personal info | **User IDs** (takma ad + kimlik no) | Evet | Hayır | Zorunlu | App functionality |
| App activity | **In-app actions** (maç sonuçları, puan) | Evet | Hayır | Zorunlu | App functionality |
| Device or other IDs | **Advertising ID** | Evet (AdMob) | Evet — Google | İsteğe bağlı | Advertising or marketing |

Reklam kimliği bizim sunucuya yazılmaz; Google AdMob ödüllü videoyu
ölçmek için kullanır. Kullanıcı reklam izlemeden de oynar.

Konum, kişiler, fotoğraf, dosya, sağlık, finans, mesaj,
kişiselleştirme, analitik — yok. Web sitesinde reklam SDK'sı yok.

### Privacy policy
```
https://retrovoleybol.online/gizlilik.html
```

### Target audience and content
| Alan | Değer |
|---|---|
| Target age groups | **13-15, 16-17, 18+** |
| Appeal to children | Hayır |

> 13 altını seçmemek bilinçli: çevrimiçi kullanıcı etkileşimi var ve
> 13 altı seçilirse Play'in çocuklara yönelik ek kuralları (Families
> Policy) devreye giriyor.

### Government apps / Financial features / Health
Hepsi **Hayır**.

---

## 4. Store listing

| Alan | Değer |
|---|---|
| App name | `Retro Voleybol` |
| Short description (80 sınır · 72 karakter) | `8 bit piksel voleybol. Tek kişilik, çevrimiçi, turnuva ve hayatta kalma.` |
| App icon | `play-store-ikon-512.png` |
| Feature graphic | `one-cikan-1024x500.png` |
| Phone screenshots | `telefon-1-menu`, `telefon-2-kadro`, `telefon-3-mac` |
| 7-inch tablet | `tablet-1-menu`, `tablet-3-mac` |
| 10-inch tablet | `tablet-1-menu`, `tablet-3-mac` |
| App category | Game → **Sports** |
| Tags | Voleybol, Arcade, Retro, Piksel, Spor |
| Contact email | kendi e-postan |
| Website (isteğe bağlı) | `https://retrovoleybol.online` |

**Full description** (4000 sınır · 742 karakter — olduğu gibi yapıştır):

> Metinde "sultanlar" kelimesi GEÇMEZ. Kurgusallaştırmada tam da o ad
> kaldırılmıştı; mağaza metninde durması, koddan temizlenen çağrışımı
> geri getirirdi.

```
Kırmızı-beyaz bir saha, bayraklarla dolu bir tribün ve gerçek voleybol
kuralları üzerine kurulu 8 bit bir arcade.

· SINGLEPLAYER — rakibi, formatı ve zorluğu sen seç
· TURNUVA — 5 tur, tek yenilgi eler, finali geçen kupayı kaldırır
· ONLINE — tek dokunuşta gerçek rakip, rövanş desteğiyle
· ARKADAŞLA OYNA — oda koduyla tanıdığın biriyle
· CO-OP ve KARŞILIKLI — aynı klavyede iki kişi
· HAYATTA KALMA — dalgalar sertleşir, canın biterse biter

Üç temas kuralı, servis gücü ve nişanı, dalış, plase, blok ve tam
zamanında vuruş komboları: voleybolun ritmi olduğu gibi duruyor.

Oyundaki her şey — oyuncular, top, file, tribün — kodla çizilmiş piksel
sanatı. Kadro kurgusaldır; gerçek bir kişiyi ya da takımı temsil etmez.

Yatay tutuş gerekir.
```

---

## 5. Gönder

Dahili test sürümüne dön → **Kaydet** → **Sürümü incele** →
**Dahili teste sunmaya başla**.

Dahili testte inceleme beklenmiyor; kurulabilir hale gelmesi genelde
birkaç dakika (bazen bir saate kadar) sürüyor.

Kanal özetinde **"Etkin değil"** yazıyorsa sürüm henüz yayına
alınmamıştır — yukarıdaki adım tamamlanmamış demektir.

Uygulama adı orada `app.retrovoleybol.oyun (unreviewed)` görünüyorsa
sebebi mağaza listesinin (bölüm 4) henüz doldurulmamış olması; listeyi
tamamlayınca **Retro Voleybol** olur.

---

## 6. Onaylanınca

1. Telefonda **katılım bağlantısını** aç, testi kabul et. Tarayıcıda
   **listedeki e-postayla giriş yapmış olman** şart, yoksa bağlantı
   "test kullanıcısı değilsin" der.
2. Play Store'dan kur (bağlantının altındaki "Download it on Google Play").
3. **Çevrimiçi modu dene** — röle 60 Hz'de çalışıyor, akıcılık farkı
   orada görünür.
4. Sorun yoksa **bölüm 7** ile Production kanalına **aynı 0.1.8 `.aab`**
   ile çıkılır.

---

## 7. Üretim (Production)

1. Actions → **android aab** → **Run workflow** → Use workflow from:
   **`cursor/fp-reklam-89c3`** (veya bu dal `main`'e girdiyse `main`).
   Bittiğinde Artifacts'tan `app-release.aab` **ve** `mapping.txt` indir.
2. Play Console → Test and release → **Production** → Create new release.
3. AAB'yi sürükle. **0.1.8 (108)** yazmalı. 107 veya daha düşük görürsen
   yanlış daldan paket üretilmiş demektir; yükleme.
4. `mapping.txt` → App integrity / deobfuscation file. R8 açık; bu
   dosya olmadan kilitlenme izleri okunmaz.
5. Mağaza listesi (bölüm 4) güncel mod adlarıyla: **ONLINE**,
   **SINGLEPLAYER**. Eski ekran görüntülerinde HIZLI MAÇ varsa
   `npm run magaza-gorsel` ile yenile.
6. Gizlilik: `https://retrovoleybol.online/gizlilik.html` (308 →
   `https://www.retrovoleybol.online/gizlilik.html`, ikisi de açılıyor).
7. **Kişisel hesap:** kapalı testte 12 kullanıcı / 14 gün dolmadan
   üretim başvurusu reddedilir. Pano → "Üretim erişimi".
8. Telefonda test kurulumundan **ONLINE** maçı aç — röle ayakta,
   `paketSurum` 2, istemciyle uyumlu.

---

## Sonraki sürümler

`package.json` içindeki `version` artırılır (`0.1.8` → `0.1.9`),
`main`'e girer, Actions → android aab → Run workflow. `versionCode`
sürümden türetiliyor (`0.1.9` → `109`), elle artırmak gerekmiyor.
