package app.retrovoleybol.oyun;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Kenar boşluğu / çentik.
 *
 * Play, Android 15'ten itibaren kenardan kenara (edge-to-edge)
 * dayatıyor ve şu eski API'leri işaretliyor: setStatusBarColor,
 * setNavigationBarColor, LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES.
 * Yerine `EdgeToEdge.enable` — çubuklar şeffaf, içerik kesikten
 * geçer, arayüz CSS `env(safe-area-inset-*)` ile içeri alınır.
 *
 * super.onCreate'den ÖNCE çağrılır: Capacitor orada setContentView
 * yapıyor, sonra çağrılırsa insets kaçardı.
 */
public class MainActivity extends BridgeActivity {
  private static final int ZEMIN = Color.parseColor("#0B0B12");

  @Override
  public void onCreate(Bundle savedInstanceState) {
    EdgeToEdge.enable(
        this,
        SystemBarStyle.dark(ZEMIN),
        SystemBarStyle.dark(ZEMIN)
    );
    super.onCreate(savedInstanceState);
    WindowInsetsControllerCompat insets =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (insets != null) {
      insets.setAppearanceLightStatusBars(false);
      insets.setAppearanceLightNavigationBars(false);
    }
  }
}
