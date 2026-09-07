# Oyun sunucusu

Çevrimiçi maçların hem buluşma noktası hem hakemi. Oda koduyla iki
istemciyi eşleştirir **ve maçı kendisi koşturur**: fizik, kurallar,
servis burada işler; iki istemci de yalnızca çizer ve tuşlarını yollar.

## Neden sunucu hakem

Önce ev sahibi yetkiliydi: maçı odayı açan oyuncunun cihazı koşturuyordu.
Arkadaş maçında sorun değil ama yabancıyla oynanınca iki sorun doğuyor:

- **Hile.** Ev sahibi kendi tarayıcısında koşan simülasyona müdahale
  edebilir.
- **Gecikme avantajı.** Ev sahibi sıfır gecikmeyle oynarken karşısındaki
  tam gidiş-dönüş süresi kadar geriden oynuyor. Hakem sunucu olunca
  ikisi de aynı mesafede.

Motorun sunucuda koşabilmesi tesadüf değil: simülasyonun kendisi DOM'a
dokunmuyor. Tarayıcıya bağlı üç şey var (arka plan önbelleği, klavye
dinleyicileri, `requestAnimationFrame` döngüsü) ve üçü de `update()`
dışında; `bassiz: true` ile üçü de atlanıyor, döngüyü sunucu kendi
zamanlayıcısıyla sürüyor (`mac.js`).

## Neden lockstep değil

Lockstep mimaride sunucu yalnız tuşları taşır, iki makine de simülasyonu
kendi çalıştırır — ve aynı girdiden aynı sonucu üretmek zorundadır.
Bu oyunun simülasyon yolunda 30'dan fazla `Math.random()` çağrısı var
(ai.js 7, Game.js 6, serve.js 8, effects.js 15). Hepsini tohumlu üretece
çevirmek ayrı bir proje; çevirmeden lockstep denenirse iki taraftaki maç
birkaç saniyede birbirinden kopar.

Sunucu hakem mimaride rastgelelik tek yerde çalışıyor, iki taraf da
sonucu okuyor. Determinizm gerekmiyor.

## Gecikme telafisi

Sunucu hakem olunca **iki oyuncu da** kendi tuşuyla ekrandaki karşılığı
arasında bir gidiş-dönüş bekliyordu — eskiden bunu yalnız katılan taraf
hissediyordu. Tam vuruş penceresi 0.17 sn olduğu için yüksek gecikmede o
pencereyi yakalamak imkânsıza yaklaşıyordu.

Çözüm klasik: **istemci tarafı tahmin + uzlaştırma**.

1. İstemci kendi oyuncusunu tuşa basar basmaz hareket ettirir; sunucunun
   onayını beklemez.
2. Her girdi paketi istemcinin kendi **saat damgasını** taşır (`z`).
   Sunucu bu damgayı okumaz, anlık görüntüyle geri yollar (`az`) — o
   damganın sunucuda beklediği süreyle birlikte (`ay`).
3. Anlık görüntü gelince istemci kendi oyuncusunu sunucunun gerçeğine
   yazar ve aradaki adımları **kendi girdi geçmişiyle** yeniden oynar.
4. Kalan fark ışınlanma olmasın diye birkaç karede ekrana yedirilir.

Tahmin, hareket kodunu **kopyalamıyor**: sunucu da istemci de aynı
`Game.insanOyuncuAdimla` çağrısından geçiyor. Bu depoda `reach.js`'te
aynı hesabın iki kopyası tutulmuş ve %79'a kadar ayrışmıştı; tek çağrı
noktası o hatanın tekrarını engelliyor (`tahmin.test.js` bunu sınıyor).

Ölçüm — `node tests/olcum/gecikme.mjs`, yapay gecikmeli iki motor:

| Gidiş-dönüş | Tepki (önce → sonra) | Tahmin hatası (önce → sonra) |
|---|---|---|
| 0 ms | 67 ms → **17 ms** | 26.7 px → **0 px** |
| 50 ms | 83 ms → **17 ms** | 46.8 px → **6.7 px** |
| 100 ms | 167 ms → **17 ms** | 60.2 px → **6.7 px** |
| 200 ms | 217 ms → **17 ms** | 100.3 px → **9.9 px** |

`TAHMIN=0` ile katman kapanıyor; "önce" sütunu böyle ölçüldü.

## Topun ileri sarılması

Tahmin başta yalnız oyuncunun kendisine uygulanıyordu; top ara
değerlemeyle geçmişten çiziliyordu. `npm run olcum:top` sorunun
büyüklüğünü ölçtü:

| tek yön | sapma p50 | top geri |
| --- | --- | --- |
| 0 ms | 58 px | 133 ms |
| 100 ms | 83 px | 217 ms |

Bu sayıyı belirleyici yapan şey temas eşiği: `hitRadius` 40 + salınım
payı 12 + top yarıçapı 13 = **~65 px**, hızlı topta `speedPenalty` ile
~41'e iniyor. Yani görsel sapma VURUŞ PENCERESİNİN TAMAMINDAN büyüktü —
oyuncu ekranda gördüğü topa nişan alınca gerçek temas alanının dışında
kalıyordu.

Çözüm üç parçalı ve her parçası ölçümle geldi:

