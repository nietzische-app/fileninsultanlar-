#!/bin/sh
# Skor tablosunun yedeği.
#
# Neden gerekli: veri tek bir Docker biriminde, tek bir makinede.
# Birim silinirse ya da makine giderse bütün oyuncu geçmişi yok olur —
# ve dosya küçük olduğu için yedeklemenin bedeli neredeyse sıfır.
#
# Kullanım (sunucu/ dizininden):
#   ./yedekle.sh                  # ./yedekler/ altına
#   ./yedekle.sh /mnt/yedek       # başka bir yere
#
# Günlük otomatik yedek (crontab -e):
#   17 4 * * * cd /root/fileninsultanlar-/sunucu && ./yedekle.sh >> /var/log/filenin-yedek.log 2>&1
#
# Dakika/saat kasten 04:17 gibi "yuvarlak olmayan" bir an: sunucudaki
# her iş 04:00'te başlarsa hepsi aynı anda diske biner.

set -eu

HEDEF="${1:-./yedekler}"
DAMGA="$(date +%Y%m%d-%H%M%S)"
# Kaç yedek saklanacak. 30 günlük geçmiş yeter: bu dosya birkaç yüz KB.
SAKLA="${SAKLA:-30}"

mkdir -p "$HEDEF"

# Konteynerin İÇİNDEN kopyalıyoruz, birimi doğrudan okumak yerine:
# birimin ana makinedeki gerçek yolu Docker'ın iç düzenine bağlı ve
# sürümle değişebiliyor. `compose cp` hangi birim olduğunu zaten biliyor.
if ! docker compose cp rele:/veri/oyuncular.jsonl "$HEDEF/oyuncular-$DAMGA.jsonl" 2>/dev/null; then
  # Dosya yoksa hata değil: henüz kimse çevrimiçi maç oynamamış demektir.
  echo "$(date -Iseconds) veri dosyası yok — henüz maç oynanmamış olabilir"
  exit 0
fi

SATIR="$(wc -l < "$HEDEF/oyuncular-$DAMGA.jsonl")"

# Boş dosyayı yedek saymayalım: sessizce boş bir yedek almak,
# yedek almamaktan daha kötü — var sanırsın.
if [ "$SATIR" -eq 0 ]; then
  rm -f "$HEDEF/oyuncular-$DAMGA.jsonl"
  echo "$(date -Iseconds) veri dosyası BOŞ — yedek alınmadı"
  exit 0
fi

echo "$(date -Iseconds) yedek alındı: $HEDEF/oyuncular-$DAMGA.jsonl ($SATIR kayıt)"

# Eskileri temizle — yoksa yedek dizini diski dolduran şey olur
ls -1t "$HEDEF"/oyuncular-*.jsonl 2>/dev/null | tail -n "+$((SAKLA + 1))" | while read -r eski; do
  rm -f "$eski"
  echo "$(date -Iseconds) eski yedek silindi: $eski"
done
