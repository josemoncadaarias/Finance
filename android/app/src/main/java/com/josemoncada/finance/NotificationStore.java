package com.josemoncada.finance;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Telephony;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.regex.Pattern;

/**
 * What the notification listener has seen, kept where it outlives the app.
 *
 * The listener runs whether or not anybody has the app open - that is the
 * whole point of it - so what it catches cannot be handed to a screen that is
 * not there. It is written here and drained the next time the app opens.
 *
 * Two different things are kept, and the difference is the privacy of this
 * feature rather than a detail of it:
 *
 *   - **Which apps post notifications at all**: the package, its name and
 *     when it was last seen. Nothing about what any of them said. This is
 *     what lets a person point at their bank instead of the app offering a
 *     built-in list of banks, which rule 22 refuses.
 *   - **What was actually said, for the apps the person has ticked** and for
 *     no others. A phone posts messages, mail and everything else all day,
 *     and none of that is this app's business.
 *
 * Deliberately SharedPreferences and not the app's SQLite: the listener runs
 * in the same process but with no bridge, no WebView and no migrations, and
 * opening the database from there to write a line would be the most fragile
 * part of the whole feature.
 */
final class NotificationStore {

    private static final String FILE = "finance.notifications";
    private static final String APPS = "apps";
    private static final String WATCHED = "watched";
    private static final String CAUGHT = "caught";
    /** Apps the person asked never to see here again - until they ask back. */
    private static final String HIDDEN = "hidden";
    /** Senders inside a messaging app that have sent something shaped like money. */
    private static final String SENDERS = "senders";
    private static final String WATCHED_SENDERS = "watchedSenders";
    private static final String HIDDEN_SENDERS = "hiddenSenders";
    /** Between an app's package and a sender's name in one key; never typed by anybody. */
    private static final String SEP = "\u001f";

    /**
     * Money by its shape, for any country and either language: a sign or a
     * currency code beside a number, or a number grouped in thousands. Only
     * used to decide whether a sender is worth LISTING; what a message means
     * is read in TypeScript (`readNotice`), never here.
     */
    private static final Pattern MONEY = Pattern.compile(
            "[$€£¥]\\s?\\d|\\d\\s?[$€£]|\\b\\d{1,3}(?:[.,]\\d{3})+\\b"
            + "|(?i:\\b(?:COP|USD|EUR|MXN|PEN|CLP|ARS|BRL|GBP)\\b)");

    /** Enough to read a few days of a bank's messages, and not a diary. */
    private static final int KEEP = 300;

    private NotificationStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    private static JSONObject object(Context context, String key) {
        try {
            return new JSONObject(prefs(context).getString(key, "{}"));
        } catch (JSONException broken) {
            return new JSONObject();
        }
    }

    private static JSONArray array(Context context, String key) {
        try {
            return new JSONArray(prefs(context).getString(key, "[]"));
        } catch (JSONException broken) {
            return new JSONArray();
        }
    }

    static boolean looksLikeMoney(String text) {
        return text != null && MONEY.matcher(text).find();
    }

    /** Remembers that this app posts notifications, and nothing it said. */
    static void noteApp(Context context, String pkg, String label, long at, boolean conversation) {
        JSONObject apps = object(context, APPS);
        try {
            JSONObject app = apps.optJSONObject(pkg);
            if (app == null) {
                app = new JSONObject();
                app.put("first", at);
                app.put("count", 0);
            }
            app.put("label", label);
            app.put("last", at);
            app.put("count", app.optInt("count", 0) + 1);
            if (conversation) app.put("messaging", true);
            apps.put(pkg, app);
            prefs(context).edit().putString(APPS, apps.toString()).apply();
        } catch (JSONException broken) {
            // A note about a notification is not worth crashing a phone for.
        }
    }

    private static boolean contains(Context context, String key, String pkg) {
        JSONArray list = array(context, key);
        for (int at = 0; at < list.length(); at += 1) {
            if (pkg.equals(list.optString(at))) return true;
        }
        return false;
    }

    /** The list under this key with the package taken out, and put back when on. */
    private static String toggled(Context context, String key, String pkg, boolean on) {
        JSONArray list = array(context, key);
        JSONArray next = new JSONArray();
        for (int at = 0; at < list.length(); at += 1) {
            String one = list.optString(at);
            if (!one.equals(pkg)) next.put(one);
        }
        if (on) next.put(pkg);
        return next.toString();
    }