1. **İleri sarma.** Top `stepBall` ile — sunucunun kullandığı
   fonksiyonun ta kendisiyle — çizim saatinden "şimdi"ye sarılıyor.
   Serbest uçuşta bu tahmin değil, aynı hesabın tekrarı. Hız telden
   gelmiyor (paket yalnız `[x, y, dönüş]` taşıyor; eklemek
   `PAKET_SURUM`'u yükseltip yayındaki istemcileri kırardı), iki anlık
   görüntünün farkından türetiliyor — ortalama hızı anlık hıza çeviren
   yerçekimi düzeltmesiyle.
2. **Süreksizlik yumuşatması.** Vuruş anında tahmin yanılıyor ve paket
   gelince top gerçek yerine atlıyor. Yalnız FAZLALIK sapmaya alınıp
   birkaç karede eritiliyor; farkın tamamını almak topu her karede
   frenler ve kazancı yok ederdi (ilk sürümde tam bu oldu: sapma
   58 px'den 74 px'e ÇIKTI).
3. **Yakınlık frenlemesi.** Vuruşun nerede olacağını bilmiyoruz ama
   nerede olamayacağını biliyoruz: kimsenin yakınında olmayan top
   serbest uçuyordur. Ufuk, top bir oyuncunun temas alanına
   yaklaştıkça kısalıyor.

Sonuç — `TOPILERI=0 npm run olcum:top` ile "önce", düz koşumla "sonra":

| tek yön | sapma p50 | sapma p95 | top geri | en büyük sıçrama |
| --- | --- | --- | --- | --- |
| 0 ms | 58 → **26** px | 87 → **65** px | 133 → **67** ms | 1 → 15 px |
| 25 ms | 59 → **17** px | 96 → **67** px | 150 → **33** ms | 5 → 15 px |
| 50 ms | 65 → **11** px | 104 → **69** px | 167 → **33** ms | 6 → 17 px |
| 100 ms | 83 → **12** px | 129 → **119** px | 217 → **0** ms | 7 → 22 px |

Medyan sapma top yarıçapının (13 px) altına indi: çizilen top artık
gerçek topla örtüşüyor. Bedeli dürüstçe — sıçrama 1-7 px'den 15-22 px'e
çıktı, yani vuruş anında ekranda küçük bir düzeltme görünüyor.
Karşılığında nişan alınan yer doğru.

Oyuncu tahmini ve akıcılık etkilenmedi (tepki hâlâ 17 ms, duraklama
%0) — ikisi de ayrı ölçümlerle doğrulandı.

## Rövanş

Çevrimiçi bir maçın en sık istenen devamı "bir daha" ve bunun yolu
yoktu: maç biter bitmez soket kapanıyor, oyuncu menüye dönüp baştan
rakip arıyordu. Yeni rakip bulmak, az önce oynadığın kişiyle tekrar
oynamaktan çok daha uzun.

Artık soket maç sonrası AÇIK kalıyor (ana menüye dönülünce kapanıyor)
ve sonuç ekranında RÖVANŞ düğmesi çıkıyor.

**İki taraf da istemeli.** Tek taraflı başlatmak, ekranı okuyan ya da
çıkmak üzere olan oyuncuyu hazırlıksız maça sokardı. İstekler odada
birikiyor (`oda.rovans`); ikisi de girince maç aynı ayarla kuruluyor —
oyuncu ikinci kez kadro/format seçmiyor.

Ekran hangi aşamada olduğunu söylüyor ("RAKİP BEKLENİYOR", "SIRA
SENDE"), çünkü "bastım ve bir şey olmadı" en kötü hâl.

## Bağlantı göstergesi

Maç ekranında skorbordun yanında üç çubuk ve milisaniye. Eşikler
**uydurulmadı, ölçüldü** — genel ağ sezgisiyle ("100 ms iyidir") eşik
seçmek burada yanlış olurdu, çünkü önemli olan gecikmenin kendisi değil
BU OYUNDA neyi bozduğu.

Ölçüt topun temas penceresi: `hitRadius` 40 + salınım payı 12 + top
yarıçapı 13 = **~65 px**. Görsel sapma bunu aştığında oyuncu ekranda
gördüğü topa nişan alıyor ama gerçek temas alanının dışında kalıyor.
`npm run olcum:top` ile ölçülen p95 sapma:

| gidiş-dönüş | p95 sapma | pencereye oranı | kademe |
| --- | --- | --- | --- |
| 0 ms | 65 px | ~1x | **İYİ** |
| 100 ms | 69 px | ~1x | **İYİ** |
| 200 ms | 119 px | ~2x | **ORTA** |
| 300 ms | 170 px | ~3x | **KÖTÜ** |
| 600 ms | 245 px | ~4x (medyan bile 66 px) | **KÖTÜ** |

Kademeler `src/game/baglantiKalite.js` içinde ve testleri temas
penceresini KODDAN hesaplayıp doğruluyor: biri `hitRadius`ı
değiştirirse test durup ölçümün tazelenmesi gerektiğini söylüyor.

Ayrı bir yoklama (ping/pong) mesajı **eklenmedi**: gidiş-dönüş bilgisi
uzlaştırmadan zaten her pakette geliyor, fazladan mesaj hem bant hem
yeni bir arıza yüzeyi olurdu.

### Gösterge neyi ölçüyor — ve bir düzeltme

İlk sürüm `agPencere`yi okuyordu ve o değerden **sunucudaki bekleme
düşülüyor**. Çıkarma TAHMİN için doğru (sunucu o süreyi zaten bu
girdiyle ilerletmiş) ama oyuncunun HİSSETTİĞİ gecikme beklemeyi
içeriyor. Sunucu 20 Hz gönderdiği için kuyruk ortalama ~34 ms ve
göstergeden tam o kadar eksiliyordu.

Bir oyuncu bildirdi: *"online oynarken 2 ms yazıyor ama inandırıcı
değil"*. Haklıydı — gerçek gidiş-dönüşü ~36 ms olan biri ekranda 2 ms
görüyordu. `npm run olcum:ping` hatayı yeniden üretti:

| gerçek RTT | önce | sonra |
| --- | --- | --- |
| 67 ms | 33 ms | 100 ms |
| 100 ms | 67 ms | 117 ms |
| 200 ms | 166 ms | 233 ms |
| 300 ms | 266 ms | 283 ms |
| 400 ms | — | 400 ms |

Önce **sistematik olarak eksik**; sonra ±2 adım salınım, ortalama sapma
+6 ms. Kalan salınım kuantizasyon (60 Hz döngü, 30 Hz anlık görüntü).

Gösterge artık `agDongu`yu okuyor — `agPencere` tahminde kalıyor. İki
alan bilerek ayrı; bir birim testi ikisine FARKLI değer atayıp
göstergenin doğru olanı okuduğunu sınıyor, bir entegrasyon testi de
gerçek iki motorlu döngüde sapmanın 25 ms'i aşmadığını.

Sayı da yazılıyor, yalnız çubuk değil — "kötü" derken suçu oyuncunun
internetine atıyormuş gibi olmasın, kendi durumunu doğrulayabilsin.

## Gösterge doğruydu ama oyuncu da haklıydı

Ping düzeltildikten sonra aynı oyuncu şunu söyledi: *"bence ping
gözüktüğünden çok daha yüksek, bu şekilde oynanılacak vaziyette
değil"*. İki ihtimal vardı ve karıştırılmamaları gerekiyordu: gösterge
hâlâ yanlış olabilirdi, ya da gösterge doğru olup gecikme başka bir
yerden geliyor olabilirdi.

`npm run olcum:hissedilen` bu soruyu ayırmak için yazıldı. Göstergenin
ölçtüğü şey **kendi girdimin gidiş-dönüşü**; oyuncunun hissettiği şey
ise **rakibin ekrana ne kadar geç geldiği** ve o yol daha uzun:

```
sunucuda olay → anlık görüntü kuyruğu → ağ (tek yön)
              → ara değerleme tamponu → ekran
```

Ölçüm rakibi sunucuda bilinen bir adımda yürütüp istemcinin ÇİZDİĞİ
rakibin kaç ms sonra kıpırdadığına bakıyor. Bulgu:

| ağ RTT | gösterge | rakip ekranıma kaç ms sonra geliyor |
| --- | --- | --- |
| 0 ms | 67 ms | **117 ms** |
| 67 ms | 83 ms | 133 ms |
| 200 ms | 217 ms | 200 ms |

**Ağda hiç gecikme yokken bile 117 ms.** Yani baskın kalem ağ değil,
kendi kodumuzdu. Üç ayrı sebep çıktı:

**1. Gönderme kapısı süre karşılaştırıyordu.** `this.time` sabit
adımların toplamı olduğu için kayan nokta artığı biriktiriyor ve
eşiğin altında kalan kareler bir adım daha bekliyordu. 30 Hz ayarı
gerçekte **22.5 Hz**'di, aralıkların üçte ikisi 2 değil 3 adımdı.
Ayarın yalan söylemesinden kötüsü aralığın DÜZENSİZ olmasıydı:
istemcinin tamponu bu düzensizliği seğirme sanıp kendini gereksiz yere
büyütüyordu. Kapı artık adım sayıyor.

**2. Ara değerleme tamponu sabit 100 ms'ti.** Tampon ağ seğirmesini
yutmak için var, ama sabit sayı **herkese en kötü bağlantının bedelini
ödetiyordu** — seğirmesi 5 ms olan bir oyuncu, 40 ms seğiren biri için
ayrılmış payı taşıyordu. Artık seğirme ölçülüyor (paket damgası ile
kendi saatimiz arasındaki farkın kendi ortalamasından sapması) ve
tampon `1.5 × paket aralığı + 2.5 × seğirme` oluyor, 200 ms tavanla.
Mutlak gecikme değil SAPMA kullanılıyor, çünkü farkın içinde iki saat
arasındaki bilinmeyen kayma da var; ortalama onu soğuruyor.

Paket aralığı da `durumHz`den okunmuyor, **ölçülüyor**: o sabit karşı
tarafın gönderme hızını belirler, bizimkini değil. Yeni bir istemci
eski bir röleyle konuşurken sabit varsayım tabanı gerçek aralığın
altına düşürür ve tampon her karede kururdu.

**3. Anlık görüntü 20 → 30 Hz.** Hem kuyruk beklemesini hem de
aralıkla ölçeklenen tamponu küçültüyor.

Sonuç (`olcum:hissedilen`, `olcum:top`, `olcum:akicilik`):

| ölçüt | önce | sonra |
| --- | --- | --- |
| hissedilen gecikme (ağ 0 ms) | 117 ms | **67 ms** |
| hissedilen gecikme (ağ 200 ms) | 200 ms | **150 ms** |
| top sapması p50 / p95 (ağ 0 ms) | 25.8 / 64.7 px | **10.2 / 37.2 px** |
| top sapması p95 (tek yön 100 ms) | 119 px | **74 px** |
| dalgalanma (dört durum) | 0.12-0.14 | **0.07-0.08** |
| duraklama | %0 | %0 |
| tepki (kendi oyuncum) | 17 ms | 17 ms |

Bedeli bant genişliği ve o da ölçüldü (`olcum:kapasite`, 32 eşzamanlı
maç): 472 → 702 KB/sn, %49 artış. Karşılığını verip vermediği
varsayılmadı, ölçüldü: uyarlanan tamponla 20 Hz'de kalınsaydı
hissedilen gecikme 83 ms, top sapması p50/p95 14.9/48.4 px, dalgalanma
0.11-0.15 olurdu — yani fazladan paketin karşılığı her üç ölçütte de
görünüyor.

## Teşhis katmanı — `?tani=1`

Adrese `?tani=1` eklenince maç sırasında sol üstte canlı sayılar
çıkıyor: ping, seğirme, ölçülen paket aralığı, sessizlik, ara değerleme
tamponu, çizim geriliği, ileri sarma oranı, kare süresi, çizim süresi
ve uzun kare yüzdesi. Parametre yoksa hiç çizilmiyor.

**Neden var:** bir oyuncu aylarca "top gecikmeli ilerliyor" dedi ve
buradaki ölçümlerin hiçbiri bunu doğrulamadı. Sebebi sonradan anlaşıldı
— hepsi masaüstü bir tarayıcıda ya da Node'da koşuyordu; oyuncunun
telefonu başka bir şey yapıyordu. Aradaki farkı kapatmanın tek yolu
sayıları **oyuncunun cihazından** almaktı.

Katmanın kendisi bir e2e testiyle sınanıyor (`tests/e2e/tani.mjs`):
bilinen bir gecikme enjekte ediliyor ve ekrandaki sayıların onunla
tutarlı olması bekleniyor. Yanlış sayı gösteren bir teşhis aracı,
hiç araç olmamasından kötüdür.

### Katmanın bulduğu şey

İlk ekran görüntüsü şunu gösterdi:

```
kare 33ms · uzun kare %97.6 · tampon 170ms · gerilik 193ms
```

Telefon 30 fps çiziyordu **ve** tampon olması gerekenin üç katındaydı.
İkisi bağımsız değildi: seğirme ölçümü istemcinin kendi **kare
saatini** okuyordu ve o saat yalnız kare başına ilerliyor. 33 ms'lik
kareler paket varışlarını kutulara yuvarlıyor, kod bunu ağ seğirmesi
sanıp tamponu şişiriyordu.

Yani **düşük kare hızı, ağda hiçbir şey değişmeden gecikmeye
dönüşüyordu.**

Ölçüldü (`npm run olcum:kare-hizi`, ağ sabit, yalnız kare hızı değişken):

| fps | kare düzensizliği | uydurulan seğirme | tampon |
| --- | --- | --- | --- |
| 60 | ±%30 | 6 → **8 ms** | 66 → **70 ms** |
| 30 | ±%30 | 146 → **10 ms** | 200 → **77 ms** |

Varış anı artık `performance.now()`dan okunuyor (`agSaat`); `agPaketAl`
soket olayından çağrıldığı için orada okunan değer paketin gerçek varış
anı, kareyi beklemiyor. Aynı telefonda tampon 170 → 63 ms, gerilik
193 → 90 ms oldu.

Bu değişiklik sessiz bir tuzak açtı ve bir ölçümü bozdu: saati enjekte
etmeyi unutan `olcum:vurus` 33 → 167 ms'e fırladı. Misafir motoru kuran
bütün düzenekler tarandı ve dördü daha düzeltildi.

### Sonra ne kaldı

İkinci bir telefonda (60 fps, aynı ağ) katman şunu gösterdi:

| ping | seğirme | sessizlik | tampon | gerilik | kare | çizim |
| --- | --- | --- | --- | --- | --- | --- |
| 50 | 2 | 17 | 61 | 72 | 17 | 0.8 |
| 154 | 36 | **133** | 141 | 85 | 17 | 1.0 |
| 73 | 23 | 0 | 126 | 161 | 17 | 0.9 |
| 53 | 3 | 17 | 57 | 68 | 17 | 0.8 |

İki sonuç:

- **Çizim ~1 ms.** Yani 30 fps'e düşen cihazın sebebi bizim çizimimiz
  değil; kısıtlama cihazda ya da tarayıcıda.
- **`sessizlik 133 ms`** = 33 ms'de bir gelmesi gereken paket dört
  aralık boyunca hiç gelmemiş. Gerçek bir Wi-Fi tökezlemesi, ve tampon
  buna doğru tepki veriyor.

Tamponun tökezlemeyi abartıp abartmadığı ayrıca ölçüldü: saniyede bir
120 ms'lik tökezlemede bile ortalama tampon 70 ms'de kalıyor. Yani
ekranda görülen 141 ms, o anda gerçekten sürekli seğiren bir
bağlantının doğru karşılığı — kodun abartması değil.

## Rakip adı ve taraf etiketleri

Çevrimiçide skorbordda artık rakibin TAKMA ADI yazıyor, yapay zekâ
takımının adı değil. Karşındaki insanken "NORDİK" görmek maçı
kişisizleştiriyordu — üstelik sprite'ın üstünde zaten oyuncunun adı
yazıyordu, yani ekran iki farklı isim söylüyordu.

Bunu yaparken **ölçüm bir hata buldu**: skorbordun ev etiketi sabit
'TÜRKİYE' idi. Çevrimdışında doğru (oyuncu her zaman ev sahibi) ama
çevrimiçide değil — hızlı eşleşmede Türkiye'yi kimin oynayacağına
sunucu karar veriyor ve deplasmana düşen oyuncu KENDİ TARAFINDA
rakibinin adını görüyordu:

```
ev sahibi oyuncu:   TÜRKİYE  ...  OYUNCU-B      doğru
deplasman oyuncu:   TÜRKİYE  ...  OYUNCU-A      YANLIŞ — kendi tarafı
```

Kural artık şu: karşı taraf rakibin adını, kendi tarafın oynadığın
takımın adını taşıyor (`Game.agTakimEtiketleri`).

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

Bu değişken tanımlı değilse menüde **HEMEN OYNA** ve **ARKADAŞLA
OYNA** seçenekleri hiç görünmez — çalışmayan bir düğme, basılana kadar süren bir yalandır.

Geliştirmede `?rele=ws://localhost:8787` sorgu parametresiyle de
ezilebilir. Üretim yapısında bu parametre okunmaz: paylaşılan bir
bağlantının oyuncuyu yabancı bir sunucuya bağlaması istenmiyor.

## Dağıtım — Hetzner (kendi sunucun)

Kendi sunucunda mevcut bir ters vekil (nginx veya Caddy) zaten
80/443'ü kullanıyorsa bu yol en azdan-çoğa gider: röle dışarıya hiç
açılmaz, yalnızca `127.0.0.1:8787`'de dinler; mevcut ters vekil onun
önünde durup TLS'i (`wss://`) karşılar.

```
Sunucu IP'si:  178.104.2.249
Röle adresi:   rele.retrovoleybol.online
```

### Neden kendi alan adı — sslip.io neden bırakıldı

Önce `rele-178-104-2-249.sslip.io` kullanılıyordu. sslip.io ve nip.io
DNS kaydı gerektirmeden adın İÇİNDEKİ IP'ye çözüyor; bedava ve hızlı.

Sorun, adresin `.aab`'nin İÇİNE gömülmesi. Web'de IP değişirse
`VITE_RELE_URL`'i güncelleyip yeniden dağıtırsın — on dakika. Mağazada
öyle değil: telefonlardaki uygulama o adresi taşır ve sunucunun IP'si
değiştiği gün — yeni makineye taşıma, sağlayıcı değişikliği, Hetzner'in
IP'yi geri alması — çevrimiçi mod ölür. Tek çare yeni sürüm yayınlayıp
herkesin güncellemesini beklemek olur.

Kendi alan adında bu indirekt katman DNS'te: sunucu değişince A kaydını
güncellersin, pakete gömülü adres aynı kalır. `npm run paket` artık
IP'ye bağlı bir adresle paketlemeyi **durduruyor**
(`scripts/rele-adresi.js`).

### DNS kayıtları

Alan adı **Namecheap**'te, BasicDNS ile. Kayıtlar Domain List → Manage
→ **Advanced DNS** altında:

| Tip | Host | Değer | Ne için |
| --- | --- | --- | --- |
| A | `rele` | `178.104.2.249` | **Röle.** Vercel'in bundan haberi yok, olmamalı da — bu kayıt doğrudan Hetzner sunucusuna gidiyor |
| A | `@` | `216.198.79.1` | Web sitesi (Vercel) |
| CNAME | `www` | `77ce11e60fe721d1.vercel-dns-017.com` | Web sitesi (Vercel). Bu değer **hesaba özel** — kendi Vercel panelinden kopyala, buradaki örnek |

Üç tuzak, üçü de yaşandı:

1. **Namecheap'in "REDIRECT DOMAIN" özelliği `@` A kaydının kendisidir.**
   Panelde ayrı bir kutu gibi görünüyor ama arka planda Namecheap'in
   kendi yönlendirme sunucusuna (`162.255.119.57`) A kaydı yazıyor.
   Dururken `@`'a başka A kaydı eklenemiyor. Üstelik gereksiz: apex →
   www yönlendirmesini Vercel zaten yapıyor (308).
2. **Yeni alan adında hazır gelen park kayıtları siliniyor** —
   `CNAME www → parkingpage.namecheap.com` bunlardan biri.
3. **CNAME değerini elle yazma.** Vercel sondaki noktayla gösteriyor
   (`...-017.com.`); Namecheap'e noktasız girilir, kendisi ekler.

Cloudflare kullanıyorsan `rele` için **proxy KAPALI** (gri bulut) —
turuncu bulut WebSocket'i vekilliyor ve gereksiz bir katman ekliyor.

Yayılmayı doğrula (kendi makinende):

```bash
dig +short rele.retrovoleybol.online   # 178.104.2.249
dig +short retrovoleybol.online        # 216.198.79.1
dig +short www.retrovoleybol.online    # ...vercel-dns-017.com + IP'ler
```

Vercel panelindeki üç satır da **Valid Configuration** olmalı. `rele`
orada GÖRÜNMEZ; onu yalnız yukarıdaki `dig` doğrular.

Tüm sunucu komutları **kendi sunucunda**, SSH ile bağlanıp
çalıştırılır. **DNS önce oturmalı**: hem Caddy hem certbot sertifikayı
alabilmek için alan adının sunucuya çözülmesini bekliyor.

**1) Depoyu sunucuya al (yoksa klonla, varsa güncelle) ve röleyi başlat:**

```bash
git clone https://github.com/nietzische-app/fileninsultanlar-.git
cd fileninsultanlar-/sunucu

# 8787 boş mu, önce kontrol et — dolu ise başka bir şey o portu kullanıyor
ss -ltnp | grep 8787

docker compose up -d --build
curl http://127.0.0.1:8787/saglik
```

Şunu görmelisin: `{"durum":"ayakta","oda":0,"istemci":0,...}`. Görmüyorsan
`docker compose logs` ile hataya bak.

*(`docker compose` çalışmazsa eski sürüm demektir, `docker-compose`
— arada tire ile — dene.)*

**2) Röleyi 80/443'ü tutan şeye tanıt.** Hangi yolu izleyeceğin
sunucunda **ne çalıştığına** bağlı — `sudo ss -ltnp | grep -E ':80|:443'`
ile bak, sonra `docker ps` ile o portu tutan şey bir konteynerse
hangisi olduğunu bul.

