package com.josemoncada.finance;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.util.HashSet;
import java.util.Set;

/**
 * What `StockWatch` watches, handed over by the app on every change
 * (2026-11-19), and the moves already told, shared by the app's own check
 * and the background one so a move rings once.
 */
@CapacitorPlugin(name = "StockWatch")
public class StockWatchPlugin extends Plugin {

    /** The whole configuration, as JSON: on, pct, email, sheet, rows, the words. */
    @PluginMethod
    public void configure(PluginCall call) {
        try {
            Context context = getContext();
            JSObject config = call.getObject("config", new JSObject());
            context.getSharedPreferences(StockWatch.PREFS, Context.MODE_PRIVATE).edit()
                    .putString(StockWatch.KEY_CONFIG, config.toString()).commit();
            StockWatch.schedule(context);
            call.resolve();
        } catch (Throwable error) {
            call.reject("stockWatch: " + error.getClass().getSimpleName());
        }
    }

    @PluginMethod
    public void told(PluginCall call) {
        JSArray keys = new JSArray();
        for (String key : StockWatch.told(getContext())) keys.put(key);
        JSObject answer = new JSObject();
        answer.put("keys", keys);
        long last = getContext().getSharedPreferences(StockWatch.PREFS, Context.MODE_PRIVATE).getLong(StockWatch.KEY_LAST, 0);
        answer.put("lastRun", last);
        call.resolve(answer);
    }

    @PluginMethod
    public void markTold(PluginCall call) {
        try {
            JSONArray keys = call.getArray("keys", new JSArray());
            Set<String> set = new HashSet<>();
            for (int at = 0; at < keys.length(); at++) set.add(keys.getString(at));
            StockWatch.markTold(getContext(), set);
            call.resolve();
        } catch (Throwable error) {
            call.reject("stockWatch: " + error.getClass().getSimpleName());
        }
    }
}
