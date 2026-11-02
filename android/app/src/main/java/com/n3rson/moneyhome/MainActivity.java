package com.n3rson.moneyhome;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // BridgeActivity switches from the launch theme to AppTheme.NoActionBar and sets the
        // content view. Edge-to-edge must come after that: touching the window earlier builds
        // it with the launch theme, which leaves a title bar on screen.
        super.onCreate(savedInstanceState);
        // draw behind the status and navigation bars; the web app pads itself with safe-area insets
        EdgeToEdge.enable(this);
    }
}