**2a) nginx varsa** (host'a kurulu, `nginx -v` çalışıyorsa):

```bash
sudo cp nginx-rele.conf.ornek /etc/nginx/sites-available/filenin-rele
sudo sed -i 's/RELE_DOMAIN/rele.retrovoleybol.online/' /etc/nginx/sites-available/filenin-rele
sudo ln -s /etc/nginx/sites-available/filenin-rele /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` hata verirse dur — muhtemelen sunucunda `sites-available`
düzeni farklı (bazı kurulumlar `conf.d/` kullanır); o zaman dosyayı
`/etc/nginx/conf.d/filenin-rele.conf` olarak koy, `sites-enabled`
adımını atla. Ardından **3) TLS sertifikası al**'a geç.

**2b) Caddy varsa** (`docker ps` içinde `caddy` imajlı bir konteyner,
80/443'ü o tutuyorsa) — nginx adımlarını ATLA, certbot da GEREKMEZ:
Caddy kendi TLS sertifikasını otomatik alıyor.

```bash
# Caddy hangi Docker ağında, Caddyfile host'ta nerede — önce öğren
docker inspect <caddy-konteyner-adı> --format '{{json .NetworkSettings.Networks}}'
docker inspect <caddy-konteyner-adı> --format '{{json .Mounts}}'
```

`docker-compose.yml` içindeki `rele` servisi zaten `aegis_net` adlı
bir ağa katılacak şekilde ayarlı — **eğer senin Caddy ağının adı
farklıysa** dosyadaki iki `aegis_net` geçen satırı kendi ağ adınla
değiştir. Sonra röleyi o ağa gerçekten bağla:

```bash
docker compose up -d --build
```

Caddyfile'a (host'taki gerçek dosya yoluna, örn. `/opt/aegis/Caddyfile`)
şu bloğu ekle — `filenin-rele` konteyner adı, `8787` röle konteynerinin
İÇ portu (host portu değil, çünkü artık aynı Docker ağındasınız):

