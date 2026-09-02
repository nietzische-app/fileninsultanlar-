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

**Uyarı:** `oran` içindeki bot mükemmel top takip eder ve mekanik olarak
zıplar; insan gibi oynamaz. Mutlak yüzdeleri değil, aynı botla ölçülen
ÖNCE/SONRA farkını okuyun. Maç kazanma oranı ölçüt olarak kullanılmadı,
çünkü doyuma gidiyor: aynı durumu arka arkaya %50 ve %100 ölçtüm.

Sabitleri çalışma anında değiştirip süpüren yaklaşım da güvenilmez çıktı —
"değişiklik yok" kolu bile şişik sonuç verdi. Bir sabiti sınayacaksanız
dosyayı düzenleyip ölçün, gerekirse `git stash` ile temel çizgiyi doğrulayın.

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

Ekran görüntüleri `tests/ciktilar/` altına yazılır ve depoya girmez.
