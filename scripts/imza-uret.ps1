# Yayin imza anahtarini uretir - WINDOWS (PowerShell) surumu.
#
# `imza-uret.sh` ile ayni isi yapar; Windows'ta bash olmadigi icin ayri
# duruyor. Hangisini kullandigin fark etmez, cikti ayni.
#
# BU BETIK SUNUCUDA CALISTIRILMAZ. Imza anahtarinin roleyle, Docker'la,
# prod ile hicbir ilgisi yok: o dosya UYGULAMANIN KIMLIGI. Internete
# acik bir makinede durmasinin hicbir faydasi, birkac riski var.
#
# Kullanim (PowerShell):
#   .\scripts\imza-uret.ps1
#   .\scripts\imza-uret.ps1 -Dizin "D:\yedek\filenin-imza"
#
# Gereken tek sey: bir JDK (keytool onunla geliyor). Yoksa
# https://adoptium.net adresinden Temurin 17 kurulabilir.

param(
  [string]$Dizin = "$env:USERPROFILE\filenin-imza",
  [string]$Alias = 'sultanlar'
)

$ErrorActionPreference = 'Stop'

$jks = Join-Path $Dizin "$Alias.jks"
$b64 = Join-Path $Dizin "$Alias.b64"

Write-Host ''
Write-Host 'Retro Voleybol - yayin imza anahtari' -ForegroundColor White
Write-Host ''

if (Test-Path $jks) {
  Write-Host "DUR: $jks zaten var." -ForegroundColor Red
  Write-Host ''
  Write-Host 'Ustune yazmiyorum. Play Store''a bir kez yukleme yaptiysan bu'
  Write-Host 'dosya uygulamanin TEK anahtari; yenisiyle degistirirsen'
  Write-Host 'uygulamayi bir daha guncelleyemezsin.'
  exit 1
}

# -- keytool nerede --------------------------------------------------
# PATH'te olmasi en olasi hal; degilse yaygin kurulum yerlerine
# bakiliyor. Android Studio da kendi JDK'sini (jbr) getiriyor, o da
# araniyor - ayrica JDK kurmaya gerek kalmasin diye.
$keytool = $null
$komut = Get-Command keytool -ErrorAction SilentlyContinue
if ($komut) {
  $keytool = $komut.Source
} else {
  $adaylar = @(
    "$env:ProgramFiles\Eclipse Adoptium\*\bin\keytool.exe",
    "$env:ProgramFiles\Java\*\bin\keytool.exe",
    "$env:ProgramFiles\Microsoft\jdk*\bin\keytool.exe",
    "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe",
    "$env:LOCALAPPDATA\Programs\Android Studio\jbr\bin\keytool.exe"
  )
  foreach ($a in $adaylar) {
    $bulunan = Get-ChildItem -Path $a -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bulunan) { $keytool = $bulunan.FullName; break }
  }
}

if (-not $keytool) {
  Write-Host 'keytool bulunamadi.' -ForegroundColor Red
  Write-Host ''
  Write-Host 'keytool bir JDK ile geliyor. Kur:  https://adoptium.net'
  Write-Host '(Temurin 17, Windows x64, .msi). Kurulumdan sonra bu'
  Write-Host 'betigi yeni bir PowerShell penceresinde tekrar calistir.'
  exit 1
}
Write-Host "keytool: $keytool"

New-Item -ItemType Directory -Force -Path $Dizin | Out-Null

Write-Host @'

keytool simdi sirayla sunlari soracak:

  1. Enter keystore password  -> YENI bir parola belirle
  2. Re-enter new password    -> ayni parolayi tekrar
  3. What is your first and last name?  -> adin (ya da Retro Voleybol)
  4. organizational unit / organization / City / State / Country
     -> hepsi BOS birakilabilir, Enter'a basip gec
  5. Is CN=... correct?       -> "yes" yaz (sadece "y" yetmiyor)
  6. key password (RETURN if same as keystore password)
     -> Enter'a bas, ayni parola kullanilsin.

     BU ADIM CIKMAYABILIR ve cikmamasi normal: JDK 9'dan beri
     varsayilan depo bicimi PKCS12 ve orada ayri bir anahtar parolasi
     yok. Sormadiysa anahtar parolasi = depo parolasidir; GitHub'da
     KEY_PASSWORD alanina da ayni parolayi yaz.