```
rele.retrovoleybol.online {
    reverse_proxy filenin-rele:8787
}
```

**Adres DEĞİŞTİRİYORSAN eskisini silme, yanına ekle.** Caddy tek blokta
virgülle iki ad kabul ediyor:

```
rele-eski-adres.example, rele.retrovoleybol.online {
    reverse_proxy filenin-rele:8787
}
```

Sebep: yayındaki `.aab` ve Vercel yapısı hâlâ eski adrese bakıyor.
Tek satırda değiştirirsen, sen `VITE_RELE_URL`'i güncelleyip yeniden
dağıtana kadar çevrimiçi mod ölür. Yeni adres doğrulandıktan SONRA
eskisini silersin.

Değişikliği uygulamadan önce doğrula — bu Caddy başka servisleri de
servis ediyor olabilir ve bozuk bir dosyayla reload hepsini düşürür:

```bash
docker exec <caddy-konteyner-adı> caddy validate --config /etc/caddy/Caddyfile
docker exec <caddy-konteyner-adı> caddy reload --config /etc/caddy/Caddyfile
```

#### `sed -i` TUZAĞI — reload "config is unchanged" diyorsa

Caddyfile tek dosya olarak bind mount edilmişse
(`/opt/aegis/Caddyfile -> /etc/caddy/Caddyfile`) **`sed -i` ile
düzenleme.** `sed -i` dosyayı yerinde değiştirmiyor: yeni bir dosya
yazıp eskisinin üstüne `rename` ediyor, yani YENİ BİR INODE yaratıyor.
Docker ise tek dosyalık mount'u konteyner başlarken inode'a bağlıyor,
yola değil — konteyner eski inode'u görmeye devam ediyor.

