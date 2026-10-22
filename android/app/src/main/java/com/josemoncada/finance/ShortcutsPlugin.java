package com.josemoncada.finance;

import android.content.Intent;

import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * The shortcuts a long press on the app's icon shows (Jose, 2026-10-22):
 * a new spending, a new income, the assistant, Por revisar.
 *
 * Dynamic rather than declared in XML, so their words follow the language
 * chosen inside the app, not the phone's: the app hands them over on every
 * opening and every change of language. Tapping one opens the app with the
 * shortcut's id, which the app takes once (`take`) and acts on.
 */
@CapacitorPlugin(name = "Shortcuts")
public class ShortcutsPlugin extends Plugin {

    static final String EXTRA_SHORTCUT = "finance.shortcut";

    @PluginMethod
    public void set(PluginCall call) {
        try {
            JSArray items = call.getArray("items");
            List<ShortcutInfoCompat> shortcuts = new ArrayList<>();
            int max = ShortcutManagerCompat.getMaxShortcutCountPerActivity(getContext());
            for (int i = 0; items != null && i < items.length() && i < max; i++) {
                JSObject item = JSObject.fromJSONObject(items.getJSONObject(i));
                String id = item.getString("id");
                Intent intent = new Intent(getContext(), MainActivity.class)
                        .setAction(Intent.ACTION_VIEW)
                        .putExtra(EXTRA_SHORTCUT, id)
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                shortcuts.add(new ShortcutInfoCompat.Builder(getContext(), id)
                        .setShortLabel(item.getString("short"))
                        .setLongLabel(item.getString("long"))
                        .setIcon(IconCompat.createWithResource(getContext(), iconOf(id)))
                        .setIntent(intent)
                        .setRank(i)
                        .build());
            }
            ShortcutManagerCompat.setDynamicShortcuts(getContext(), shortcuts);
            call.resolve();
        } catch (Exception e) {
            // A launcher that will not take them costs nothing but the shortcuts.
            call.reject("shortcuts: " + e.getClass().getSimpleName());
        }
    }

    /** The shortcut the app was opened from, once; empty when none. */
    @PluginMethod
    public void take(PluginCall call) {
        JSObject answer = new JSObject();
        String asked = MainActivity.takeShortcut();
        answer.put("id", asked == null ? "" : asked);
        call.resolve(answer);
    }

    private static int iconOf(String id) {
        switch (id) {
            case "income": return R.drawable.ic_shortcut_income;
            case "assistant": return R.drawable.ic_shortcut_assistant;
            case "review": return R.drawable.ic_shortcut_review;
            default: return R.drawable.ic_shortcut_expense;
        }
    }
}
