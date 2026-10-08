package com.josemoncada.finance;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.util.Locale;

/**
 * "Avisarme siempre al instante", chosen by the person (Jose, 2026-10-08).
 *
 * A quiet, fixed notice of Finance, kept while the switch is on. A phone
 * that closes apps to save battery (Jose's Xiaomi did, and the listener of
 * the banks' notifications went with it) leaves an app showing one alone,
 * so every bank notice rings the moment it lands. It does nothing itself:
 * no work, no network; it only keeps the app alive and the listener bound.
 * Off by default - the person decides, told what each choice means.
 */
public class ListenerGuard extends Service {

    static final String CHANNEL = "listener_guard";
    private static final int ID = 4401;
    private static final String FILE = "listener_guard";
    private static final String ON = "on";

    static boolean isOn(Context context) {
        return context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(ON, false);
    }

    /** The switch: remembered, and the guard started or stopped with it. */
    static void set(Context context, boolean on) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(ON, on).commit();
        if (on) start(context);
        else context.stopService(new Intent(context, ListenerGuard.class));
    }

    /** Starts the guard when the switch is on; harmless when it already runs. */
    static void start(Context context) {
        if (!isOn(context)) return;
        try {
            Intent guard = new Intent(context, ListenerGuard.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(guard);
            else context.startService(guard);
        } catch (Throwable refused) {
            // Android may refuse from the background; the app starts it on opening.
            NotificationStore.noteError(context, refused);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            ensureChannel();
            boolean spanish = Locale.getDefault().getLanguage().equals("es");
            Intent open = new Intent(this, MainActivity.class)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent tap = PendingIntent.getActivity(this, ID, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notice = new NotificationCompat.Builder(this, CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat_movement)
                    .setContentTitle(spanish ? "Finance está atenta a tus bancos" : "Finance is watching for your banks")
                    .setContentText(spanish ? "Para avisarte al instante de cada movimiento" : "To tell you of each movement at once")
                    .setContentIntent(tap)
                    .setOngoing(true)
                    .setSilent(true)
                    .setPriority(NotificationCompat.PRIORITY_MIN)
                    .setCategory(NotificationCompat.CATEGORY_SERVICE)
                    .build();
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                    ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
            ServiceCompat.startForeground(this, ID, notice, type);
            NotificationCatcher.ensureBound(this);
        } catch (Throwable error) {
            NotificationStore.noteError(this, error);
            stopSelf();
            return START_NOT_STICKY;
        }
        return isOn(this) ? START_STICKY : START_NOT_STICKY;
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL) != null) return;
        boolean spanish = Locale.getDefault().getLanguage().equals("es");
        NotificationChannel channel = new NotificationChannel(CHANNEL,
                spanish ? "Atenta a tus bancos" : "Watching for your banks", NotificationManager.IMPORTANCE_MIN);
        channel.setDescription(spanish
                ? "El aviso fijo que mantiene a Finance atenta. Ocultarlo no la detiene."
                : "The fixed notice that keeps Finance watching. Hiding it does not stop it.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
