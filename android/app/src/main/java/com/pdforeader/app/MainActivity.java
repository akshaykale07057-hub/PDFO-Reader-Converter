package com.pdforeader.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // Fix for conflicting keyboard/system bar padding creating white space above keyboard
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> {
                try {
                    View parent = (View) getBridge().getWebView().getParent();
                    if (parent != null) {
                        ViewCompat.setOnApplyWindowInsetsListener(parent, (v, insets) -> {
                            v.setPadding(0, 0, 0, 0);
                            return insets;
                        });
                        getBridge().getWebView().requestApplyInsets();
                    }
                } catch (Exception ignored) {}
            });
        }
    }
}

