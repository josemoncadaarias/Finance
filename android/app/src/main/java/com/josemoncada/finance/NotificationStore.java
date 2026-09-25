package com.josemoncada.finance;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

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

    /** Remembers that this app posts notifications, and nothing it said. */
    static void noteApp(Context context, String pkg, String label, long at) {
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

    /** Keeps one notification, oldest dropped once there are too many. */
    static void keep(Context context, JSONObject caught) {
        JSONArray all = array(context, CAUGHT);
        all.put(caught);
        while (all.length() > KEEP) all.remove(0);
        prefs(context).edit().putString(CAUGHT, all.toString()).apply();
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
