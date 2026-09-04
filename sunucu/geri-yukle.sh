#!/bin/sh
# Yedekten geri yükleme.
#
# Yedek almak yarısı; geri yükleyebildiğini BİLMEK öbür yarısı.
# Denenmemiş bir yedek, yedek değildir.
#
# Kullanım:
#   ./geri-yukle.sh ./yedekler/oyuncular-20260904-041700.jsonl

set -eu

KAYNAK="${1:?kullanım: ./geri-yukle.sh <yedek-dosyası>}"

[ -f "$KAYNAK" ] || { echo "dosya yok: $KAYNAK" >&2; exit 1; }

SATIR="$(wc -l < "$KAYNAK")"
[ "$SATIR" -gt 0 ] || { echo "yedek BOŞ, geri yüklenmiyor: $KAYNAK" >&2; exit 1; }

echo "$KAYNAK içinden $SATIR kayıt geri yüklenecek."
printf 'Mevcut skor tablosunun ÜSTÜNE yazılacak. Sürdür? [e/H] '
read -r cevap
case "$cevap" in e|E) ;; *) echo "vazgeçildi"; exit 0 ;; esac

# Röle çalışırken yazmak yarış demek: sunucu belleğindeki hâli
# üstüne yazabilir. Önce durdur.
docker compose stop rele
docker compose cp "$KAYNAK" rele:/veri/oyuncular.jsonl
docker compose start rele

sleep 3
echo "--- sağlık ---"
curl -s http://127.0.0.1:8787/saglik || echo "(sağlık ucu henüz cevap vermiyor, birkaç saniye sonra bak)"
echo
