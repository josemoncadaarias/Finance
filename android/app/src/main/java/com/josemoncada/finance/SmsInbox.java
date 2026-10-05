package com.josemoncada.finance;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Bank SMS read straight from the phone's inbox (rule 22, SMS step 3).
 *
 * Some phones never hand the messaging app's notifications to a listener
 * (Jose's, 2026-10-05: every other app reached it, Google Messages never
 * did, with every switch on). So the inbox itself is read, under Play's
 * "SMS-based money management" exception, and only as narrowly as that
 * allows:
 *
 *   - The list of senders is read from the ADDRESS column alone - never a
 *     word of any message - and only senders that look like a business: a
 *     short code (up to eight digits) or a name. A person's phone number is
 *     never listed.
 *   - A message's words are read only for senders the person ticked, and
 *     only from a week before the tick onwards: ticking a bank does not
 *     propose years of history.
 *   - Nothing is copied out of the inbox: each read goes back to it, and the
 *     app turns what it gets into proposals, which a person answers.
 *
 * It speaks the same shape as `NotificationStore`'s senders and messages,
 * under the package {@link #PACKAGE}, so the screen, the review and the
 * learning treat an SMS read here like any other message.
 */
final class SmsInbox {

    /** Not an app: the inbox itself, as the source of a sender. */
    static final String PACKAGE = "sms";

    private static final String FILE = "sms_inbox";
    private static final String WATCHED = "watched";   // sender -> moment ticked
    private static final String HIDDEN = "hidden";     // set of senders
    private static final String FLOOR = "floor";       // nothing before this is read

    private static final long DAY = 24L * 60 * 60 * 1000;
    /** How far before the tick a newly ticked sender is read from. */
    private static final long BEFORE_TICK = 7 * DAY;
    /** How far back the list of senders looks. */
    private static final long SENDERS_BACK = 365 * DAY;
    private static final int MOST = 300;

    /** A short code or a name - never a person's phone number. */
    private static final Pattern BUSINESS = Pattern.compile("^(\\d{3,8}|.*\\p{L}.*)$");

    private SmsInbox() {}

    static boolean allowed(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    private static JSONObject watched(Context context) {
        try {
            return new JSONObject(prefs(context).getString(WATCHED, "{}"));
        } catch (Exception broken) {
            return new JSONObject();
        }
    }

    private static Set<String> hidden(Context context) {
        return new HashSet<>(prefs(context).getStringSet(HIDDEN, new HashSet<>()));
    }

    static boolean looksLikeBusiness(String address) {
        return address != null && BUSINESS.matcher(address.trim()).matches();
    }

    /** The business-like senders of the last year, from the address column alone. */
    static JSONArray senders(Context context) {
        JSONArray out = new JSONArray();
        if (!allowed(context)) return out;
        JSONObject ticked = watched(context);
        Set<String> away = hidden(context);
        Map<String, long[]> seen = new LinkedHashMap<>();   // sender -> count, first, last
        long since = System.currentTimeMillis() - SENDERS_BACK;
        try (Cursor rows = context.getContentResolver().query(
                Uri.parse("content://sms/inbox"),
                new String[] { "address", "date" },
                "date > ?", new String[] { String.valueOf(since) },
                "date DESC")) {
            if (rows == null) return out;
            while (rows.moveToNext()) {
                String address = rows.getString(0);
                if (!looksLikeBusiness(address)) continue;
                address = address.trim();
                long at = rows.getLong(1);
                long[] one = seen.get(address);
                if (one == null) seen.put(address, new long[] { 1, at, at });
                else {
                    one[0] += 1;
                    one[1] = Math.min(one[1], at);
                    one[2] = Math.max(one[2], at);
                }
            }
        } catch (Exception unreadable) {
            return out;
        }
        for (Map.Entry<String, long[]> entry : seen.entrySet()) {
            try {
                JSONObject one = new JSONObject();
                one.put("package", PACKAGE);
                one.put("app", "SMS");
                one.put("sender", entry.getKey());
                one.put("count", entry.getValue()[0]);
                one.put("first", entry.getValue()[1]);
                one.put("last", entry.getValue()[2]);
                one.put("watched", ticked.has(entry.getKey()));
                one.put("hidden", away.contains(entry.getKey()));
                out.put(one);
            } catch (Exception skipped) {
                // One sender less.
            }
        }
        return out;
    }

    static void watch(Context context, String sender, boolean on) {
        JSONObject ticked = watched(context);
        try {
            if (on) {
                if (!ticked.has(sender)) ticked.put(sender, System.currentTimeMillis());
            } else {
                ticked.remove(sender);
            }
        } catch (Exception broken) {
            return;
        }
        prefs(context).edit().putString(WATCHED, ticked.toString()).apply();
    }

    static void hide(Context context, String sender, boolean on) {
        Set<String> away = hidden(context);
        if (on) {
            away.add(sender);
            watch(context, sender, false);
        } else {
            away.remove(sender);
        }
        prefs(context).edit().putStringSet(HIDDEN, away).apply();
    }

    /** What the ticked senders said, from a week before each was ticked. */
    static JSONArray messages(Context context) {
        JSONArray out = new JSONArray();
        if (!allowed(context)) return out;
        JSONObject ticked = watched(context);
        if (ticked.length() == 0) return out;
        long floor = prefs(context).getLong(FLOOR, 0);
        java.util.Iterator<String> names = ticked.keys();
        while (names.hasNext()) {
            String sender = names.next();
            long from = Math.max(floor, ticked.optLong(sender, 0) - BEFORE_TICK);
            try (Cursor rows = context.getContentResolver().query(
                    Uri.parse("content://sms/inbox"),
                    new String[] { "address", "body", "date" },
                    "address = ? AND date >= ?", new String[] { sender, String.valueOf(from) },
                    "date DESC")) {
                if (rows == null) continue;
                int taken = 0;
                while (rows.moveToNext() && taken < MOST) {
                    JSONObject one = new JSONObject();
                    one.put("package", PACKAGE);
                    one.put("app", "SMS");
                    one.put("title", sender);
                    one.put("text", rows.getString(1) == null ? "" : rows.getString(1));
                    one.put("postedAt", rows.getLong(2));
                    one.put("sender", sender);
                    out.put(one);
                    taken += 1;
                }
            } catch (Exception unreadable) {
                // This sender is read on the next pass.
            }
        }
        return out;
    }

    /** "Borrar lo guardado": the inbox is not ours to empty, so nothing before now is read again. */
    static void forgetCaught(Context context) {
        prefs(context).edit().putLong(FLOOR, System.currentTimeMillis()).apply();
    }

    static void forgetEverything(Context context) {
        prefs(context).edit().clear().putLong(FLOOR, System.currentTimeMillis()).apply();
    }
}
