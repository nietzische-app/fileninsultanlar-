# Tarayıcı testleri ve ölçüm araçları

`npm test` (Vitest) saf mantığı sınar: balistik, kurallar, turnuva, tercih
katmanı. Buradaki testler ise **gerçek tarayıcıda, gerçek düzende ve
gerçek dokunuş olaylarıyla** çalışır — çünkü bu projede kırılan şeylerin
çoğu mantık değil, yerleşim ve girdi oldu.

```bash
npm run e2e                 # hepsi (kendi geliştirme sunucusunu açar)
npm run e2e serit dalis     # yalnızca adı geçenler
npm run olcum               # denge ölçümü (geçti/kaldı değil, sayı üretir)
```

Koşucu her seferinde **taze bir sunucu** başlatır. Bu önemli: bir kez
değişiklikten önce açılmış bir sunucuya karşı ölçüm yapıp yanlış sonuç
aldım — Tailwind yapılandırması güncellenmemişti ve test yeşil görünüyordu.

## Testler (`e2e/`)

| Test | Ne bekçiliyor |
|---|---|
| `serit` | Kontrol şeridi zemin çizgisine hizalı; hiçbir tuş sahanın canlı alanını örtmüyor (4 cihaz × 3 tuş ölçeği) |
| `hitbox` | Dokunma alanı görsel tuştan geniş, ama komşu tuşu çalmıyor |
| `dalis` | Yön tuşundan aşağı kaydırma gerçekten dalış tetikliyor; parmak yukarı dönünce vazgeçiyor |
| `aralik` | Tuş aralığı ayarı mesafeyi değiştiriyor, tuş boyutunu değiştirmiyor |
| `multitouch` | İki tuşa aynı anda basılabiliyor, tuşlar takılı kalmıyor, pinch sahayı yakınlaştırmıyor |
| `kanat` | Sahanın yanındaki bantlar salon katmanıyla dolu; masaüstünde katman gizli ve çizim yapmıyor |
| `online` | İki gerçek tarayıcı, gerçek röle: oda kur, katıl, aynı maçı gör, tuş geçir |
| `eslesme` | Birbirini tanımayan iki oyuncu: hızlı eşleşme sırası, takma adın karşıya ulaşması, rakip yokken yapay zekâ teklifi |
| `tablo` | Skor tablosu: sunucunun verdiği kimlik, maç sonucunun tabloya yazılması, röle yeniden başlayınca verinin durması |
| `masa-duzen` | Masaüstünde sayfa taşmıyor, oran 9:5, çerçeve sahayı sarıyor, skor tablosu ekranda |
| `masaustu` | Masaüstünde dokunmatik tuş yok, klavye çalışıyor |
| `mobil` | Altı cihazda sahne tam ekran ve saha ortalı |
| `tasma` | Tuş içerikleri tuşun dışına taşmıyor (%70–%140) |
| `ayarlar` | Ayarlar kaydediliyor, maça yansıyor, sıfırlama çalışıyor |
| `macayar` | Maç içi ayar katmanı oyunu durduruyor ve tuşların üstüne binmiyor |
| `macayar-dar` | Aynısı en dar cihaz + en büyük tuş ayarında |
| `rotate-gate` | Dikey tutuşta kapı çıkıyor ve motor duruyor |

`_` ile başlayan dosyalar yardımcı modüldür, koşucu onları test saymaz.

## Ölçüm araçları (`olcum/`)

Bunlar geçti/kaldı vermez, **sayı** verir. Bir ayarı değiştirmeden önce ve
sonra koşup farka bakmak için:

| Araç | Ne ölçer |
|---|---|
| `oran` | Sayı payı, ralli teması, 2v2'de insan/partner dokunma dağılımı |
| `servis-tani` | Servis as oranı (zorluk × güç) |
| `temas-mesafe` | Temas anında topun gövdeye uzaklığı — "vurmak için değdirmek gerekiyor mu" |
| `perf` | CPU kısıtlı mobil taklidinde kare süresi dağılımı |
| `adim` | Sabit adım: kare hızından bağımsızlık, boş/çift kare, sim/gerçek oranı |
| `gecikme` | Çevrimiçi tepki süresi, tahmin hatası, öngörü mesafesi, uzlaştırma sıçraması |

`gecikme` tarayıcı kullanmıyor: iki motoru (sunucu + istemci) aynı süreçte
adım adım kilitli koşturup paketleri **N adım geciktiriyor**. Yapay gecikme
şart, çünkü yerelde ağ 0 ms ve gecikme telafisinin kazandırdığı hiçbir şey
görünmüyor. `TAHMIN=0` ile tahmin katmanı kapanıyor — aracın kendisini
doğrulamanın yolu bu:

```
TAHMIN=0 node tests/olcum/gecikme.mjs   # tepki 67–217 ms
node tests/olcum/gecikme.mjs            # tepki 17 ms
```

