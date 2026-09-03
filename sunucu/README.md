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

## Dağıtım — Fly.io

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
