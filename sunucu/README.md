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

**Kalan eksik:** tahmin yalnız oyuncunun kendisine uygulanıyor. Top ve
rakip hâlâ anlık görüntüden ara değerleniyor, yani ekranda oyuncu
"şimdi"yi, top ise yarım gidiş-dönüş öncesini gösteriyor. 100 ms'lik
bir bağlantıda bu, topla oyuncu arasında birkaç on piksellik bir zaman
farkı demek. Topu da ileri sarmak mümkün (`ballstep.js` bunun için ayrı
duruyor) ama top yalnız serbest uçarken tahmin edilebilir — vuruş anında
tahmin yanılır ve topu zıplatır. Ölçmeden yapılacak bir iş değil.

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

Bu değişken tanımlı değilse menüde **ÇEVRİMİÇİ** seçeneği hiç
görünmez — çalışmayan bir düğme, basılana kadar süren bir yalandır.

Geliştirmede `?rele=ws://localhost:8787` sorgu parametresiyle de
ezilebilir. Üretim yapısında bu parametre okunmaz: paylaşılan bir
bağlantının oyuncuyu yabancı bir sunucuya bağlaması istenmiyor.

## Dağıtım — Hetzner (kendi sunucun)

Kendi sunucunda mevcut bir ters vekil (nginx veya Caddy) zaten
80/443'ü kullanıyorsa bu yol en azdan-çoğa gider: röle dışarıya hiç
açılmaz, yalnızca `127.0.0.1:8787`'de dinler; mevcut ters vekil onun
önünde durup TLS'i (`wss://`) karşılar. Domain yerine ücretsiz
**nip.io** ya da **sslip.io** kullanılabilir — ikisi de aynı işi
görüyor: DNS kaydı gerektirmeden adın içindeki IP'ye çözülüyorlar.

Aşağıdaki adımlar **senin gerçek sunucunun IP'sine göre** yazıldı.
Bu sunucuda Caddy zaten başka bir servis için `panel-<ip>.sslip.io`
kalıbını kullandığından (bkz. Caddyfile), röle için de sslip.io ve
aynı `<isim>-<ip>` kalıbı seçildi:

```
Sunucu IP'si:  178.104.2.249
Röle adresi:   rele-178-104-2-249.sslip.io
```

(Bu ikisi eşleşiyor — sslip.io, adın içindeki tireli sayıları noktaya
çevirip o IP'ye yönlendiriyor. Sunucunun IP'si değişirse — örn. yeni
bir Hetzner sunucusuna taşınırsan — bu adres de değişir, aşağıdaki
her komutta yeniden hesaplaman gerekir.)

Tüm komutlar **kendi sunucunda**, SSH ile bağlanıp çalıştırılır.

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
sudo sed -i 's/RELE_DOMAIN/rele-178-104-2-249.sslip.io/' /etc/nginx/sites-available/filenin-rele
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
rele-178-104-2-249.sslip.io {
    reverse_proxy filenin-rele:8787
}
```

Sonra Caddy'yi yeniden başlatmadan ayarı uygula:

```bash
docker exec <caddy-konteyner-adı> caddy reload --config /etc/caddy/Caddyfile
```

Caddy ilk istekte bu domain için otomatik Let's Encrypt sertifikası
alır — certbot'a hiç gerek yok. Ardından doğrudan **4) Sınama**'ya geç.

**3) TLS sertifikası al** (yalnız 2a — nginx yolunu izlediysen;
certbot kuruluysa, değilse önce `sudo apt install certbot python3-certbot-nginx`):

```bash
sudo certbot --nginx -d rele-178-104-2-249.sslip.io
```

Certbot 443 bloğunu ve http→https yönlendirmesini otomatik ekler.
E-posta/onay soracak, mail adresini gir ve kabul et.

**4) Sınama:**

```bash
curl https://rele-178-104-2-249.sslip.io/saglik
```

Aynı `{"durum":"ayakta",...}` cevabını, bu sefer `https://` üstünden
görmelisin.

**5) Oyunu bu adrese bağla** — Vercel'de:

- Projene gir → **Settings** → **Environment Variables**.
- **Key:** `VITE_RELE_URL`, **Value:** `wss://rele-178-104-2-249.sslip.io`,
  **Environment:** Production. Kaydet.
- **Deployments** sekmesinden en üstteki yayının **⋯** → **Redeploy**.
  Değişken ancak yeni bir yayında etki eder.

Yeniden yayın bitince ana menüde **ÇEVRİMİÇİ** düğmesi görünür.

### Güncelleme

Kod değiştiğinde sunucuda (zaten `sunucu/` dizinindeysen `cd`'yi atla):

```bash
cd fileninsultanlar-/sunucu
git pull
docker compose up -d --build
```

Doğrulama:

```bash
# Konteyner hemen açılmıyor; birkaç saniye ver
sleep 3 && curl http://127.0.0.1:8787/saglik
```

Beklenen:

```json
{"durum":"ayakta","oda":0,"sira":0,"oyuncu":0,"kalici":true,"birim":true,...}
```

Üç şeye bak:

| Belirti | Anlamı |
|---|---|
| `curl: (56) Recv failure` | Konteyner henüz açılmamış (docker-proxy bağlantıyı kabul edip sıfırlıyor) ya da süreç çökmüş. Birkaç saniye sonra tekrar dene; hâlâ öyleyse `docker compose logs --tail 40`. |
| `oyuncu`/`kalici` alanları yok | Eski imaj hâlâ ayakta — yapı başarısız olmuş. `docker compose logs --tail 40`. |
| `"kalici": false` | Veri dizinine yazılamıyor. Maçlar oynanır, tablo yeniden başlatmada sıfırlanır. |
| `"birim": false` | **Kalıcı birim bağlanmamış.** Tablo her `up --build` ile gider. |

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

### nip.io/sslip.io yerine gerçek domain

İleride bir domain alırsan tek fark 1. ve 3-4. adımlar: nip.io/sslip.io
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
| ← | `{t:'durum', ...}` | Anlık görüntü (~20 Hz); `az`/`ay` girdi onayı |
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
