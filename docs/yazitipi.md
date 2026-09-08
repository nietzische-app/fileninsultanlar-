# press-start-2p.woff2

Oyunun tek yazı tipi. Projedeki **tek ikili varlık** — piksel
karakterler, top, file ve arka plan kodla çiziliyor, ama bir yazı
tipini kodla üretmek makul değil.

## Nereden geliyor

Kaynak: [google/fonts › ofl/pressstart2p][kaynak] (OFL 1.1, ekte
`LICENSE.txt` yok çünkü lisans metni fontun `name` tablosunda duruyor).
Depoya tam font değil, ALT KÜMESİ giriyor:

```sh
curl -L -o PressStart2P-Regular.ttf \
  https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/PressStart2P-Regular.ttf

pip install fonttools brotli
pyftsubset PressStart2P-Regular.ttf \
  --output-file=public/fonts/press-start-2p.woff2 --flavor=woff2 \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0100-017F,U+0192,U+02C6-02DC,U+03C3,U+2000-206F,U+20AC,U+20BA,U+2122,U+2190-2193,U+2212,U+2215,U+221E,U+2248,U+2260,U+2264-2265,U+25B6,U+2605-2606,U+2665,U+266A" \
  --layout-features="" --no-hinting --desubroutinize --name-IDs="*" \
  --drop-tables+=GSUB,GDEF
```

Aralıklar rastgele değil: Latin + Latin Genişletilmiş-A (Türkçe **ğ ş
İ ı Ğ Ş** buradan geliyor; **ç ö ü Ç Ö Ü** Latin-1'den) ve arayüzde
geçen simgeler (`· … → ← ↑ ↓ ★ ☆ ♥ ♪ ▶ ∞ ≈ ≠ ≤`). Çıkan dosya 6 KB.

Fontta OLMAYAN ve yedek yazı tipine düşen simgeler: `✓ ✔ ✗ ⇄ ≡ ▮ ◎ ♛
♫ ⚙ ⚡ ⛶ ⤡ ⤢ ─ └ ├ ┬ ┴`. Press Start 2P'de karşılıkları yok; olduğu
gibi bırakıldılar çünkü hepsi ikincil süs.

## Neden bu kadar açıklama

Bu dosya bir kez ZATEN yanlış indirildi ve arıza bir ay yaşadı.

Google Fonts'un CSS'i her alt küme için ayrı bir `@font-face` veriyor
ve **kiril** kaydı listede latin'den önce geliyor. Depoya o girmiş:
geçerli bir woff2, tarayıcı sorunsuz yüklüyor,
`document.fonts.status` "loaded" diyor, konsolda hata yok — ama içinde
tek bir Latin harfi yok. Bütün oyun sessizce tarayıcının
monospace'ine düşüyordu; "8 bit piksel voleybol" diyen bir oyunun her
yazısı düz bir daktilo fontuydu.

Bu yüzden bir de test var: `tests/e2e/yazitipi.mjs`. "Font yüklendi
mi" diye bakmıyor — o soru bozuk hâlde de EVET cevabı veriyordu —
harflerin gerçekten bu fonttan çizilip çizilmediğini ölçüyor.

[kaynak]: https://github.com/google/fonts/tree/main/ofl/pressstart2p