    static boolean isWatched(Context context, String pkg) {
        return contains(context, WATCHED, pkg);
    }

    static void watch(Context context, String pkg, boolean on) {
        prefs(context).edit().putString(WATCHED, toggled(context, WATCHED, pkg, on)).apply();
    }

    private static final String HEARD_AT = "heardAt";
    private static final String CONNECTED_AT = "connectedAt";
    private static final String DISCONNECTED_AT = "disconnectedAt";

    /**
     * When Android last handed the listener a notification - any app's, the
     * hidden ones included, never a word of it. A listener can be declared,
     * allowed and still dead (Android unbinds it after an update on some
     * phones), and the only way to see that from the app is a clock that
     * stops (Jose, 2026-10-05: two Bold SMS and no count moved).
     * Written at most once a minute: it is a clock, not a log.
     */
    static void noteHeard(Context context, long at) {
        SharedPreferences prefs = prefs(context);
        if (at - prefs.getLong(HEARD_AT, 0) < 60_000) return;
        prefs.edit().putLong(HEARD_AT, at).apply();
    }

    /** Android connecting the listener, or letting it go. */
    static void noteConnection(Context context, boolean on, long at) {
        prefs(context).edit().putLong(on ? CONNECTED_AT : DISCONNECTED_AT, at).apply();
    }

    static long heardAt(Context context) { return prefs(context).getLong(HEARD_AT, 0); }
    static long connectedAt(Context context) { return prefs(context).getLong(CONNECTED_AT, 0); }
    static long disconnectedAt(Context context) { return prefs(context).getLong(DISCONNECTED_AT, 0); }

    /** The phone's own SMS app, the one whose hidden row still lists senders. */
    static boolean isSmsApp(Context context, String pkg) {
        try {
            return pkg != null && pkg.equals(Telephony.Sms.getDefaultSmsPackage(context));
        } catch (Exception unknown) {
            return false;
        }
    }

    static boolean isHidden(Context context, String pkg) {
        return contains(context, HIDDEN, pkg);
    }

    /**
     * Hides an app from the list, or shows it again.
     *
     * Hidden means the listener stops even noting that it posted, so hiding
     * it also stops keeping what it says and drops what was kept from it:
     * a hidden app leaving its words on the screen would not be hidden. Shown
     * again, it comes back unticked, with the count it had.
     */
    static void hide(Context context, String pkg, boolean on) {
        SharedPreferences.Editor edit = prefs(context).edit();
        edit.putString(HIDDEN, toggled(context, HIDDEN, pkg, on));
        if (on) {
            edit.putString(WATCHED, toggled(context, WATCHED, pkg, false));
            JSONArray all = array(context, CAUGHT);
            JSONArray rest = new JSONArray();
            for (int at = 0; at < all.length(); at += 1) {
                JSONObject one = all.optJSONObject(at);
                if (one != null && !pkg.equals(one.optString("package"))) rest.put(one);
            }
            edit.putString(CAUGHT, rest.toString());
        }
        edit.apply();
    }

    private static String senderKey(String pkg, String sender) {
        return pkg + SEP + sender;
    }

    /** Remembers a sender that sent something shaped like money - not what it said. */
    static void noteSender(Context context, String pkg, String label, String sender, long at) {
        JSONObject senders = object(context, SENDERS);
        String key = senderKey(pkg, sender);
        try {
            JSONObject one = senders.optJSONObject(key);
            if (one == null) {
                one = new JSONObject();
                one.put("package", pkg);
                one.put("sender", sender);
                one.put("first", at);
                one.put("count", 0);
            }
            one.put("app", label);
            one.put("last", Math.max(at, one.optLong("last", 0)));
            one.put("count", one.optInt("count", 0) + 1);
            senders.put(key, one);
            prefs(context).edit().putString(SENDERS, senders.toString()).apply();
        } catch (JSONException broken) {
            // A note about a message is not worth crashing a phone for.
        }
    }

    static boolean isSenderWatched(Context context, String pkg, String sender) {
        return contains(context, WATCHED_SENDERS, senderKey(pkg, sender));
    }

    static boolean isSenderHidden(Context context, String pkg, String sender) {
        return contains(context, HIDDEN_SENDERS, senderKey(pkg, sender));
    }

    static void watchSender(Context context, String pkg, String sender, boolean on) {
        prefs(context).edit()
                .putString(WATCHED_SENDERS, toggled(context, WATCHED_SENDERS, senderKey(pkg, sender), on))
                .apply();
    }