PAROLA KURALI: icinde ters bolu (\) OLMASIN.
Parola Java'nin Properties biciminde saklaniyor ve orada "\" kacis
karakteri; sessizce yutuluyor ve sonuc anlasilmaz bir "yanlis parola"
hatasi oluyor. Harf, rakam ve . - _ ! # guvenli.

Parolayi SIMDI parola yoneticine kaydet.

'@

Read-Host 'Hazirsan Enter''a bas (vazgecmek icin Ctrl+C)' | Out-Null

# `-validity 10000` (~27 yil) kasitli: anahtarin suresi dolarsa
# uygulamayi bir daha guncelleyemezsin.
& $keytool -genkeypair -v `
  -keystore $jks `
  -alias $Alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000

if (-not (Test-Path $jks)) {
  Write-Host 'Anahtar uretilemedi.' -ForegroundColor Red
  exit 1
}

# -- base64 ----------------------------------------------------------
# Dosya dogrudan GitHub secret'i olamiyor; secret metin aliyor.
$baytlar = [System.IO.File]::ReadAllBytes($jks)
[System.IO.File]::WriteAllText($b64, [System.Convert]::ToBase64String($baytlar))

# DOGRULAMA: geri cozulunce bayt bayta ayni mi?
# Kontrol edilmezse bozuk bir metin GitHub'a girer ve hata ancak CI'da
# "keystore was tampered with" diye gorunur.
$geri = [System.Convert]::FromBase64String([System.IO.File]::ReadAllText($b64))
$ayni = $geri.Length -eq $baytlar.Length
if ($ayni) {
  for ($i = 0; $i -lt $baytlar.Length; $i++) {
    if ($geri[$i] -ne $baytlar[$i]) { $ayni = $false; break }
  }
}
if (-not $ayni) {
  Write-Host 'base64 bozuk. Betigi tekrar calistir.' -ForegroundColor Red
  exit 1
}
Write-Host 'OK - base64 dogrulandi - geri cozuldugunde bayt bayta ayni' -ForegroundColor Green

try {
  Get-Content $b64 -Raw | Set-Clipboard
  $panoNotu = 'Metin PANOYA kopyalandi - dogrudan yapistirabilirsin.'
} catch {
  $panoNotu = "Panoya kopyalanamadi; dosyayi acip hepsini sec-kopyala: $b64"
}

Write-Host ''
Write-Host 'Anahtar hazir.' -ForegroundColor Green
Write-Host ''
Write-Host "  Anahtar dosyasi : $jks"
Write-Host "  Secret metni    : $b64"
Write-Host ''
Write-Host 'SIMDI SIRASIYLA:' -ForegroundColor White
Write-Host @"

1) $jks dosyasini YEDEKLE.
   Kaybedersen uygulamayi bir daha guncelleyemezsin. En az iki yer:
   parola yoneticisi (ek dosya olarak) ve sifreli bir harici yedek.

2) GitHub -> depo -> Settings -> Secrets and variables -> Actions

   "Secrets" sekmesi, "New repository secret" ile DORT tane:
     KEYSTORE_BASE64     -> $b64 dosyasinin icerigi
     KEYSTORE_PASSWORD   -> belirledigin parola
     KEY_ALIAS           -> $Alias
     KEY_PASSWORD        -> ayni parola

   "Variables" sekmesi, "New repository variable" ile BIR tane:
     VITE_RELE_URL       -> wss://rele.retrovoleybol.online

   $panoNotu

3) Yapistirdiktan sonra base64 dosyasini sil (anahtari DEGIL):
     Remove-Item "$b64"

4) GitHub -> Actions -> "android aab" -> Run workflow

"@
