package com.josemoncada.finance;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * What the home-screen widget shows (`SpendWidget`), handed over by the app
 * on every change of its figure, words or "Ocultar montos al abrir".
 */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        try {
            Context context = getContext();
            JSObject state = call.getObject("state", new JSObject());
            context.getSharedPreferences(SpendWidget.PREFS, Context.MODE_PRIVATE).edit()
                    .putString(SpendWidget.KEY_STATE, state.toString())
                    .putBoolean(SpendWidget.KEY_SHOWN, !state.optBoolean("hidden", false))
                    .commit();
            SpendWidget.refresh(context);
            call.resolve();
        } catch (Throwable error) {
            call.reject("widget: " + error.getClass().getSimpleName());
        }
    }

    /** How many Finance widgets are on the home screen. */
    @PluginMethod
    public void count(PluginCall call) {
        JSObject answer = new JSObject();
        try {
            Context context = getContext();
            int[] ids = AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, SpendWidget.class));
            answer.put("count", ids.length);
        } catch (Throwable error) {
            answer.put("count", 0);
        }
        call.resolve(answer);
    }
}
