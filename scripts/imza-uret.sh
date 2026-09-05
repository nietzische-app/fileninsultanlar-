#!/usr/bin/env bash
#
# Yayın imza anahtarını üretir ve GitHub secret'ına yapıştırılacak
# metni hazırlar.
#
# Neden betik: bu iş bir kez yapılıyor, sonra bir daha yapılmıyor —
# yani hata yapmanın en kolay olduğu yer burası ve yanlışı aylar sonra,
# "uygulamayı güncelleyemiyorum" diye öğreniyorsun. Betik üç şeyi
# üstleniyor: doğru keytool çağrısı, parolada ters bölü denetimi ve
# base64'ün bozulmadığının doğrulanması.
#
# Kullanım:
#   bash scripts/imza-uret.sh [cikti-dizini]
#
# Varsayılan çıktı dizini: ~/filenin-imza
# Depo dizinine YAZMIYOR — yanlışlıkla commit edilmesin diye.

set -euo pipefail

DIZIN="${1:-$HOME/filenin-imza}"
AD="sultanlar"
JKS="$DIZIN/$AD.jks"
B64="$DIZIN/$AD.b64"

kirmizi() { printf '\033[31m%s\033[0m\n' "$*"; }
yesil()   { printf '\033[32m%s\033[0m\n' "$*"; }
kalin()   { printf '\033[1m%s\033[0m\n' "$*"; }

echo
kalin "Filenin Sultanları — yayın imza anahtarı"
echo

if [ -e "$JKS" ]; then
  kirmizi "DUR: $JKS zaten var."
  echo
  echo "Üstüne yazmıyorum. Play Store'a bir kez yükleme yaptıysan bu"
  echo "dosya uygulamanın TEK anahtarı; yenisiyle değiştirirsen"
  echo "uygulamayı bir daha güncelleyemezsin."
  echo
  echo "Gerçekten yeni bir anahtar istiyorsan eskisini önce başka bir"
  echo "yere taşı, sonra bu betiği tekrar çalıştır."
  exit 1
fi

mkdir -p "$DIZIN"

# ── keytool nereden gelecek ────────────────────────────────────────
# keytool JDK ile geliyor. Yoksa Docker'la geçici bir JDK kabında
# koşturuyoruz: bu proje zaten Docker kullanıyor, yani makinene kalıcı
# bir JDK kurmadan da anahtarı üretebiliyorsun.
if command -v keytool >/dev/null 2>&1; then
  echo "keytool bulundu: $(command -v keytool)"
  kt() { keytool "$@"; }
elif command -v docker >/dev/null 2>&1; then
  echo "keytool yok — geçici bir Docker JDK kabı kullanılacak."
  kt() {
    docker run --rm -it \
      --user "$(id -u):$(id -g)" \
      -v "$DIZIN:/is" -w /is \
      eclipse-temurin:17-jdk keytool "$@"
  }
  # Kap içinde yol /is; dışarıdaki mutlak yol geçersiz.
  JKS_KT="/is/$AD.jks"
else
  kirmizi "Ne keytool ne Docker var."
  echo "Birini kur: JDK 17 (keytool onunla geliyor) ya da Docker."
  exit 1
fi
JKS_KT="${JKS_KT:-$JKS}"

# ── Ne sorulacak ───────────────────────────────────────────────────
cat <<'ACIKLAMA'

keytool şimdi sırayla şunları soracak:

  1. Enter keystore password    → YENİ bir parola belirle
  2. Re-enter new password      → aynısını tekrar
  3. What is your first and last name?   → adın (ya da "Filenin Sultanlari")
  4. organizational unit / organization / City / State / Country
     → hepsi BOŞ bırakılabilir, Enter'a basıp geç. Bu bilgiler
       sertifikanın içinde durur, mağazada kimseye gösterilmez.
  5. Is CN=... correct?         → "yes" yaz (sadece "y" yetmiyor)
  6. key password (RETURN if same as keystore password)
     → Enter'a bas, aynı parolayı kullansın. İki ayrı parola tutmanın
       bu projede bir faydası yok, karıştırma riski var.