Belirtisi sinsi, çünkü her şey başarılı görünüyor:

```
host'ta diff       → değişiklik var
caddy validate     → "Valid configuration"   (ESKİ dosyayı doğruluyor)
caddy reload       → "config is unchanged"   ← tek ipucu bu
curl yeni-adres    → TLS hatası (o ad için site yok)
```

Konteynerin ne gördüğünü sor, host'a bakma:

```bash
docker exec <caddy-konteyner-adı> grep -n "rele" /etc/caddy/Caddyfile
```

Olduysa çözüm konteyneri yeniden başlatmak (mount yolu tekrar çözülür).
Yeni inode'a yazmak işe yaramaz, çünkü konteyner artık ona bakmıyor:

```bash
docker restart <caddy-konteyner-adı>   # 80/443 birkaç saniye kapanır
```

Bir daha yaşamamak için inode'u koruyan yolla düzenle — son `cat >`
mevcut dosyayı truncate edip AYNI inode'a yazıyor:

```bash
sed -E 's/eski/yeni/' /opt/aegis/Caddyfile > /tmp/cf && cat /tmp/cf > /opt/aegis/Caddyfile
```

Caddy ilk istekte bu domain için otomatik Let's Encrypt sertifikası
alır — certbot'a hiç gerek yok. `tls-alpn-01` doğrulaması 443 üzerinden
yürüdüğü için ek bir port açmak da gerekmiyor; onay 10-20 saniye
sürebiliyor, `certificate obtained successfully` satırını bekle.
Ardından doğrudan **4) Sınama**'ya geç.

**3) TLS sertifikası al** (yalnız 2a — nginx yolunu izlediysen;
certbot kuruluysa, değilse önce `sudo apt install certbot python3-certbot-nginx`):

```bash
sudo certbot --nginx -d rele.retrovoleybol.online
```

Certbot 443 bloğunu ve http→https yönlendirmesini otomatik ekler.
E-posta/onay soracak, mail adresini gir ve kabul et.

**4) Sınama:**

```bash
curl https://rele.retrovoleybol.online/saglik
```

Aynı `{"durum":"ayakta",...}` cevabını, bu sefer `https://` üstünden
görmelisin.

**5) Oyunu bu adrese bağla** — Vercel'de:

- Projene gir → **Settings** → **Environment Variables**.
- **Key:** `VITE_RELE_URL`, **Value:** `wss://rele.retrovoleybol.online`,
  **Environment:** Production. Kaydet.
- **Deployments** sekmesinden en üstteki yayının **⋯** → **Redeploy**.
  Değişken ancak yeni bir yayında etki eder.

Yeniden yayın bitince ana menüde **ÇEVRİMİÇİ** düğmesi görünür.

### Güncelleme

