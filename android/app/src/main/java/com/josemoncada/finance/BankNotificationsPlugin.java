package com.josemoncada.finance;

import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

/**
 * The seam between what Android caught and what the app can ask for.
 *
 * Nothing here decides anything either. It answers four questions - is this
 * possible at all, is it switched on, which apps have been seen, what did the
 * ones I ticked say - and hands the answers to TypeScript, which is where
 * every rule about them lives and where they can be tested with no phone in
 * the room.
 *
 * This is the one Android-only corner of the app (see "iOS: possible,
 * deliberately not done"). iOS does not let an app read another app's
 * notifications at all, and no amount of design changes that, so the app has
 * to work without it: `isSupported` is the question every screen asks first,
 * and the answer being false is an ordinary state and never an error.
 */
@CapacitorPlugin(
        name = "BankNotifications",
        permissions = { @Permission(alias = "sms", strings = {
                android.Manifest.permission.READ_SMS, android.Manifest.permission.RECEIVE_SMS }) })
public class BankNotificationsPlugin extends Plugin {

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject answer = new JSObject();
        answer.put("supported", true);
        call.resolve(answer);
    }

    /**
     * Whether the person has given this app notification access.
     *
     * Read from the setting Android itself keeps, because that is the only
     * truth: the listener may be declared, installed and dead.
     */
    @PluginMethod
    public void isEnabled(PluginCall call) {
        String allowed = Settings.Secure.getString(
                getContext().getContentResolver(), "enabled_notification_listeners");
        boolean on = allowed != null && allowed.contains(getContext().getPackageName());

        // Allowed is not the same as listening: Android can drop the listener
        // after an update and leave the permission on. Asking for it again
        // here costs nothing when it is already there.
        if (on) {
            try {
                NotificationListenerService.requestRebind(
                        new ComponentName(getContext(), NotificationCatcher.class));
            } catch (Exception refused) {
                // Answered below from what was last heard.
            }
        }

        JSObject answer = new JSObject();
        answer.put("enabled", on);
        answer.put("heardAt", NotificationStore.heardAt(getContext()));
        answer.put("connectedAt", NotificationStore.connectedAt(getContext()));
        answer.put("disconnectedAt", NotificationStore.disconnectedAt(getContext()));
        call.resolve(answer);
    }

    /**
     * Opens the Android screen where that permission is given.
     *
     * It cannot be asked for in a dialog the way a camera can: Android makes
     * the person go to Settings and find the app in a list, and the screen it
     * shows says this app wants to read EVERY notification on the phone. That
     * sentence is Android's and it is true, so the app explains what it does
     * with them BEFORE sending anybody here.
     */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent settings = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(settings);
        call.resolve();
    }

    /**
     * Opens this app's own notification settings, where a refused permission
     * to post notices is given back (Android stops asking after a refusal).
     */
    @PluginMethod
    public void openAlertSettings(PluginCall call) {
        Intent settings = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        settings.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(settings);
        call.resolve();
    }

    /** Whether the person let the app read SMS (only ticked senders' words are ever read). */
    @PluginMethod
    public void smsAccess(PluginCall call) {
        JSObject answer = new JSObject();
        // Both: reading the inbox, and hearing a new SMS to ring the notice
        // (2026-10-08). A phone that granted only the first is asked again,
        // and Android gives the second without a new question (same group).
        answer.put("granted", SmsInbox.allowed(getContext()) && SmsInbox.receiving(getContext()));
        call.resolve(answer);
    }

    /** Android's own dialog for reading SMS. */
    @PluginMethod
    public void askSms(PluginCall call) {
        if (SmsInbox.allowed(getContext()) && SmsInbox.receiving(getContext())) {
            smsAccess(call);
            return;
        }
        requestPermissionForAlias("sms", call, "smsAnswered");
    }

    @PermissionCallback
    private void smsAnswered(PluginCall call) {
        JSObject answer = new JSObject();
        answer.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(answer);
    }

    /** Which apps have posted anything, with no word of what they said. */
    @PluginMethod
    public void apps(PluginCall call) {
        JSObject answer = new JSObject();
        answer.put("apps", toJs(NotificationStore.appsSeen(getContext())));
        call.resolve(answer);
    }

    /** Starts or stops keeping what one app says. */
    @PluginMethod
    public void watch(PluginCall call) {
        String pkg = call.getString("package");
        if (pkg == null || pkg.isEmpty()) {
            call.reject("No package");
            return;
        }
        NotificationStore.watch(getContext(), pkg, Boolean.TRUE.equals(call.getBoolean("on", true)));
        call.resolve();
    }

    /**
     * What the listener is being handed: whether Android has it bound, the
     * phone's SMS app, what sits in the status bar now and the last apps it
     * heard from - never a word of any of it.
     */
    @PluginMethod
    public void diagnose(PluginCall call) {
        JSObject answer = new JSObject();
        JSONArray now = NotificationCatcher.seenNow();
        answer.put("bound", now != null);
        String sms = null;
        try {
            sms = android.provider.Telephony.Sms.getDefaultSmsPackage(getContext());
        } catch (Exception unknown) {
            // Said as unknown.
        }
        answer.put("defaultSms", sms == null ? "" : sms);
        answer.put("active", toJs(now == null ? new JSONArray() : now));
        answer.put("recent", toJs(NotificationStore.recent(getContext())));
        call.resolve(answer);
    }

    /** Hides an app from the list for good, or shows it again. */
    @PluginMethod
    public void hide(PluginCall call) {
        String pkg = call.getString("package");
        if (pkg == null || pkg.isEmpty()) {
            call.reject("No package");
            return;
        }
        NotificationStore.hide(getContext(), pkg, Boolean.TRUE.equals(call.getBoolean("on", true)));
        call.resolve();
    }

    /**
     * The senders inside messaging apps that have sent something shaped like
     * money, with no word of what they said.
     */
    @PluginMethod
    public void senders(PluginCall call) {
        JSObject answer = new JSObject();
        JSONArray all = NotificationStore.sendersSeen(getContext());
        JSONArray inbox = SmsInbox.senders(getContext());
        for (int at = 0; at < inbox.length(); at += 1) all.put(inbox.opt(at));
        answer.put("senders", toJs(all));
        call.resolve(answer);
    }

    /** Starts or stops keeping what one sender says, inside one app. */
    @PluginMethod
    public void watchSender(PluginCall call) {
        String pkg = call.getString("package");
        String sender = call.getString("sender");
        if (pkg == null || pkg.isEmpty() || sender == null || sender.isEmpty()) {
            call.reject("No sender");
            return;
        }
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        if (SmsInbox.PACKAGE.equals(pkg)) SmsInbox.watch(getContext(), sender, on);
        else NotificationStore.watchSender(getContext(), pkg, sender, on);
        call.resolve();
    }

    /** Hides a sender for good, or shows it again. */
    @PluginMethod
    public void hideSender(PluginCall call) {
        String pkg = call.getString("package");
        String sender = call.getString("sender");
        if (pkg == null || pkg.isEmpty() || sender == null || sender.isEmpty()) {
            call.reject("No sender");
            return;
        }
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        if (SmsInbox.PACKAGE.equals(pkg)) SmsInbox.hide(getContext(), sender, on);
        else NotificationStore.hideSender(getContext(), pkg, sender, on);
        call.resolve();
    }

    /** Everything caught since the app last looked, still held. */
    @PluginMethod
    public void caught(PluginCall call) {
        JSObject answer = new JSObject();
        JSONArray all = NotificationStore.caught(getContext());
        JSONArray inbox = SmsInbox.messages(getContext());
        for (int at = 0; at < inbox.length(); at += 1) all.put(inbox.opt(at));
        answer.put("caught", toJs(all));
        call.resolve(answer);
    }

    /** Throws away what was caught, leaving which apps were seen. */
    @PluginMethod
    public void forgetCaught(PluginCall call) {
        NotificationStore.forgetCaught(getContext());
        SmsInbox.forgetCaught(getContext());
        call.resolve();
    }

    /** Throws away all of it, including the list of apps. */
    @PluginMethod
    public void forgetEverything(PluginCall call) {
        NotificationStore.forgetEverything(getContext());
        SmsInbox.forgetEverything(getContext());
        call.resolve();
    }

    /**
     * What "Movimiento detectado" asked the app to open, once: a message
     * (source, text, at) or "review" for several. Null when the app was
     * opened any other way.
     */
    @PluginMethod
    public void takeOpen(PluginCall call) {
        JSObject answer = new JSObject();
        String open = MainActivity.takeOpen();
        answer.put("open", open == null ? "" : open);
        call.resolve(answer);
    }

    /** The app has read what was waiting: the notice goes. */
    @PluginMethod
    public void clearAlerts(PluginCall call) {
        MovementAlert.clear(getContext());
        call.resolve();
    }

    /** What was thrown away from the notice, never to be proposed (the last two hundred). */
    @PluginMethod
    public void dismissed(PluginCall call) {
        JSObject answer = new JSObject();
        answer.put("dismissed", toJs(MovementAlert.dismissed(getContext())));
        call.resolve(answer);
    }

    private static JSArray toJs(JSONArray from) {
        JSArray out = new JSArray();
        for (int at = 0; at < from.length(); at += 1) {
            Object one = from.opt(at);
            if (one != null) out.put(one);
        }
        return out;
    }
}
