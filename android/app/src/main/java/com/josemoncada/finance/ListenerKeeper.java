package com.josemoncada.finance;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;

/**
 * Keeps the notification listener bound while the app is not in use.
 *
 * Jose's Xiaomi closes Finance in the background and Android does not bind
 * the listener again until the app is opened (2026-10-08: connected 6:33,
 * the moment he opened it; the bank's notice before that was only read
 * then). Lukas never meets this: it posts its own reminders and reads no
 * other app's notifications. So every ~15 minutes, after the phone starts
 * and after each update, this asks Android to bind the listener again when
 * it is not running; on connecting it reads the status bar, so a bank's
 * notice still there rings late rather than never. Assumed, not verified:
 * that Xiaomi delivers this alarm to a closed app.
 */
public class ListenerKeeper extends BroadcastReceiver {

    private static final String ACTION = "com.josemoncada.finance.KEEP_LISTENER";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            if (intent != null && !ACTION.equals(intent.getAction())) schedule(context);
            NotificationCatcher.ensureBound(context);
        } catch (Throwable error) {
            NotificationStore.noteError(context, error);
        }
    }

    /** Sets the repeating alarm; setting it again only replaces it. */
    static void schedule(Context context) {
        try {
            AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarms == null) return;
            Intent keep = new Intent(context, ListenerKeeper.class).setAction(ACTION);
            PendingIntent pending = PendingIntent.getBroadcast(context, 4300, keep,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            alarms.setInexactRepeating(AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + AlarmManager.INTERVAL_FIFTEEN_MINUTES,
                    AlarmManager.INTERVAL_FIFTEEN_MINUTES, pending);
        } catch (Throwable error) {
            NotificationStore.noteError(context, error);
        }
    }
}
