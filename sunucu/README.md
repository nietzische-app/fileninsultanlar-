# Röle sunucusu

Çevrimiçi maçların buluşma noktası. Oyunu **simüle etmez**: oda koduyla
iki istemciyi eşleştirir ve aralarındaki mesajları taşır. Maçı odayı
açan taraf koşturur, katılan taraf onun ürettiği durumu çizer.

## Neden röle, neden lockstep değil

Lockstep mimaride sunucu yalnız tuşları taşır, iki makine de simülasyonu
kendi çalıştırır — ve aynı girdiden aynı sonucu üretmek zorundadır.
Bu oyunun simülasyon yolunda 30'dan fazla `Math.random()` çağrısı var
(ai.js 7, Game.js 6, serve.js 8, effects.js 15). Hepsini tohumlu üretece
çevirmek ayrı bir proje; çevirmeden lockstep denenirse iki taraftaki maç
birkaç saniyede birbirinden kopar.

Ev sahibi yetkili (host-authoritative) mimaride rastgelelik tek yerde
çalışıyor, öbür taraf sonucu okuyor. Determinizm gerekmiyor.

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

# 4) Dağıt — --ha=false ŞART, sebebi aşağıda
fly deploy --ha=false

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

Sunucu oyun protokolünü **bilmez**. `oda-*` ve `ayril` dışındaki her
mesaj karşı tarafa ham metin olarak aktarılır; oyun paketleri değişince
sunucuyu yeniden dağıtmak gerekmez.

| Yön | Mesaj | Anlam |
|---|---|---|
| → | `{t:'oda-ac'}` | Yeni oda aç |
| → | `{t:'oda-gir', kod}` | Odaya katıl |
| → | `{t:'ayril'}` | Odadan çık |
| ← | `{t:'oda', kod, rol}` | Oda kuruldu / katılındı |
| ← | `{t:'eslesme', rol}` | İki taraf da hazır |
| ← | `{t:'ayrildi', kapandi}` | Karşı taraf gitti |
| ← | `{t:'hata', sebep}` | İstek reddedildi |
| ↔ | diğer her şey | Karşı tarafa aktarılır |

Oyun paketleri (`durum`, `girdi`, `mac`, `bitis`) `src/game/snapshot.js`
ve `src/screens/OnlineScreen.jsx` içinde tanımlı.

## Sınırlar

- Tek mesaj en fazla 16 KB (`maxPayload`).
- Saniyede 150 mesaj; aşan bağlantı kapatılır. Normal akış ~80
  (ev sahibi 20 durum, misafir tuş değiştikçe).
- Aynı anda 500 oda.
- 30 saniyede bir ping/pong; yanıtsız soket düşürülür. Mobilde ağ
  değişince soket "açık" görünüp hiçbir şey taşımayabiliyor; bu
  olmadan oda sonsuza kadar dolu kalır ve kimse o koda katılamaz.
- Kimse katılmazsa oda 15 dakikada süpürülür.

## Testler

`npm test` (depo kökünde) sunucu testlerini de koşturur:

- `oda.test.js` — eşleşme mantığı, soketsiz.
- `rele.test.js` — gerçek WebSocket'lerle tel üzerindeki davranış.

Uçtan uca sınamayı `npm run e2e online` yapıyor: iki gerçek tarayıcı,
bu sunucunun bir örneği, menüden sahaya kadar tam yol.
