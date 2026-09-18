# Retro Voleybol — yayın (R8) kuralları.
#
# Oyun JS; R8 yalnız Capacitor kabuğunu karartır. Capacitor AAR'ı
# consumer keep kurallarını zaten taşıyor (eklenti yansıması). Burada
# yalnızca kabuğun kırılmaması ve Play kilitlenme raporlarının
# okunması için gerekenler var.

# Satır numarası kalsın: karartılmış iz Play'de "a.b.c" olmasın.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Ana aktivite manifestte exported; R8 onu silmez ama Bridge
# yansımayla eklenti sınıflarını yükler — üst sınıfı tut.
-keep class app.retrovoleybol.oyun.MainActivity { *; }
-keep class com.getcapacitor.BridgeActivity { *; }

# WebView / JS köprüsü (Capacitor Bridge @JavascriptInterface kullanır)
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
