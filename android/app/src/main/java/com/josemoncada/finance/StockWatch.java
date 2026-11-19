package com.josemoncada.finance;

import android.accounts.Account;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Tasks;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

/**
 * Strong moves of the shares held, with the app closed (Jose, 2026-11-19).
 *
 * The app hands this, through `StockWatchPlugin`, what to watch: the Google
 * account, the person's own spreadsheet, each held ticker as Google Finance
 * writes it, the threshold and the words to say. About every half hour, on
 * weekdays while a market may be open (3:00 to 16:30 in New York, which
 * covers London and New York), it asks Google for a token with nothing on
 * screen - the same way the Drive copy does - writes each ticker's price and
 * yesterday's close as GOOGLEFINANCE formulas in that sheet, reads them back
 * and rings for every ticker that moved past the threshold since yesterday's
 * close. Each ticker once a day per direction; the app's own check reads the
 * same list (`told`), so the two never ring twice for one move.
 *
 * Nothing about amounts or positions leaves the phone: the sheet holds only
 * the tickers, as it already does when the app asks for prices.
 * Assumed, not verified: that the phone delivers this alarm to a closed app
 * (Xiaomi may hold it), and that GOOGLEFINANCE works its cells out when they
 * are written through the API with nobody looking at the sheet.
 */
public class StockWatch extends BroadcastReceiver {