    /**
     * Hides a sender, or shows it again. As with an app: hidden stops even the
     * noting, stops keeping what it says and drops what was kept from it.
     */
    static void hideSender(Context context, String pkg, String sender, boolean on) {
        String key = senderKey(pkg, sender);
        SharedPreferences.Editor edit = prefs(context).edit();
        edit.putString(HIDDEN_SENDERS, toggled(context, HIDDEN_SENDERS, key, on));
        if (on) {
            edit.putString(WATCHED_SENDERS, toggled(context, WATCHED_SENDERS, key, false));
            JSONArray all = array(context, CAUGHT);
            JSONArray rest = new JSONArray();
            for (int at = 0; at < all.length(); at += 1) {
                JSONObject one = all.optJSONObject(at);
                if (one == null) continue;
                boolean same = pkg.equals(one.optString("package")) && sender.equals(one.optString("sender"));
                if (!same) rest.put(one);
            }
            edit.putString(CAUGHT, rest.toString());
        }
        edit.apply();
    }

    static JSONArray sendersSeen(Context context) {
        JSONObject senders = object(context, SENDERS);
        JSONArray list = new JSONArray();
        for (Iterator<String> keys = senders.keys(); keys.hasNext(); ) {
            String key = keys.next();
            JSONObject one = senders.optJSONObject(key);
            if (one == null) continue;
            try {
                JSONObject copy = new JSONObject(one.toString());
                String pkg = copy.optString("package");
                String sender = copy.optString("sender");
                // A hidden app's senders are not listed, unless it is the
                // SMS app: senders noted from a hidden chat app before
                // 2026-10-05 disappear, and come back if the app is shown.
                if (isHidden(context, pkg) && !isSmsApp(context, pkg)) continue;
                copy.put("watched", isSenderWatched(context, pkg, sender));
                copy.put("hidden", isSenderHidden(context, pkg, sender));
                list.put(copy);
            } catch (JSONException broken) {
                // Skip the one that will not copy rather than lose the rest.
            }
        }
        return list;
    }

    /** Keeps one notification, oldest dropped once there are too many. */
    static void keep(Context context, JSONObject caught) {
        JSONArray all = array(context, CAUGHT);
        // A conversation re-posted carries its last message again: the same
        // app, sender, words and time are one message, kept once.
        for (int at = Math.max(0, all.length() - 30); at < all.length(); at += 1) {
            JSONObject one = all.optJSONObject(at);
            if (one != null
                    && one.optString("package").equals(caught.optString("package"))
                    && one.optString("sender").equals(caught.optString("sender"))
                    && one.optString("text").equals(caught.optString("text"))
                    && one.optLong("postedAt") == caught.optLong("postedAt")) return;
        }
        all.put(caught);
        while (all.length() > KEEP) all.remove(0);
        prefs(context).edit().putString(CAUGHT, all.toString()).apply();
    }

    /**
     * Counts the kind of a messaging app's message - with no words, with words
     * but no money, or with money - and keeps nothing of what it said.
     */
    static void noteShape(Context context, String pkg, String shape) {
        JSONObject apps = object(context, APPS);
        JSONObject app = apps.optJSONObject(pkg);
        if (app == null) return;
        try {
            app.put(shape, app.optInt(shape, 0) + 1);
            apps.put(pkg, app);
            prefs(context).edit().putString(APPS, apps.toString()).apply();
        } catch (JSONException broken) {
            // A count is not worth crashing a phone for.
        }
    }

    static JSONArray appsSeen(Context context) {
        JSONObject apps = object(context, APPS);
        JSONArray list = new JSONArray();
        for (Iterator<String> names = apps.keys(); names.hasNext(); ) {
            String pkg = names.next();
            JSONObject app = apps.optJSONObject(pkg);
            if (app == null) continue;
            try {
                JSONObject one = new JSONObject(app.toString());
                one.put("package", pkg);
                one.put("watched", isWatched(context, pkg));
                one.put("hidden", isHidden(context, pkg));
                list.put(one);
            } catch (JSONException broken) {
                // Skip the one that will not copy rather than lose the rest.
            }
        }
        return list;
    }

    static JSONArray caught(Context context) {
        return array(context, CAUGHT);
    }

    static void forgetCaught(Context context) {
        prefs(context).edit().putString(CAUGHT, "[]").apply();
    }

    static void forgetEverything(Context context) {
        prefs(context).edit().clear().apply();
    }
}
