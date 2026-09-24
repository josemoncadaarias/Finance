package com.josemoncada.finance;

import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
@CapacitorPlugin(name = "BankNotifications")
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

        JSObject answer = new JSObject();
        answer.put("enabled", on);
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

    /** Everything caught since the app last looked, still held. */
    @PluginMethod
    public void caught(PluginCall call) {
        JSObject answer = new JSObject();
        answer.put("caught", toJs(NotificationStore.caught(getContext())));
        call.resolve(answer);
    }

    /** Throws away what was caught, leaving which apps were seen. */
    @PluginMethod
    public void forgetCaught(PluginCall call) {
        NotificationStore.forgetCaught(getContext());
        call.resolve();
    }

    /** Throws away all of it, including the list of apps. */
    @PluginMethod
    public void forgetEverything(PluginCall call) {
        NotificationStore.forgetEverything(getContext());
        call.resolve();
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