**Uyarı:** `oran` içindeki bot mükemmel top takip eder ve mekanik olarak
zıplar; insan gibi oynamaz. Mutlak yüzdeleri değil, aynı botla ölçülen
ÖNCE/SONRA farkını okuyun. Maç kazanma oranı ölçüt olarak kullanılmadı,
çünkü doyuma gidiyor: aynı durumu arka arkaya %50 ve %100 ölçtüm.

Sabitleri çalışma anında değiştirip süpüren yaklaşım da güvenilmez çıktı —
"değişiklik yok" kolu bile şişik sonuç verdi. Bir sabiti sınayacaksanız
dosyayı düzenleyip ölçün, gerekirse `git stash` ile temel çizgiyi doğrulayın.
Sebebi `adim` ölçümünde net göründü: Vite düzenlenen modülü `?t=...`
sorgusuyla yeniden servis ediyor, yani testin içe aktardığı `constants.js`
ile oyunun tuttuğu ayrı nesneler oluyor. Değer **okumak** güvenli,
**yazmak** değil. Karşılaştıracağınız varyantı ölçüm dosyasında yeniden
kurun — `adim` hem eski hem toleranssız döngüyü böyle koşturuyor.

## Yazarken dikkat

Bu testlerin en sık kırılma biçimi **bayat seçici**: iddia geçmeye devam
ederken yanlış şeyi ölçmeye başlıyor.

- Tuşları `aria-label` ile bulun. Tuş içerikleri ikon, `textContent` boş
  dönüyor; bir çakışma kontrolü tam bu yüzden "çakışma yok" yazdırırken
  çakışma vardı.
- Oyun canvas'ını `canvas[aria-label]` ile seçin. `querySelector('canvas')`
  artık salon kanadı katmanını döndürüyor.
- Gizli elemanlar DOM'da kalır; "tuş yok" kontrolü için sayı değil
  `getBoundingClientRect().width > 0` bakın.
- Girdiyi **doğru fazda** ölçün. `online` testinde misafirin tuşunu
  servis fazında basıp "tuş çalışmıyor" sonucuna varmıştım; girdi
  zinciri baştan sona doğruydu, ama SERVİS fazında motor hiç
  `updatePlayers` çağırmıyor ve kimse kıpırdamıyor.
- **Doğru soruyu** sorun. `gecikme` ölçümünün ilk hâli istemcinin konumunu
  sunucunun AYNI ANDAKİ konumuyla karşılaştırıyordu ve 40 px'lik bir fark
  gösteriyordu. O farkın tamamı kasıtlıydı: tahminin işi zaten ileride
  olmak. Doğru karşılaştırma, istemcinin çizdiği konum ile sunucunun BİR
  GİDİŞ YOLU SONRA ürettiği konum arasında. Yanlış eksende ölçülen bir
  sayı, doğru çalışan bir düzeltmeyi bozukmuş gibi gösteriyor.
- **Tek örneğe bakan test iki sessiz arızayı kaçırır.** Eşleşme
  sırasında korkulan şey birinin iki maça birden girmesi ya da sırada
  unutulması; ikisi de tek bir eşleşmeye bakarak görünmüyor.
  `sira.test.js` bu yüzden 200 istemciyi karışık sırayla girip
  çıkartıyor ve sonunda sayım tutturuyor.
- **Doğru sandığınız kuralı sınayın.** Sıraya "en uzun bekleyen ilk
  eşleşir" testi yazdım ve o kural bu tasarımda hiç çalışmıyordu:
  gelen ya bekleyenle eşleşiyor ya tek bekleyen oluyor, sırada aynı
  anda iki kişi bulunamıyor. Aynı testler doluluk sınırında gerçek bir
  hata da buldu — sınır, sırayı BOŞALTACAK kişiyi geri çeviriyordu.
- **`/i` bayrağı Türkçe bilmiyor.** `İ` (U+0130) ile `i` birbirine
  eşleşmiyor, `I` ile `ı` da öyle. Arayüz metni `upper()` ile Türkçe
  büyük harfe çevrildiği için `/Henüz kimse/i` ekranda yazı DURURKEN
  eşleşmiyor. Metni ekranda göründüğü hâliyle arayın.
- **Motoru maç bitmeden okuyun.** Maç bitince `MatchScreen` sonuç
  ekranına geçiyor ve `window.__game` yok oluyor; bitişten sonra
  okunan her alan `undefined` geliyor. Aynı sebeple maç sonrası sayfa
  menüye dönmüyor — lobiye gitmek için önce yeniden yükleyin.
- Ekranda ne görünüyorsa **onu** okuyun. Uzlaştırma düzeltmesi çizim
  sırasında yediriliyor, yani `player.x` ile çizilen konum bir süre farklı.
  Ölçüm çizim kodunun okuduğu fonksiyonun aynısını (`agCizimKaydirma`)
  çağırıyor; ayrı hesaplasa yumuşatmanın etkisini hiç göremezdi.

Ekran görüntüleri `tests/ciktilar/` altına yazılır ve depoya girmez.