PAROLA KURALI: içinde ters bölü (\) OLMASIN.
Sebebi: parola Java'nın Properties biçiminde yazılıyor ve orada "\"
kaçış karakteri — sessizce yutuluyor. Sonuç, sebebi anlaşılmayan bir
"yanlış parola" hatası olur. Harf, rakam ve . - _ ! # güvenli.

Parolayı ŞİMDİ parola yöneticine kaydet. Bu ekran kapandığında onu
geri getirmenin yolu yok.

ACIKLAMA

read -r -p "Hazırsan Enter'a bas (vazgeçmek için Ctrl+C): " _

# `-validity 10000` (~27 yıl) kasıtlı: anahtarın süresi dolarsa
# uygulamayı bir daha güncelleyemezsin. Google en az 2033'e kadar
# geçerli olmasını istiyor.
kt -genkeypair -v \
  -keystore "$JKS_KT" \
  -alias "$AD" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

if [ ! -s "$JKS" ]; then
  kirmizi "Anahtar üretilemedi — $JKS yok ya da boş."
  exit 1
fi
chmod 600 "$JKS"

# ── base64 ─────────────────────────────────────────────────────────
# Dosya doğrudan GitHub secret'ı olamıyor; secret metin alıyor.
if base64 --help 2>&1 | grep -q -- '-w'; then
  base64 -w0 "$JKS" > "$B64"          # GNU (Linux)
else
  base64 -i "$JKS" | tr -d '\n' > "$B64"  # BSD (macOS)
fi

# DOĞRULAMA: base64 geri çözülünce baytı baytına aynı mı?
# Kontrol edilmezse bozuk bir metni GitHub'a yapıştırırsın ve hatayı
# ancak CI'da "keystore was tampered with" diye görürsün.
GERI="$(mktemp)"
base64 -d < "$B64" > "$GERI"
if cmp -s "$JKS" "$GERI"; then
  yesil "✓ base64 doğrulandı — geri çözüldüğünde bayt bayt aynı"
else
  kirmizi "✗ base64 bozuk. Betiği tekrar çalıştır, sorun sürerse haber ver."
  rm -f "$GERI"
  exit 1
fi
rm -f "$GERI"
chmod 600 "$B64"

# ── Sonuç ──────────────────────────────────────────────────────────
echo
yesil "Anahtar hazır."
echo
echo "  Anahtar dosyası : $JKS"
echo "  Secret metni    : $B64  ($(wc -c < "$B64") karakter)"
echo
kalin "ŞİMDİ SIRASIYLA:"
cat <<SONRAKI

1) $JKS dosyasını YEDEKLE.
   Kaybedersen uygulamayı bir daha güncelleyemezsin — Google yeni
   anahtarla yüklemeyi kabul etmiyor. En az iki yer: parola yöneticisi
   (ek dosya olarak) ve şifreli bir harici yedek.

2) GitHub → depon → Settings → Secrets and variables → Actions

   "New repository secret" ile DÖRT tane (Secrets sekmesi):

     KEYSTORE_BASE64     → $B64 dosyasının İÇERİĞİ (tamamı, tek satır)
     KEYSTORE_PASSWORD   → az önce belirlediğin parola
     KEY_ALIAS           → $AD
     KEY_PASSWORD        → aynı parola (Enter'a basıp aynısını seçtiysen)

   "Variables" sekmesine BİR tane (New repository variable):

     VITE_RELE_URL       → wss://rele-178-104-2-249.sslip.io

   Metni panoya almak için:
     Linux : xclip -sel clip < $B64
     macOS : pbcopy < $B64
     ya da bir metin düzenleyicide açıp hepsini seç-kopyala.

3) Yapıştırdıktan sonra base64 dosyasını sil (anahtarın kendisini DEĞİL):
     rm $B64

4) GitHub → Actions → "android aab" → Run workflow

Bittiğinde koşumun altındaki Artifacts bölümünden .aab iniyor.
SONRAKI
echo
