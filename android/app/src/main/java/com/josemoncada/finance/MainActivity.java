package com.josemoncada.finance;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

/**
 * The app's one Android activity.
 *
 * It was the empty three-line class Capacitor generates until 2026-09-17, and
 * it stops being empty for one reason: asking Google for a permission beyond
 * "who are you" - ours is the one folder of the user's Drive that belongs to
 * this app - opens a consent screen as a separate activity, and Android hands
 * the answer back to the activity that asked. A plugin cannot receive it on
 * its own, so the activity has to pass it along.
 *
 * The plugin refuses to ask for any scope unless the activity says it knows
 * this, by implementing the marker interface below. It is a blunt check and a
 * fair one: without the two methods here the consent screen would open, the
 * person would agree, and nothing would come back.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    /**
     * The one plugin that lives in this project rather than in node_modules.
     *
     * Reading a bank's own notification has no official Capacitor plugin and
     * no community one worth depending on, and it is about twenty lines of
     * Android - so it is written here. A plugin of our own has to be named
     * before the bridge is built; the ones from packages register themselves.
     */
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(BankNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
        remember(getIntent());
        ListenerKeeper.schedule(getApplicationContext());
        ListenerGuard.start(getApplicationContext());
    }

    /**
     * Each time the app comes to the front, a few seconds later: if Android
     * left the notification listener unbound, bind it afresh. The wait lets
     * a listener Android is already binding arrive first.
     */
    @Override
    public void onResume() {
        super.onResume();
        new android.os.Handler(android.os.Looper.getMainLooper())
                .postDelayed(() -> NotificationCatcher.ensureBound(getApplicationContext()), 3_000);
    }

    /** "Movimiento detectado" tapped while the app was already running. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        remember(intent);
    }

    /** What the notice asked to open, until the app takes it. */
    private static volatile String open;

    private static void remember(Intent intent) {
        if (intent == null) return;
        String asked = intent.getStringExtra(MovementAlert.EXTRA_OPEN);
        if (asked != null) {
            open = asked;
            intent.removeExtra(MovementAlert.EXTRA_OPEN);
        }
    }

    static String takeOpen() {
        String asked = open;
        open = null;
        return asked;
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        // Only the codes the Google provider handed out. Anything else belongs
        // to another plugin and is none of this activity's business.
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle handle = getBridge().getPlugin("SocialLogin");
            if (handle == null) {
                return;
            }
            SocialLoginPlugin plugin = (SocialLoginPlugin) handle.getInstance();
            plugin.handleGoogleLoginIntent(requestCode, data);
        }
    }

    /** The plugin's way of asking "have you read this?". Nothing to do. */
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
