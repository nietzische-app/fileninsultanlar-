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

Kod değiştiğinde sunucuda:

```bash
cd fileninsultanlar-/sunucu
git pull
docker compose up -d --build
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
| → | `{t:'oda-ac'}` | Yeni oda aç |
| → | `{t:'oda-gir', kod}` | Odaya katıl |
| → | `{t:'mac-basla', cfg}` | Maçı başlat (yalnız odayı açan) |
| → | `{t:'girdi', k, b, z}` | Tuş durumu — kendi yuvana yazılır; `z` istemci saati |
| → | `{t:'ayril'}` | Odadan çık |
| ← | `{t:'oda', kod, rol}` | Oda kuruldu / katılındı |
| ← | `{t:'eslesme', rol}` | İki taraf da hazır |
| ← | `{t:'mac', cfg, yuva}` | Maç kuruldu; `yuva` seni söyler ('p1'/'p2') |
| ← | `{t:'durum', ...}` | Anlık görüntü (~20 Hz); `az`/`ay` girdi onayı |
| ← | `{t:'bitis', sonuc}` | Maç bitti |
| ← | `{t:'ayrildi', kapandi}` | Karşı taraf gitti |
| ← | `{t:'hata', sebep}` | İstek reddedildi |
| ↔ | diğer her şey | Karşı tarafa aktarılır |

Yuva dağıtımı: odayı **açan** Türkiye'yi (`p1`), **katılan** rakip takımı
(`p2`) sürer. Paket biçimi `src/game/snapshot.js` içinde.

## Sınırlar

- Tek mesaj en fazla 16 KB (`maxPayload`).
- Saniyede 150 mesaj; aşan bağlantı kapatılır. Normal akış ~80
  (sunucu 20 durum, istemci tuş değiştikçe + saniyede 20 saat damgası).
  Damga, girdi değişmese de gidiyor: tahmin penceresi onun tazeliğine
  bağlı, durursa istemci kendini gitgide daha ileri sürerdi.
- Aynı anda 500 oda.
- 30 saniyede bir ping/pong; yanıtsız soket düşürülür. Mobilde ağ
  değişince soket "açık" görünüp hiçbir şey taşımayabiliyor; bu
  olmadan oda sonsuza kadar dolu kalır ve kimse o koda katılamaz.
- Kimse katılmazsa oda 15 dakikada süpürülür.

## Testler

`npm test` (depo kökünde) sunucu testlerini de koşturur:

- `oda.test.js` — eşleşme mantığı, soketsiz.
- `rele.test.js` — gerçek WebSocket'lerle tel üzerindeki davranış.
- `src/game/tahmin.test.js` — tahmin, uzlaştırma ve düzeltmenin
  yedirilmesi. Testlerin bir kısmı tahmin KAPALIYKEN de geçiyor; onlar
  ölçüm aracının kendisini doğruluyor.

Uçtan uca sınamayı `npm run e2e online` yapıyor: iki gerçek tarayıcı,
bu sunucunun bir örneği, menüden sahaya kadar tam yol.
