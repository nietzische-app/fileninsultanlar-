package app.retrovoleybol.oyun;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Kenar boşluğu / çentik.
 *
 * Capacitor şablonu açık temayla geliyordu; WebView altında beyaz
 * pencere, durum çubuğu ve kesik (display cutout) görünüyordu.
 * Sistem pencereleri oyunun zemin rengine boyanır, içerik kesikten
 * geçer, arayüz CSS `env(safe-area-inset-*)` ile içeri alınır.
 */
public class MainActivity extends BridgeActivity {
  private static final int ZEMIN = Color.parseColor("#0B0B12");

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().setStatusBarColor(ZEMIN);
    getWindow().setNavigationBarColor(ZEMIN);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      WindowManager.LayoutParams lp = getWindow().getAttributes();
      lp.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
      getWindow().setAttributes(lp);
    }
    WindowInsetsControllerCompat insets =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (insets != null) {
      insets.setAppearanceLightStatusBars(false);
      insets.setAppearanceLightNavigationBars(false);
    }
  }
}
