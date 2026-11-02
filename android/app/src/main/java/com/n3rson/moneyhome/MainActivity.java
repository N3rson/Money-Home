package com.n3rson.moneyhome;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // draw behind the status and navigation bars; the web app pads itself with safe-area insets
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
