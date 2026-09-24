package com.josemoncada.finance;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Android handing this app every notification the phone posts.
 *
 * It runs on its own, outside the WebView and often while the app is closed,
 * which is what makes a bank's own message worth reading at all: the movement
 * is known the moment it happens rather than at the end of the month.
 *
 * It interprets NOTHING. Rule 22's first step, in Jose's own words: read what
 * his banks actually post and show it raw for a few days, because half of it
 * may be "open the app to see" and that is worth knowing before a single
 * parser is written. So this records what was said and by whom, and every
 * question about what it MEANS is asked later, in TypeScript, where it can be
 * tested without a phone.
 *
 * What it keeps is deliberately narrow - see `NotificationStore`. Which apps
 * post at all, for everybody; what was said, only for the apps the person has
 * pointed at.
 */
public class NotificationCatcher extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification posted) {
        if (posted == null) return;

        String pkg = posted.getPackageName();
        if (pkg == null || pkg.equals(getPackageName())) return;

        Notification notification = posted.getNotification();
        if (notification == null) return;

        // An ongoing notification is a status bar, not an event: a download in
        // progress, a call, music playing. A bank's message is never one.
        if ((notification.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;

        long at = posted.getPostTime();
        NotificationStore.noteApp(this, pkg, labelOf(pkg), at);
        if (!NotificationStore.isWatched(this, pkg)) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        String title = text(extras, Notification.EXTRA_TITLE);
        String said = text(extras, Notification.EXTRA_TEXT);
        // Some banks put the whole sentence in the expanded form and a summary
        // in the short one, and the whole sentence is where the amount is.
        String big = text(extras, Notification.EXTRA_BIG_TEXT);
        if (big.length() > said.length()) said = big;

        if (title.isEmpty() && said.isEmpty()) return;

        try {
            JSONObject one = new JSONObject();
            one.put("package", pkg);
            one.put("app", labelOf(pkg));
            one.put("title", title);
            one.put("text", said);
            one.put("postedAt", at);
            NotificationStore.keep(this, one);
        } catch (JSONException broken) {
            // One unreadable notification is not a reason to stop reading.
        }
    }

    /** The name a person would recognise, falling back to the package. */
    private String labelOf(String pkg) {
        try {
            PackageManager packages = getPackageManager();
            ApplicationInfo info = packages.getApplicationInfo(pkg, 0);
            CharSequence label = packages.getApplicationLabel(info);
            return label == null ? pkg : label.toString();
        } catch (Exception unknown) {
            return pkg;
        }
    }

    private static String text(Bundle extras, String key) {
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString().trim();
    }
}