    static final String PREFS = "finance.stocks";
    static final String KEY_CONFIG = "config";
    static final String KEY_TOLD = "told";
    static final String KEY_LAST = "lastRun";
    private static final String ACTION = "com.josemoncada.finance.WATCH_STOCKS";
    private static final String CHANNEL = "stock_moves";
    private static final String SCOPE = "https://www.googleapis.com/auth/drive.file";
    private static final String SHEETS = "https://sheets.googleapis.com/v4/spreadsheets/";
    private static final int NOTICE_ID = 7_400_002;
    private static final int ACCENT = 0xFF6378FF;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && !ACTION.equals(intent.getAction())) {
            // The phone started or the app was updated: the alarm is set again.
            schedule(context);
            return;
        }
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                run(context.getApplicationContext());
            } catch (Throwable error) {
                NotificationStore.noteError(context, error);
            } finally {
                pending.finish();
            }
        }).start();
    }

    /** Sets the repeating alarm when watching is on, takes it away when off. */
    static void schedule(Context context) {
        try {
            AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarms == null) return;
            Intent watch = new Intent(context, StockWatch.class).setAction(ACTION);
            PendingIntent pending = PendingIntent.getBroadcast(context, 4400, watch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            JSONObject config = config(context);
            if (config == null || !config.optBoolean("on", false)) {
                alarms.cancel(pending);
                return;
            }
            alarms.setInexactRepeating(AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + AlarmManager.INTERVAL_HALF_HOUR,
                    AlarmManager.INTERVAL_HALF_HOUR, pending);
        } catch (Throwable error) {
            NotificationStore.noteError(context, error);
        }
    }

    static JSONObject config(Context context) {
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CONFIG, null);
            return raw == null ? null : new JSONObject(raw);
        } catch (Throwable error) {
            return null;
        }
    }

    /** Today on the phone, as the app writes its days. */
    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    /** The keys already told, today's only. */
    static Set<String> told(Context context) {
        Set<String> kept = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(KEY_TOLD, null);
        Set<String> out = new HashSet<>();
        if (kept == null) return out;
        String day = "|" + today() + "|";
        for (String key : kept) if (key.contains(day)) out.add(key);
        return out;
    }

    static void markTold(Context context, Set<String> keys) {
        Set<String> all = told(context);
        all.addAll(keys);
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet(KEY_TOLD, all).commit();
    }

    /** Weekdays, 3:00 to 16:30 in New York: when a market the app reads may be open. */
    static boolean marketsMayBeOpen() {
        Calendar newYork = Calendar.getInstance(TimeZone.getTimeZone("America/New_York"));
        int weekday = newYork.get(Calendar.DAY_OF_WEEK);
        if (weekday == Calendar.SATURDAY || weekday == Calendar.SUNDAY) return false;
        int minutes = newYork.get(Calendar.HOUR_OF_DAY) * 60 + newYork.get(Calendar.MINUTE);
        return minutes >= 3 * 60 && minutes <= 16 * 60 + 30;
    }

    private static void run(Context context) throws Exception {
        JSONObject config = config(context);
        if (config == null || !config.optBoolean("on", false)) return;
        if (!marketsMayBeOpen()) return;
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return;
        String email = config.optString("email", "");
        String sheet = config.optString("sheet", "");
        JSONArray rows = config.optJSONArray("rows");
        double threshold = config.optDouble("pct", 5);
        if (email.isEmpty() || sheet.isEmpty() || rows == null || rows.length() == 0) return;
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(KEY_LAST, System.currentTimeMillis()).apply();

        String token = token(context, email);
        if (token == null) return;

        // One row per ticker: as Google Finance writes it, its price, yesterday's close.
        List<String> symbols = new ArrayList<>();
        JSONArray values = new JSONArray();
        for (int at = 0; at < rows.length(); at++) {
            JSONObject row = rows.getJSONObject(at);
            symbols.add(row.getString("symbol"));
            JSONArray line = new JSONArray();
            line.put(row.getString("quote"));
            line.put("=IFERROR(GOOGLEFINANCE(A" + (at + 1) + ",\"price\"),\"\")");
            line.put("=IFERROR(GOOGLEFINANCE(A" + (at + 1) + ",\"closeyest\"),\"\")");
            values.put(line);
        }
        String range = "A1:C" + rows.length();
        // The sheet is the app's own; its other columns are cleared as the app does.
        call("POST", SHEETS + sheet + "/values/" + enc("A1:J2000") + ":clear", token, "{}");
        JSONObject body = new JSONObject().put("range", range).put("majorDimension", "ROWS").put("values", values);
        call("PUT", SHEETS + sheet + "/values/" + enc(range) + "?valueInputOption=USER_ENTERED", token, body.toString());

        JSONArray read = null;
        for (int attempt = 0; attempt < 4; attempt++) {
            Thread.sleep(attempt == 0 ? 1500 : 2500);
            JSONObject answer = new JSONObject(call("GET", SHEETS + sheet + "/values/" + enc(range) + "?valueRenderOption=UNFORMATTED_VALUE", token, null));
            read = answer.optJSONArray("values");
            if (read != null && !loading(read)) break;
        }
        if (read == null) return;

        String day = today();
        Set<String> told = told(context);
        List<String> lines = new ArrayList<>();
        List<String> keys = new ArrayList<>();
        String single = null;
        boolean up = true;
        for (int at = 0; at < read.length() && at < symbols.size(); at++) {
            JSONArray line = read.optJSONArray(at);
            if (line == null || line.length() < 3) continue;
            double price = line.optDouble(1, Double.NaN);
            double before = line.optDouble(2, Double.NaN);
            if (Double.isNaN(price) || Double.isNaN(before) || before <= 0) continue;
            double pct = (price - before) / before * 100;
            if (Math.abs(pct) < threshold) continue;
            String symbol = symbols.get(at);
            String key = symbol + "|" + day + "|" + (pct >= 0 ? "up" : "down");
            if (told.contains(key)) continue;
            keys.add(key);
            lines.add(words(config, pct >= 0 ? "up" : "down", symbol, pct));
            single = symbol;
            up = pct >= 0;
        }
        if (keys.isEmpty()) return;
        String title = keys.size() == 1 ? (up ? "📈 " : "📉 ") + lines.get(0)
                : config.optString("many", "{count}").replace("{count}", String.valueOf(keys.size()));
        String text = keys.size() == 1 ? config.optString("body", "") : join(lines);
        notify(context, config, title, text, keys.size() == 1 ? single : null);
        markTold(context, new HashSet<>(keys));
    }

    private static String words(JSONObject config, String which, String symbol, double pct) {
        String pctText = String.format(Locale.forLanguageTag(config.optString("locale", "es-CO")), "%.1f %%", Math.abs(pct));
        return config.optString(which, "{symbol} {pct}").replace("{symbol}", symbol).replace("{pct}", pctText);
    }

    private static String join(List<String> lines) {
        StringBuilder out = new StringBuilder();
        for (String line : lines) {
            if (out.length() > 0) out.append('\n');
            out.append(line);
        }
        return out.toString();
    }

    /** A cell Google is still working out says "Loading...". */
    private static boolean loading(JSONArray read) {
        for (int at = 0; at < read.length(); at++) {
            JSONArray line = read.optJSONArray(at);
            if (line == null) continue;
            for (int cell = 1; cell < line.length(); cell++) {
                Object value = line.opt(cell);
                if (value instanceof String && ((String) value).toLowerCase(Locale.ROOT).startsWith("loading")) return true;
            }
        }
        return false;
    }

    /** A token for the sheet, only if the account already gave it; never a screen. */
    private static String token(Context context, String email) {
        try {
            AuthorizationRequest request = AuthorizationRequest.builder()
                    .setRequestedScopes(Collections.singletonList(new Scope(SCOPE)))
                    .setAccount(new Account(email, "com.google"))
                    .build();
            AuthorizationResult result = Tasks.await(Identity.getAuthorizationClient(context).authorize(request), 20, TimeUnit.SECONDS);
            return result.hasResolution() ? null : result.getAccessToken();
        } catch (Throwable error) {
            return null;
        }
    }

    private static String enc(String text) throws Exception {
        return URLEncoder.encode(text, "UTF-8").replace("+", "%20");
    }

    private static String call(String method, String url, String token, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        try {
            connection.setRequestMethod(method);
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(15_000);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Accept", "application/json");
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (OutputStream out = connection.getOutputStream()) { out.write(body.getBytes(StandardCharsets.UTF_8)); }
            }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("Sheets " + status);
            try (InputStream in = connection.getInputStream()) {
                ByteArrayOutputStream all = new ByteArrayOutputStream();
                byte[] chunk = new byte[8192];
                int read;
                while ((read = in.read(chunk)) != -1) all.write(chunk, 0, read);
                return all.toString("UTF-8");
            }
        } finally {
            connection.disconnect();
        }
    }

    private static void notify(Context context, JSONObject config, String title, String text, String symbol) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, config.optString("channel", "Stocks"), NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription(config.optString("channelAbout", ""));
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra(ShortcutsPlugin.EXTRA_SHORTCUT, "stock:" + (symbol == null ? "" : symbol))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, NOTICE_ID, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder built = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_movement)
                .setColor(ACCENT)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setAutoCancel(true)
                .setContentIntent(tap);
        try {
            Bitmap logo = BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_notice_logo);
            if (logo != null) built.setLargeIcon(logo);
        } catch (Throwable ignored) {
            // The notice without its picture.
        }
        try {
            NotificationManagerCompat.from(context).notify(NOTICE_ID, built.build());
        } catch (SecurityException ignored) {
            // Notices not allowed: checked above, but the person may have just turned them off.
        }
    }
}
