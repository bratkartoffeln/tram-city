package de.gleisgasse.prototyp;

import android.app.Activity;
import android.graphics.Insets;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.IOException;
import java.util.Scanner;

/** Single activity, bundled local content only, no permissions or JS/native bridge.
 *  Native API floor: Android 11 / API 30. Target: Android 17 / API 37.
 */
public final class MainActivity extends Activity implements View.OnApplyWindowInsetsListener {
    private WebView web;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setBlockNetworkLoads(true);
        settings.setBlockNetworkImage(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setBackgroundColor(0xffe4ebda);
        web.setWebViewClient(new WebViewClient());
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xfff8f6ed);
        root.addView(web, -1, -1);
        root.setOnApplyWindowInsetsListener(this);
        getWindow().setDecorFitsSystemWindows(false);
        setContentView(root);
        root.requestApplyInsets();
        // A synthetic HTTPS origin gives app-private localStorage a stable origin.
        // loadDataWithBaseURL loads the supplied string, not this URL over a network.
        try (Scanner scanner = new Scanner(getAssets().open("index.html"), "UTF-8")) {
            String html = scanner.useDelimiter("\\A").next();
            String origin = "https://appassets.androidplatform.net/";
            web.loadDataWithBaseURL(origin, html, "text/html", null, origin);
        } catch (IOException error) {
            // Standard SDK build error path; asset presence is verified at package build time.
            throw new IllegalStateException("Lokales Spiel-Asset fehlt", error);
        }
        getWindow().setNavigationBarColor(0xfff8f6ed);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    }

    @Override public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
        Insets safe = insets.getInsets(WindowInsets.Type.systemBars()
            | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
        view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
        return WindowInsets.CONSUMED;
    }

    @Override protected void onPause() {
        super.onPause();
        if (web != null) {
            web.evaluateJavascript("if(window.GG)window.GG.suspend();", null);
            web.onPause();
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("if(window.GG)window.GG.resume();", null);
        }
    }
}