Kod değiştiğinde sunucuda (zaten `sunucu/` dizinindeysen `cd`'yi atla):

```bash
cd fileninsultanlar-/sunucu
git pull
# SURUM damgası imaja basılıyor; `/saglik` onu yayınlıyor ve
# "röle yeni kodda mı" sorusu böylece tahmin olmaktan çıkıyor.
SURUM=$(git rev-parse --short HEAD) docker compose up -d --build
```

`SURUM=` olmadan da çalışır, yalnız damga `bilinmiyor` yazar.

Doğrulama:

```bash
# Konteyner hemen açılmıyor; birkaç saniye ver
sleep 3 && curl http://127.0.0.1:8787/saglik
```

Beklenen:

```json
{"durum":"ayakta","oda":0,"sira":0,"oyuncu":0,"kalici":true,"birim":true,
 "surum":"b3fa7f4","paketSurum":2,"ag":{"durumHz":30,"durumAdim":2,"tamponTabanMs":50}}
```

Şuna bak:

| Belirti | Anlamı |
|---|---|
| `curl: (56) Recv failure` | Konteyner henüz açılmamış (docker-proxy bağlantıyı kabul edip sıfırlıyor) ya da süreç çökmüş. Birkaç saniye sonra tekrar dene; hâlâ öyleyse `docker compose logs --tail 40`. |
| `oyuncu`/`kalici` alanları yok | Eski imaj hâlâ ayakta — yapı başarısız olmuş. `docker compose logs --tail 40`. |
| `"kalici": false` | Veri dizinine yazılamıyor. Maçlar oynanır, tablo yeniden başlatmada sıfırlanır. |
| `"birim": false` | **Kalıcı birim bağlanmamış.** Tablo her `up --build` ile gider. |
| **`ag` alanı yok** | **Röle ESKİ kodda.** Aşağıya bak — bu, düzelmemekten de kötü. |
| `"surum":"bilinmiyor"` | Yapı depo dışından çalıştırılmış; kod yeni olabilir ama hangi taahhüt olduğu belli değil. |

### İstemci yeni, röle eski — en sinsi hâl

İstemciyi Vercel kendiliğinden dağıtıyor, röleyi SEN elle dağıtıyorsun.
İkisi ayrı sürümde kaldığında belirti "yaptığın düzeltme işe yaramadı"
oluyor ve dışarıdan hangisinin eski olduğu görünmüyor.

Üstelik karışık sürüm, hiç düzeltmemekten **daha kötü**. Ölçüldü:

| | rakip ekranıma (ağ 0 ms) | istemcinin tamponu | rölenin gerçek paket aralığı |
|---|---|---|---|
| yeni istemci + **yeni röle** | 50 ms | 50 ms | hep 2 adım (30 Hz) |
| yeni istemci + **eski röle** | **100 ms** | **96 ms** | 4 adım ×78, 3 adım ×11 (~15 Hz) |

Sebebi: eski rölenin gönderme kapısı süre karşılaştırıyordu ve kayan
nokta artığı yüzünden aralıklar hem uzun hem DÜZENSİZDİ (20 Hz ayarı
gerçekte ~15 Hz). Yeni istemcinin uyarlanan tamponu bu düzensizliği —
haklı olarak — ağ seğirmesi sayıp kendini iki katına çıkarıyor.

`ag.durumAdim` alanı bunun için var: eski sürümde o alan hiç yok, yani
**yokluğu da bilgi**. Bir birim testi `durumHz` ile `durumAdim`in
birbiriyle tutarlı kalmasını da sınıyor.

İstemci tarafında da aynı damga var: **Ayarlar ekranının dibinde
`YAPIM <taahhüt>`** yazıyor. Telefonda görünür olması kasıtlı — hata
bildiren oyuncu telefonda ve orada geliştirici konsolu yok. Damga
Vercel'de `VERCEL_GIT_COMMIT_SHA`dan, yerelde `git`ten geliyor; ikisi
de yoksa `bilinmiyor` yazıyor, uydurmuyor.

Yani "iki taraf da yeni mi" sorusu artık iki bakışa indi:

| Taraf | Nereye bakılır | Beklenen |
|---|---|---|
| röle | `curl -s http://127.0.0.1:8787/saglik` | `surum` alanı, son taahhüt |
| istemci | oyunda Ayarlar ekranının dibi | `YAPIM` + aynı taahhüt |

İkisi aynı taahhüdü göstermiyorsa gecikme ölçümlerine bakmadan önce
eksik olanı dağıt.

### "Sunucu mu suçlu" — taşımadan önce ölç

Gecikme şikâyetinde ilk akla gelen sunucuyu taşımak oluyor, ama
suçlunun kim olduğu ölçülebilir bir şey. Üç kaynak var ve üçü ayrı
ayrı bakılmalı:

```bash
# 1) RÖLE YENİ KODDA MI  (en sık sebep bu)
curl -s http://127.0.0.1:8787/saglik | grep -o '"ag":{[^}]*}'

# 2) MAKİNE TİKLERİ TUTUYOR MU — kendi zamanlayıcısı, ağ değil
docker compose exec rele node tik-tani.mjs

# 3) AĞ — oyuncunun bulunduğu yerden, sunucunun üstünden değil
ping -c 20 rele.retrovoleybol.online
```

Nasıl okunur:

| Ölçüm | İyi | Kötüyse ne yapılır |
|---|---|---|
| `ag.durumAdim` | `2` | Röleyi yeniden dağıt — bedava ve en büyük kazanç |
| tik p95 | < 25 ms, geç tik %5 altı | CPU sınırını yükselt ya da komşu servisleri seyrelt |
| ping (TR → Almanya) | 40-60 ms | Ancak bu 100 ms'i aşıyorsa sunucu taşımak konuşulur |

Sıralama önemli: 40-60 ms'lik bir gidiş-dönüş çevrimiçi oyun için
normaldir ve tek başına "oynanmaz" demek değildir. Kodun eklediği
gecikme bir zamanlar bunun iki katıydı — önce onu bitir, sunucunun yeri
en son bakılacak şey.

### Neden `ls /veri` ile doğrulanmıyor

Denemek isteyebilirsin ama **hiçbir şey söylemiyor**: veri dizini ilk
maça kadar zaten boş, ve birim hiç bağlanmamışken de aynı boş dizin
görünüyor. Üstelik konteyner root olarak koştuğu için yazma denemesi
de o durumu yakalamıyor — bağlanmamış dizin gayet yazılabilir.

Ayrım sunucunun kendisinde yapılıyor: veri dizini konteynerin kök
dosya sisteminden FARKLI bir aygıtta mı (`birim` alanı). Açılış
günlüğü de aynı şeyi söylüyor:

```bash
docker compose logs | grep -i -E "kalıcı|UYARI"
```

Yedek:

```bash
docker compose cp rele:/veri/oyuncular.jsonl ./yedek.jsonl
```

### Sunucu taşınırsa

Alan adının asıl kazancı burada. Yeni sunucunun IP'sini öğren, DNS'te
`rele` A kaydını o IP'ye çevir, röleyi orada ayağa kaldır. Pakete
gömülü adres değişmediği için **mağazadaki uygulamaya hiç dokunmadan**
taşıma tamamlanır. Eskiden bu, yeni bir sürüm yayınlamak demekti.

### (Tarihçe) nip.io/sslip.io yerine gerçek domain

Bu bölüm alan adı alınmadan önce yazılmıştı; artık `retrovoleybol.online`
kullanılıyor. Tek fark 1. ve 3-4. adımlardı: nip.io/sslip.io
yerine `rele.senin-domainin.com` gibi bir A kaydını sunucunun IP'sine
yönlendirirsin, gerisi (docker compose, nginx/Caddy şablonu, certbot)
aynen çalışır. nip.io/sslip.io üçüncü taraf servisler — uzun vadede
kendi domain'in altında bir alt alan adı daha sağlam bir seçim.

### Neden Docker dışarıya port açmıyor

`docker-compose.yml` içinde `127.0.0.1:8787:8787` diyor, `0.0.0.0`
değil. Röle TLS konuşmuyor; port doğrudan dışarıya açık olsaydı
tarayıcı zaten `wss://` isteyip `ws://`ya bağlanamazdı ama biri
`ws://sunucu-ip:8787` ile şifresiz de bağlanabilirdi. Tüm trafiğin
tek girişi ters vekilin (nginx/Caddy) TLS uçlaması olsun diye kapalı
tutuluyor.

## Dağıtım — Fly.io

Kendi sunucun yoksa ya da altyapıyla uğraşmak istemiyorsan alternatif.
Vercel kalıcı WebSocket taşımıyor; röle ayrı bir yerde durmalı. Depoda
Fly.io için hazır `Dockerfile` ve `fly.toml` var.

```bash
# 1) flyctl kur ve giriş yap
curl -L https://fly.io/install.sh | sh
fly auth login

# 2) BU dizinden (sunucu/) uygulamayı oluştur — dağıtma henüz
cd sunucu
fly launch --no-deploy --copy-config --name <benzersiz-ad> --region fra

# 3) fly.toml içindeki `app` satırını verdiğin adla eşitle

# 4) Dağıt — KÖKTEN, --ha=false ŞART (sebepleri aşağıda)
cd ..
fly deploy --config sunucu/fly.toml --dockerfile sunucu/Dockerfile --ha=false .

# 5) Ayakta mı
fly status
curl https://<benzersiz-ad>.fly.dev/saglik
```

`/saglik` şunu döndürmeli:

```json
{"durum":"ayakta","oda":0,"istemci":0,"makine":"148e2..."}
```

### `--ha=false` neden şart

Röle **durum tutuyor**: hangi kodun hangi iki sokete ait olduğu
sunucunun belleğinde. Fly varsayılan olarak iki makine açar ve
bağlantıları aralarında paylaştırır — oda açan bir makineye, katılan
diğerine düşerse katılan "oda yok" hatası alır ve hata aralıklı
görünür (bazen çalışır, bazen çalışmaz), teşhisi zor bir tür arıza.

`fly.toml` bunu tek makineye 400 bağlantı verecek şekilde ayarlıyor
(200 eşzamanlı maç). Daha fazlası gerekirse çözüm makine eklemek
değil, oda defterini paylaşılan bir yere (Redis) taşımak ya da kodu
makine kimliğiyle etiketlemek olur.

Sonradan kontrol:

```bash
fly scale count 1
fly machines list      # tek makine görünmeli

# En kesin sınama: birkaç kez çağır, `makine` hep aynı olmalı
for i in 1 2 3 4 5; do curl -s https://<ad>.fly.dev/saglik | grep -o '"makine":"[^"]*"'; done
```

Farklı kimlikler dönüyorsa birden fazla makine çalışıyor demektir ve
çevrimiçi maç aralıklı olarak "oda yok" verecektir.

### Oyunu röleye bağlamak

Adres yapı sırasında gömülüyor:

```bash
VITE_RELE_URL=wss://<benzersiz-ad>.fly.dev npm run build
```

Vercel'de bunu proje ayarlarından **Environment Variables** altına
`VITE_RELE_URL` olarak ekleyip yeniden dağıtmak gerekiyor. Değişken
tanımlı değilse menüde **ÇEVRİMİÇİ** seçeneği hiç görünmez —
çalışmayan bir düğme, basılana kadar süren bir yalandır.

`ws://` değil `wss://` olmalı: oyun `https://` üzerinden servis
ediliyor ve tarayıcı şifresiz WebSocket'e izin vermez. `fly.toml`
zaten `force_https = true` diyor.

### Uyuyan makine

`fly.toml` boştaki makineyi durduruyor (`auto_stop_machines = 'stop'`,
`min_machines_running = 0`). Maç sürerken bağlantılar açık olduğu için
makine durmaz; yalnızca kimse oynamıyorken duruyor ve ilk bağlantı
uyanmayı bekliyor. Oyuncuya bu, lobideki "BAĞLANIYOR…" yazısının
birkaç saniye durması olarak görünür.

Hep sıcak kalsın istersen:

```toml
min_machines_running = 1
```

Bu makineyi sürekli çalışır tutar; ücretlendirme de ona göre olur.
Ara çözüm: `/saglik` ucunu dışarıdan (örneğin bir cron servisi)
dakikada bir çağırmak.

### Dağıtım sırasında devam eden maçlar

`fly deploy` eski makineyi kapatır. Sunucu SIGTERM'i yakalayıp
soketleri kapatıyor, yani devam eden maçlar donmak yerine "BAĞLANTI
KOPTU" katmanını görüyor. Kötü haber, ama sessiz donmadan iyi.
Konteynerde süreç PID 1 olduğu için bu sinyalin varsayılan davranışı
yok — hem `index.js` içindeki dinleyici hem Dockerfile'daki `tini`
bunun için.

### Günlükler

```bash
fly logs
```

## Protokol

Sunucu artık oyun protokolünü **biliyor** — maçı o koşturduğu için
kaçınılmaz. Tanımadığı mesajlar hâlâ karşı tarafa ham hâliyle aktarılır.

| Yön | Mesaj | Anlam |
|---|---|---|
| → | `{t:'kimlik', id?, gizli?, ad}` | Kimlik al / doğrula |
| → | `{t:'hizli-esles'}` | Eşleşme sırasına gir |
| → | `{t:'siradan-cik'}` | Sıradan çık |
| → | `{t:'siralama'}` | Skor tablosunu iste |
| → | `{t:'oda-ac'}` | Yeni oda aç |
| → | `{t:'oda-gir', kod}` | Odaya katıl |
| → | `{t:'mac-basla', cfg}` | Maçı başlat (yalnız odayı açan) |
| → | `{t:'girdi', k, b, z}` | Tuş durumu — kendi yuvana yazılır; `z` istemci saati |
| → | `{t:'ayril'}` | Odadan çık |
| ← | `{t:'kimlik', id, gizli?, ad, ben, sira}` | Kimlik; `gizli` yalnız ilk açılışta |
| ← | `{t:'siralama', liste, ben, sira}` | Skor tablosu |
| ← | `{t:'puan', ben, sira, degisim}` | Maç sonrası kendi yeni durumun |
| ← | `{t:'sirada', sira}` | Sıraya girildi |
| ← | `{t:'rakip-yok'}` | Uzun bekleme; sıradan ATILMADIN |
| ← | `{t:'sira-bitti'}` | Sıradan çıkıldı |
| ← | `{t:'oda', kod, rol}` | Oda kuruldu / katılındı |
| ← | `{t:'eslesme', rol}` | İki taraf da hazır |
| ← | `{t:'mac', cfg, yuva, rakip}` | Maç kuruldu; `yuva` seni, `rakip` karşındakini söyler |
| ← | `{t:'durum', ...}` | Anlık görüntü (30 Hz); `az`/`ay` girdi onayı |
| ← | `{t:'bitis', sonuc}` | Maç bitti |
| ← | `{t:'ayrildi', kapandi}` | Karşı taraf gitti |
| ← | `{t:'hata', sebep}` | İstek reddedildi |
| ↔ | diğer her şey | Karşı tarafa aktarılır |

Yuva dağıtımı arkadaş maçında sabit: odayı **açan** Türkiye'yi (`p1`),
**katılan** rakip takımı (`p2`) sürer. Hızlı eşleşmede **yazı-tura**:
iki yabancının ikisi de Türkiye'yi oynamak ister ve tercih soracak bir
"ev sahibi" yoktur. Paket biçimi `src/game/snapshot.js` içinde.

## Kimlik ve skor tablosu

Kimliği **sunucu** veriyor. İlk `kimlik` mesajında bir kimlik numarası
ve bir **gizli anahtar** üretiliyor; anahtarı bilen kişi o kimliğin
sahibi sayılıyor. Anahtar düz saklanmıyor, SHA-256 özeti tutuluyor —
veri dosyası sızsa bile jetonlar kullanılamaz.

Bu hesap **değil**: şifre, e-posta, doğrulama yok ve kimseden kişisel
veri toplanmıyor. Bedeli açık — anahtar kopyalanırsa kimlik de
kopyalanır, tarayıcı verisi silinirse geçmiş kaybolur ve "şifremi
unuttum" diye bir şey yok. Karşılığı: oyuna girmek için form doldurmak
gerekmiyor.

İlk sürümde kimliği istemci üretiyordu. Skor tablosu yokken zararsızdı;
tablo gelince aynı tasarım "başkasının kimliğini yaz, puanını al"
demeye dönüştü. Anahtar tutmayan eski kimlikler **reddedilmiyor**,
sessizce yenisi veriliyor — reddetmek oyuncuya "çevrimiçi bozuldu"
gibi görünürdü.

**Sonucu istemci bildirmiyor.** Maçı sunucu koşturuyor ve kazananı
kendi simülasyonundan biliyor; uydurulabilecek bir "sonuç bildir"
mesajı yok. Adım 1'deki "sunucu hakem" kararının doğrudan getirisi bu.

Sıralama **Elo** puanına göre (`puan.js`), galibiyet sayısına göre
değil: galibiyet sayısı beceriyi değil boş zamanı ölçüyor. Tabloya
yalnız **hızlı eşleşme** maçları yazılıyor — arkadaş maçında ayarları
odayı açan seçiyor (kadro, zorluk, format) ve tablo ayarlanabilir
olurdu.

### Veri nerede duruyor

`VERI_DIZINI` (varsayılan `./veri`) altında `oyuncular.jsonl` —
ekleme günlüğü. SQLite değil, gerekçesi `depo.js` başında yazılı.

**Kalıcı birim şart.** Konteyner her dağıtımda yeniden kuruluyor;
`docker-compose.yml`'deki birim olmadan tablo her `up --build` ile
sıfırlanırdı. Fly'da `[[mounts]]` aynı işi yapıyor ve birimi bir kez
elle oluşturmak gerekiyor:

```bash
fly volumes create filenin_veri --size 1 --region fra
```

Yedek (kendi sunucunda):

```bash
docker compose cp rele:/veri/oyuncular.jsonl ./yedek.jsonl
```

## Kapasite — ölçülmüş

`node --expose-gc tests/olcum/kapasite.mjs` (4 çekirdekli makine):

| maç | tik p95 | sim hızı | CPU | KB/sn | RSS |
|---|---|---|---|---|---|
| 1 | 0 ms | 0.996 | %2 | 11.5 | 56 MB |
| 64 | 0 ms | 0.997 | %14 | 743 | 64 MB |
| 128 | 0 ms | 0.997 | %14 | 1484 | 72 MB |
| 256 | 0 ms | 0.997 | %17 | 2981 | 88 MB |

**Darboğaz işlemci değil.** 256 eşzamanlı maç (512 oyuncu) tek
çekirdeğin %17'si ve 88 MB. Simülasyon ralli fazında update başına
~3.6 µs; sunucu hakem mimarisi bu kutuda pahalı değil.

Asıl sınır **bant genişliği**: maç başına ~11.6 KB/sn (her anlık
görüntü İKİ sokete birden yazılıyor). Bu da şu demek:

| maç | trafik |
|---|---|
| 128 | 1.5 MB/sn · 11 Mbit/sn |
| 256 | 2.9 MB/sn · 23 Mbit/sn |
| 500 (üst sınır) | 5.7 MB/sn · 45 Mbit/sn |

Bellek tarafında 500 oda ≈ 119 MB, yani 256 MB'lık konteyner
sınırının altında — iki sayı birbirine bağlı, birini değiştirirsen
ötekine bak (`oda.js`, `docker-compose.yml`).

**Ölçümün sınırı:** gerçek soket yok. Paketler JSON'a çevriliyor
(gerçek maliyet) ve iki istemciye yazılmış gibi sayılıyor, ama sokete
gerçekten yazılmıyor; TLS, TCP ve `ws` çerçeveleme bunun üstüne
biniyor. Sayılar ALT SINIR.

**Bu ölçüm iki kez yanlış sonuç verdi ve ikisi de düzeltildi:**

1. Maçlar SERVİS fazında takılıyordu. Servis ucuz olduğu için
   "32 maçta CPU %4" gibi iyimser bir tablo çıkıyordu. Maçlar rallide
   tutulunca gerçek sayılar ortaya çıktı — ve sonuç da değişti:
   darboğaz işlemci değil, bant genişliğiymiş.
2. Her anlık görüntü BİR kez sayılıyordu. `Mac.yolla` odaya bir kez
   çağrılıyor ama röle onu iki sokete birden yazıyor; telde geçen
   trafik ölçülenin iki katıymış. Bu düzeltilmeden önce bu belgede
   "500 oda ≈ 23 Mbit/sn" yazıyordu, doğrusu 45.

## Koruma ve yedek

**Kaynak sınırları** (`docker-compose.yml`): 256 MB bellek, 1.0 CPU.
Bu makinede başka üretim servisleri var; sınırlar oyunu kısıtlamak
için değil, rölede bir arıza olduğunda komşuları korumak için.
Sayılar yukarıdaki ölçümden geliyor, tahminden değil.

**Günlük dönüşümü**: Docker'ın varsayılan json-file sürücüsü sınırsız
büyüyor ve diski doldurup makinedeki her şeyi durdurabiliyor.
3 × 10 MB ile sınırlandı.

**IP başına bağlantı sınırı**: 20 (`IP_SINIRI` ile değiştirilebilir).
Var olan hız sınırı soket başına mesaj sayıyor — bir soketin çok
konuşmasını engelliyor ama bin soket açılmasını engellemiyordu.
CGNAT arkasında yüzlerce kişi aynı IP'yi paylaşabildiği için sayı
cömert tutuldu.

**Yedek**:

```bash
./yedekle.sh                 # ./yedekler/ altına, son 30 kopya
./geri-yukle.sh ./yedekler/oyuncular-20260904-041700.jsonl
```

Günlük otomatik yedek (`crontab -e`):

```
17 4 * * * cd /root/fileninsultanlar-/sunucu && ./yedekle.sh >> /var/log/filenin-yedek.log 2>&1
```

Geri yükleme betiği röleyi durdurup başlatıyor: çalışırken dosyanın
üstüne yazmak, sunucunun bellekteki hâliyle yarışmak demek. Yedeği bir
kez **gerçekten geri yükleyip deneyin** — denenmemiş bir yedek, yedek
değildir.

## İzleme

Dışarıdan `/saglik` çağırmak yeterli; JSON şu alanları veriyor:

| Alan | Anlamı |
|---|---|
| `durum` | `"ayakta"` |
| `oda` / `sira` / `istemci` | Anlık yük |
| `oyuncu` | Kayıtlı oyuncu sayısı |
| `kalici` | Veri dizinine yazılabiliyor mu |
| `birim` | Kalıcı birim bağlı mı |
| `makine` | Süreç kimliği (tek makine olduğunu doğrulamak için) |

Ücretsiz bir uptime servisine (UptimeRobot vb.)
`https://<adresin>/saglik` verilebilir. `kalici` ya da `birim` alanı
`false` dönüyorsa maçlar oynanır ama skor tablosu kalıcı değildir.

## Sınırlar

- Tek mesaj en fazla 16 KB (`maxPayload`).
- Saniyede 150 mesaj; aşan bağlantı kapatılır. Normal akış ~80
  (sunucu 20 durum, istemci tuş değiştikçe + saniyede 20 saat damgası).
  Damga, girdi değişmese de gidiyor: tahmin penceresi onun tazeliğine
  bağlı, durursa istemci kendini gitgide daha ileri sürerdi.
- Aynı anda 500 oda, sırada 500 kişi.
- **Kendi kendiyle eşleşme engellenmiyor**, ama artık PUANA
  YAZILMIYOR: `depo.sonucIsle` iki taraf aynı kimlikse sonucu atıyor.
  Eşleşmenin kendisi serbest kalmaya devam ediyor, çünkü engellemek
  aynı kimliğin iki gerçek cihazda bulunduğu durumda o iki kişiyi
  *hiç* eşleştirmezdi ve sebebi görünmezdi — sessiz bir arıza,
  görünür bir zarardan kötü.
- **İki ayrı kimlikle çiftçilik hâlâ mümkün.** İki tarayıcı profili
  açıp birbirine karşı oynayan biri puan biriktirebilir. Bunun bedeli
  gerçek zaman (maçı oynamak gerekiyor) ve şu an daha ileri gitmenin
  yolu gerçek hesap açmaktan geçiyor. Ödüle bağlanmadıkça bu takas
  doğru.
- **Bütün oyuncu kayıtları bellekte.** Binlerce oyuncu birkaç MB; yüz
  binlerde bu depolama yolu bırakılmalı (bkz. `depo.js`).
- 30 saniyede bir ping/pong; yanıtsız soket düşürülür. Mobilde ağ
  değişince soket "açık" görünüp hiçbir şey taşımayabiliyor; bu
  olmadan oda sonsuza kadar dolu kalır ve kimse o koda katılamaz.
- Kimse katılmazsa oda 15 dakikada süpürülür.

## Testler

`npm test` (depo kökünde) sunucu testlerini de koşturur:

- `oda.test.js` — eşleşme mantığı, soketsiz.
- `rele.test.js` — gerçek WebSocket'lerle tel üzerindeki davranış.
- `sira.test.js` — eşleşme sırası. Tek eşleşmeye bakan testler iki
  sessiz arızayı kaçırıyor (biri iki maça birden girer, biri sırada
  unutulur), o yüzden 200 istemcilik bir koşum da var.
- `depo.test.js` — kalıcılık. İddiaların çoğu "çökme olsa bile veri
  durur" türünden; testler onları gerçekten kırmaya çalışıyor (dosya
  yarım bırakılıyor, günlük elle bozuluyor, depo sıfırdan açılıyor).
- `puan.test.js` — Elo. Testler mutasyonla doğrulandı ve biri adının
  vaat ettiğini ölçmüyor; hangisinin neyi yakaladığı dosya başında
  yazılı.
- `src/game/tahmin.test.js` — tahmin, uzlaştırma ve düzeltmenin
  yedirilmesi. Testlerin bir kısmı tahmin KAPALIYKEN de geçiyor; onlar
  ölçüm aracının kendisini doğruluyor.

Uçtan uca sınama iki dosyada, çünkü iki ayrı yol var:

- `npm run e2e online` — oda koduyla buluşan iki arkadaş.
- `npm run e2e eslesme` — birbirini tanımayan iki yabancı: sıra, takma
  adın karşıya ulaşması, ve rakip yokken yapay zekâ teklifi.
- `npm run e2e tablo` — skor tablosu: kimliği sunucunun vermesi, maç
  sonucunun tabloya yazılması, ve röle yeniden başlatıldığında
  verinin durması.
