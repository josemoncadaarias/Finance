package com.josemoncada.finance;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.graphics.Typeface;
import android.os.Build;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.StyleSpan;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * "Movimiento detectado": the phone's own notice that a bank just said money
 * moved (Jose, 2026-10-08, mockup 19). NOTHING is saved here - rule 22: only
 * a person makes a movement real. Tapping it opens the app on that message's
 * proposal, ready to save; "Descartar" means it is never proposed at all.
 *
 * Read by shape only, as little as it takes to say a good line: the first
 * amount and which way the money went. What the message really means is
 * read in TypeScript when the app opens (`readNotices`), with the molds the
 * person taught.
 *
 * One movement, one notice: the same amount from another source within
 * twenty minutes (the bank's SMS and its app) is the same purchase and does
 * not ring again. Several waiting are one notice that counts them.
 */
final class MovementAlert {

    /**
     * A high-importance channel, so the notice floats over the screen and
     * shows on the lock screen. Its first version ("movements") was default
     * importance: Android - and Xiaomi above all - put it among the silent
     * ones, and Jose never saw it ring (2026-10-08). A channel's importance
     * cannot be raised once created, hence a new id and the old one deleted.
     */
    static final String CHANNEL = "movements_alert";
    private static final String OLD_CHANNEL = "movements";
    static final int ID = 4201;
    /** On the intent that opens the app: what to open (a JSON message, or "review"). */
    static final String EXTRA_OPEN = "finance.open";
    static final String ACTION_DISMISS = "com.josemoncada.finance.DISMISS_MOVEMENT";
    /** "Más tarde": the notice goes, the movement waits in Movimientos por revisar. */
    static final String ACTION_LATER = "com.josemoncada.finance.LATER_MOVEMENT";
    /** The app's own colour (Zafiro), for the notice's icon and name. */
    private static final int ACCENT = 0xFF6378FF;

    private static final String FILE = "movement_alerts";
    private static final String PENDING = "pending";
    private static final String DISMISSED = "dismissed";
    /** What already rang, kept past the app opening: a late copy never rings twice. */
    private static final String RANG = "rang";
    /**
     * What became of each message handed here - rang, or why not - with no
     * words of it (Jose, 2026-10-08: two bank notices arrived and nothing
     * rang, and nothing on the phone could say why). Read by the source's
     * page beside each message.
     */
    private static final String LOG = "log";
    private static final long WINDOW = 20L * 60 * 1000;
    private static final int KEEP = 60;

    private static final Pattern AMOUNT = Pattern.compile(
            "(?:[$€£]\\s?|(?i:COP|USD|EUR)\\s?)?(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)(?:\\s?(?i:COP|USD|EUR))?");
    private static final String[] OUT = {
            "compra", "pago", "pagaste", "retiro", "retiraste", "enviaste", "envio", "enviado", "transferiste", "debito", "cargo",
            "realizaste una transferencia", "desde tu cuenta",
            "purchase", "paid", "spent", "withdraw", "sent" };
    private static final String[] IN = {
            "recibiste", "recibio", "abono", "consignacion", "deposito", "te llegaron", "te enviaron", "ingreso",
            "received", "deposit", "credited" };
    private static final String[] NOT_A_MOVEMENT = {
            "codigo", "clave", "otp", "contrasena", "promo", "oferta", "gana ", "vence", "recuerda", "saldo es", "tu saldo" };

    private MovementAlert() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    private static JSONArray array(Context context, String key) {
        try {
            return new JSONArray(prefs(context).getString(key, "[]"));
        } catch (Exception broken) {
            return new JSONArray();
        }
    }

    private static String fold(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    private static boolean has(String folded, String[] words) {
        for (String word : words) if (folded.contains(word)) return true;
        return false;
    }

    /**
     * A message from a ticked source was just kept. Rings when it looks like
     * money that moved, once per movement.
     */
    static void post(Context context, String source, String name, String text, long at) {
        if (text == null || text.isEmpty()) { note(context, source, at, "empty", null); return; }
        String folded = fold(text);
        int direction = has(folded, IN) && !has(folded, OUT) ? 1 : has(folded, OUT) ? -1 : 0;
        if (direction == 0 && has(folded, NOT_A_MOVEMENT)) { note(context, source, at, "notMovement", null); return; }
        if (!NotificationStore.looksLikeMoney(text)) { note(context, source, at, "noMoney", null); return; }
        Matcher found = AMOUNT.matcher(text);
        String amount = null;
        while (found.find()) {
            String number = found.group(1);
            // A bare short number (a code, an hour) is not money without a sign.
            if (found.group(0).length() == number.length() && !number.matches(".*\\d[.,]\\d{3}.*")) continue;
            amount = number;
            break;
        }
        if (amount == null) { note(context, source, at, "noAmount", null); return; }
        String digits = amount.replaceAll("\\D", "");

        try {
            JSONArray rang = array(context, RANG);
            for (int i = 0; i < rang.length(); i += 1) {
                JSONObject one = rang.optJSONObject(i);
                if (one == null) continue;
                boolean sameMoney = digits.equals(one.optString("digits"));
                boolean near = Math.abs(one.optLong("at") - at) < WINDOW;
                // The same purchase from another source rang already. One
                // source never reports one movement twice: the same amount
                // again from it is another movement, and rings.
                String other = one.optString("source");
                if (sameMoney && near && !other.equals(source)) {
                    note(context, source, at, "same", one.optString("name", other));
                    return;
                }
            }
            JSONObject mark = new JSONObject();
            mark.put("digits", digits);
            mark.put("at", at);
            mark.put("source", source);
            mark.put("name", name);
            rang.put(mark);
            while (rang.length() > KEEP) rang.remove(0);
            JSONArray pending = array(context, PENDING);
            JSONObject one = new JSONObject();
            one.put("source", source);
            one.put("name", name);
            one.put("text", text);
            one.put("at", at);
            one.put("amount", amount);
            one.put("digits", digits);
            one.put("direction", direction);
            pending.put(one);
            while (pending.length() > KEEP) pending.remove(0);
            prefs(context).edit().putString(PENDING, pending.toString()).putString(RANG, rang.toString()).apply();
            note(context, source, at, show(context, pending), null);
        } catch (Exception broken) {
            // A notice that could not be posted is still proposed when the app opens.
            note(context, source, at, "error", broken.getClass().getSimpleName());
        }
    }

    /** Remembers what became of one message: no words of it, only why. */
    private static void note(Context context, String source, long at, String reason, String detail) {
        try {
            JSONArray log = array(context, LOG);
            JSONObject one = new JSONObject();
            one.put("source", source);
            one.put("at", at);
            one.put("reason", reason);
            // When the app was actually handed it: far after "at", the phone
            // had the app frozen and passed the message on only when it woke.
            one.put("heard", System.currentTimeMillis());
            if (detail != null) one.put("detail", detail);
            log.put(one);
            while (log.length() > 120) log.remove(0);
            prefs(context).edit().putString(LOG, log.toString()).apply();
        } catch (Exception ignored) {
            // A note about a notice is not worth losing the notice for.
        }
    }

    /** What became of the last messages handed here. */
    static JSONArray log(Context context) {
        return array(context, LOG);
    }

    /** Whether Android lets this app's notices show at all, channel included. */
    static boolean allowed(Context context) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            NotificationChannel channel = manager == null ? null : manager.getNotificationChannel(CHANNEL);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }

    /** Posts the notice; says "shown", or why Android will not show it. */
    private static String show(Context context, JSONArray pending) {
        ensureChannel(context);
        int count = pending.length();
        if (count == 0) return "error";
        if (!allowed(context)) return "off";
        JSONObject last = pending.optJSONObject(count - 1);
        boolean spanish = Locale.getDefault().getLanguage().equals("es");
        String title;
        String body;
        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (count == 1) {
            int direction = last.optInt("direction");
            String what = spanish
                    ? (direction < 0 ? "💸 Gasto detectado" : direction > 0 ? "💰 Ingreso detectado" : "🔔 Movimiento detectado")
                    : (direction < 0 ? "💸 Spending detected" : direction > 0 ? "💰 Income detected" : "🔔 Movement detected");
            String sign = direction < 0 ? "−" : direction > 0 ? "+" : "";
            // Non-breaking spaces: the figure never wraps away from its sign.
            title = what + " ·\u00A0" + sign + "$\u00A0" + shortAmount(last.optString("amount"));
            // An SMS's sender is a short code that says nothing; the bank signs
            // its own words. An app's notice keeps the app's name in front.
            boolean sms = last.optString("source").startsWith(SmsInbox.PACKAGE + "|");
            body = sms ? last.optString("text") : last.optString("name") + ": " + last.optString("text");
            open.putExtra(EXTRA_OPEN, last.toString());
        } else {
            title = spanish ? "📥 " + count + " movimientos detectados" : "📥 " + count + " movements detected";
            StringBuilder list = new StringBuilder();
            for (int i = 0; i < count; i += 1) {
                JSONObject one = pending.optJSONObject(i);
                if (one == null) continue;
                if (list.length() > 0) list.append(" · ");
                int direction = one.optInt("direction");
                list.append(direction > 0 ? "+" : direction < 0 ? "−" : "").append("$\u00A0").append(shortAmount(one.optString("amount")));
            }
            body = list.toString();
            open.putExtra(EXTRA_OPEN, "review");
        }
        String hint = spanish ? "¿Lo guardamos? Revísalo antes, no se guarda solo." : "Save it? Check it first - nothing is saved by itself.";

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent tap = PendingIntent.getActivity(context, ID, open, flags);
        Intent dismiss = new Intent(context, MovementAlertReceiver.class).setAction(ACTION_DISMISS);
        PendingIntent drop = PendingIntent.getBroadcast(context, ID, dismiss, flags);
        Intent wait = new Intent(context, MovementAlertReceiver.class).setAction(ACTION_LATER);
        PendingIntent later = PendingIntent.getBroadcast(context, ID + 1, wait, flags);

        NotificationCompat.Builder built = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_movement)
                .setColor(ACCENT)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(expanded(body, hint)))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .addAction(0, spanish ? "Revisar y guardar" : "Review and save", tap)
                .addAction(0, spanish ? "Más tarde" : "Later", later)
                .addAction(0, spanish ? (count == 1 ? "Descartar" : "Descartar todos") : (count == 1 ? "Dismiss" : "Dismiss all"), drop);
        Bitmap logo = logoOf(context);
        if (logo != null) built.setLargeIcon(logo);
        try {
            NotificationManagerCompat.from(context).notify(ID, built.build());
            return "shown";
        } catch (SecurityException notAllowed) {
            // The person turned this app's notifications off: proposals still wait in the app.
            return "off";
        }
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(OLD_CHANNEL) != null) manager.deleteNotificationChannel(OLD_CHANNEL);
        if (manager.getNotificationChannel(CHANNEL) != null) return;
        boolean spanish = Locale.getDefault().getLanguage().equals("es");
        NotificationChannel channel = new NotificationChannel(CHANNEL,
                spanish ? "Movimientos detectados" : "Detected movements", NotificationManager.IMPORTANCE_HIGH);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        channel.enableVibration(true);
        channel.setDescription(spanish
                ? "Cuando un banco avisa de un movimiento, para revisarlo y guardarlo"
                : "When a bank reports a movement, to review and save it");
        manager.createNotificationChannel(channel);
    }

    /**
     * What the bank said in italics, then - apart, in bold - what the app
     * asks (Jose, 2026-10-08: the question read as part of the bank's words).
     */
    private static CharSequence expanded(String said, String question) {
        SpannableStringBuilder text = new SpannableStringBuilder();
        text.append(said);
        text.setSpan(new StyleSpan(Typeface.ITALIC), 0, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        text.append("\n\n");
        int from = text.length();
        text.append(question);
        text.setSpan(new StyleSpan(Typeface.BOLD), from, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return text;
    }

    /** "1.234.567,00" -> "1.234.567": cents of zero say nothing in a title. */
    private static String shortAmount(String amount) {
        return amount.replaceAll("[.,]00$", "");
    }

    /** The app's own icon, drawn for the notice's picture. */
    private static Bitmap logoOf(Context context) {
        try {
            Drawable icon = context.getPackageManager().getApplicationIcon(context.getPackageName());
            int size = 192;
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            icon.setBounds(0, 0, size, size);
            icon.draw(canvas);
            return bitmap;
        } catch (Exception none) {
            return null;
        }
    }

    /** "Más tarde": the notice goes; the movement is proposed when the app opens. */
    static void later(Context context) {
        prefs(context).edit().putString(PENDING, "[]").apply();
        NotificationManagerCompat.from(context).cancel(ID);
    }

    /** "Descartar": what was waiting is never proposed, and the notice goes. */
    static void dismissAll(Context context) {
        JSONArray pending = array(context, PENDING);
        JSONArray dismissed = array(context, DISMISSED);
        for (int i = 0; i < pending.length(); i += 1) dismissed.put(pending.opt(i));
        while (dismissed.length() > 200) dismissed.remove(0);
        prefs(context).edit().putString(DISMISSED, dismissed.toString()).putString(PENDING, "[]").apply();
        NotificationManagerCompat.from(context).cancel(ID);
    }

    /** The app opened: what was waiting is now in "Por revisar", so the notice goes. */
    static void clear(Context context) {
        prefs(context).edit().putString(PENDING, "[]").apply();
        NotificationManagerCompat.from(context).cancel(ID);
    }

    /** What the person dismissed from the notice, for the app to never propose. */
    static JSONArray dismissed(Context context) {
        return array(context, DISMISSED);
    }
}
