package com.josemoncada.finance;

import android.app.Notification;
import android.app.Person;
import android.content.ComponentName;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
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
 *
 * **A text message is chosen by its SENDER, never by the app** (rule 22,
 * Jose 2026-10-02: "continua con los sms"). Many banks send no notification
 * of their own, only an SMS, and an SMS reaches this listener as a
 * notification of the phone's messaging app. Ticking that whole app would
 * keep every personal message on the phone, so a conversation is kept only
 * when the person ticked its sender ("this sender, inside this app"). Which
 * senders exist is learned from the phone itself, with no list of bank
 * numbers: a sender is listed once one of its messages carried something
 * shaped like money, and nothing it said is kept until it is ticked.
 */
public class NotificationCatcher extends NotificationListenerService {

    /** The listener Android has bound, while it is bound: what the diagnosis asks. */
    private static volatile NotificationCatcher running;

    /** Android started handing notifications over. */
    @Override
    public void onListenerConnected() {
        running = this;
        NotificationStore.noteConnection(this, true, System.currentTimeMillis());
    }

    /**
     * What the listener sees in the status bar right now, one line per
     * notification and never a word of what it says: the app, whether it is
     * a conversation, whether it carries words, whether they look like money,
     * and what this app makes of it (hidden, the SMS app). Null when Android
     * has not bound the listener.
     *
     * Asked for when nothing showed up and every guess about why had failed
     * (Jose, 2026-10-05: "algo no estas haciendo bien"): a bank SMS on screen,
     * and the question is whether this app is even being handed it.
     */
    static JSONArray seenNow() {
        NotificationCatcher catcher = running;
        if (catcher == null) return null;
        JSONArray list = new JSONArray();
        StatusBarNotification[] all;
        try {
            all = catcher.getActiveNotifications();
        } catch (Exception refused) {
            return null;
        }
        if (all == null) return list;
        for (StatusBarNotification one : all) {
            try {
                Notification notification = one.getNotification();
                if (notification == null) continue;
                String pkg = one.getPackageName();
                Bundle extras = notification.extras;
                String said = "";
                if (extras != null) {
                    Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
                    if (messages != null && messages.length > 0 && messages[messages.length - 1] instanceof Bundle) {
                        said = text((Bundle) messages[messages.length - 1], "text");
                    }
                    if (said.isEmpty()) said = text(extras, Notification.EXTRA_TEXT);
                    String big = text(extras, Notification.EXTRA_BIG_TEXT);
                    if (big.length() > said.length()) said = big;
                }
                JSONObject row = new JSONObject();
                row.put("package", pkg);
                row.put("app", catcher.labelOf(pkg));
                row.put("postedAt", one.getPostTime());
                row.put("category", notification.category == null ? "" : notification.category);
                row.put("conversation", catcher.isConversation(pkg, notification, extras));
                row.put("messages", extras != null && extras.containsKey(Notification.EXTRA_MESSAGES));
                row.put("ongoing", (notification.flags & Notification.FLAG_ONGOING_EVENT) != 0);
                row.put("summary", (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0);
                row.put("words", !said.isEmpty());
                row.put("money", NotificationStore.looksLikeMoney(said));
                row.put("hidden", NotificationStore.isHidden(catcher, pkg));
                row.put("smsApp", NotificationStore.isSmsApp(catcher, pkg));
                list.put(row);
            } catch (Exception broken) {
                // One notification that will not describe itself is not the list.
            }
        }
        return list;
    }

    /**
     * Android stopped handing them over - after an update, or to save battery
     * - and does not always come back by itself. Ask it to, at once; the app
     * asks again each time it opens (`BankNotificationsPlugin.isEnabled`).
     */
    @Override
    public void onListenerDisconnected() {
        running = null;
        NotificationStore.noteConnection(this, false, System.currentTimeMillis());
        try {
            requestRebind(new ComponentName(this, NotificationCatcher.class));
        } catch (Exception refused) {
            // The person took the permission away: nothing to ask for.
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification posted) {
        if (posted == null) return;
        NotificationStore.noteHeard(this, System.currentTimeMillis());

        String pkg = posted.getPackageName();
        if (pkg == null || pkg.equals(getPackageName())) return;

        Notification notification = posted.getNotification();
        if (notification == null) return;

        // An ongoing notification is a status bar, not an event: a download in
        // progress, a call, music playing. A bank's message is never one.
        if ((notification.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;

        long at = posted.getPostTime();
        Bundle extras = notification.extras;
        boolean conversation = isConversation(pkg, notification, extras);
        // The one that groups a conversation's others may carry no message of
        // its own; it is read, never counted as a message without words.
        boolean summary = (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0;
        String label = labelOf(pkg);
        NotificationStore.noteRecent(this, pkg, label, at, conversation);

        // An app the person hid is not even counted - except the phone's own
        // SMS app, whose row is hidden but never its senders: a bank's SMS
        // arrives through it, and each sender is ticked or hidden on its own
        // (2026-10-02: a messaging app hidden with the rest of the noise
        // silenced every bank that texts). Any other app hidden - WhatsApp,
        // a chat - is ignored whole (Jose, 2026-10-05: hidden WhatsApp chats
        // were being listed as senders). Nothing a sender says is kept until
        // it is ticked, and only senders whose messages look like money are
        // even listed.
        if (NotificationStore.isHidden(this, pkg)) {
            if (conversation && extras != null && NotificationStore.isSmsApp(this, pkg)) {
                keepConversation(pkg, label, extras, at, summary);
            }
            return;
        }
        NotificationStore.noteApp(this, pkg, label, at, conversation);

        // A whole messaging app ticked by hand (before senders existed, or on
        // purpose) still keeps everything, as it always did.
        if (conversation && extras != null && !NotificationStore.isWatched(this, pkg)) {
            keepConversation(pkg, label, extras, at, summary);
            return;
        }
        if (!NotificationStore.isWatched(this, pkg)) return;
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
            if (NotificationStore.keep(this, one)) MovementAlert.post(this, pkg, labelOf(pkg), said, at);
        } catch (JSONException broken) {
            // One unreadable notification is not a reason to stop reading.
        }
    }

    /**
     * A message between people - an SMS, a chat - rather than an app saying
     * something of its own: the category Android asks apps to mark them with,
     * the messaging style that carries them, or the phone's own SMS app.
     */
    private boolean isConversation(String pkg, Notification notification, Bundle extras) {
        if (Notification.CATEGORY_MESSAGE.equals(notification.category)) return true;
        if (extras != null && extras.containsKey(Notification.EXTRA_MESSAGES)) return true;
        return NotificationStore.isSmsApp(this, pkg);
    }

    /**
     * One conversation's newest message: the sender is noted when it looks
     * like money, and its words are kept only when that sender is ticked.
     *
     * A messaging app re-posts the conversation with its earlier messages
     * whenever a new one arrives, so only the last one is read, with its own
     * time - the same message re-posted is the same message.
     */
    private void keepConversation(String pkg, String label, Bundle extras, long postedAt, boolean summary) {
        String said = "";
        String from = "";
        long at = postedAt;

        Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages != null && messages.length > 0 && messages[messages.length - 1] instanceof Bundle) {
            Bundle last = (Bundle) messages[messages.length - 1];
            said = text(last, "text");
            long time = last.getLong("time", 0);
            if (time > 0) at = time;
            from = text(last, "sender");
            if (from.isEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                Person person = last.getParcelable("sender_person");
                if (person != null && person.getName() != null) from = person.getName().toString().trim();
            }
        }
        // A group is named by its conversation; one person, by the title.
        String group = text(extras, Notification.EXTRA_CONVERSATION_TITLE);
        if (!group.isEmpty()) from = group;
        if (from.isEmpty()) from = text(extras, Notification.EXTRA_TITLE);
        if (said.isEmpty()) {
            said = text(extras, Notification.EXTRA_TEXT);
            String big = text(extras, Notification.EXTRA_BIG_TEXT);
            if (big.length() > said.length()) said = big;
        }
        // What kind of message arrived, never what it said: a phone that hides
        // the words of its notifications hands the app messages with none, and
        // the screen has to be able to say so (Jose, 2026-10-02: two bank SMS
        // arrived and nothing told him why no sender was listed).
        boolean money = NotificationStore.looksLikeMoney(said);
        if (!summary) NotificationStore.noteShape(this, pkg, label, said.isEmpty() ? "blank" : money ? "money" : "plain");
        if (from.isEmpty() || said.isEmpty()) return;

        if (NotificationStore.isSenderHidden(this, pkg, from)) return;
        if (money) NotificationStore.noteSender(this, pkg, label, from, at);
        if (!NotificationStore.isSenderWatched(this, pkg, from)) return;

        try {
            JSONObject one = new JSONObject();
            one.put("package", pkg);
            one.put("app", label);
            one.put("sender", from);
            one.put("title", from);
            one.put("text", said);
            one.put("postedAt", at);
            if (NotificationStore.keep(this, one)) MovementAlert.post(this, pkg + "|" + from, from, said, at);
        } catch (JSONException broken) {
            // One unreadable message is not a reason to stop reading.
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
