package com.josemoncada.finance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Calendar;

/**
 * "Hoy puedes gastar" on the phone's home screen (Jose, 2026-11-25, mockups
 * `59a`-`59f`, option A): the same figure as Inicio's "Puedes gastar hoy" with
 * every account, and three buttons - Gasto, Ingreso, the assistant - that
 * open the app on the one movement form or the assistant. Nothing is ever
 * saved from here (rule 22).
 *
 * The app works the figure out and hands it over (`WidgetPlugin.update`):
 * what is left for the month, the month's last day and every word, already in
 * the app's language. The widget only spreads what is left over the days left
 * itself, so a day that passes with the app closed still divides by one day
 * fewer - the same arithmetic as `spendRoom` (whole hundreds of pesos, today
 * counted). Past the month's last day the figure is not guessed: it asks to
 * open the app.
 *
 * The eye flips the figure between shown and hidden here only; the app sets
 * it back to its own choice ("Ocultar montos al abrir") on its next update.
 */
public class SpendWidget extends AppWidgetProvider {

    static final String PREFS = "finance.widget";
    static final String KEY_STATE = "state";
    static final String KEY_SHOWN = "shown";
    private static final String ACTION_EYE = "com.josemoncada.finance.WIDGET_EYE";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        drawAll(context, manager, ids);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_EYE.equals(intent.getAction())) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_SHOWN, !prefs.getBoolean(KEY_SHOWN, true)).apply();
            refresh(context);
        }
    }

    /** Every Finance widget on the phone, drawn again. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, SpendWidget.class));
        if (ids.length > 0) drawAll(context, manager, ids);
    }

    private static void drawAll(Context context, AppWidgetManager manager, int[] ids) {
        try {
            RemoteViews views = viewsOf(context);
            for (int id : ids) manager.updateAppWidget(id, views);
        } catch (Throwable ignored) {
            // A widget that cannot draw keeps what it showed; the app is untouched.
        }
    }

    private static RemoteViews viewsOf(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_spend);
        JSONObject state = null;
        try {
            String raw = prefs.getString(KEY_STATE, null);
            if (raw != null) state = new JSONObject(raw);
        } catch (Throwable ignored) { /* drawn as never opened */ }

        int white = Color.parseColor("#EEF2F9");
        int red = Color.parseColor("#FF6B6B");

        if (state == null) {
            // Never handed anything: the app has not been opened since installing.
            views.setTextViewText(R.id.widget_label, context.getString(R.string.widget_title));
            views.setTextViewText(R.id.widget_figure, "—");
            views.setTextColor(R.id.widget_figure, white);
            views.setTextViewText(R.id.widget_line, context.getString(R.string.widget_open));
            views.setViewVisibility(R.id.widget_eye, View.GONE);
        } else {
            String mode = state.optString("mode", "none");
            boolean shown = prefs.getBoolean(KEY_SHOWN, true);
            boolean stale = mode.equals("ok") && today().compareTo(state.optString("monthEnd", "")) > 0;
            String label = state.optString(mode.equals("over") ? "overTitle" : "title");
            String figure;
            String line;
            int color = white;
            if (mode.equals("none") || stale) {
                figure = "—";
                line = state.optString(stale ? "stale" : "none");
            } else if (mode.equals("over")) {
                figure = state.optString("overFigure");
                line = state.optString("overLine");
                color = red;
            } else {
                long perDay = perDayOf(state.optLong("leftMinor"), daysLeft(state.optString("monthEnd")));
                figure = money(perDay, state.optString("symbol", "$"), state.optString("sep", "."));
                line = state.optString("line");
            }
            boolean money = !(mode.equals("none") || stale);
            if (money && !shown) {
                figure = "••••••";
                line = state.optString("hiddenLine");
                color = white;
            }
            views.setTextViewText(R.id.widget_label, label);
            views.setTextViewText(R.id.widget_figure, figure);
            views.setTextColor(R.id.widget_figure, color);
            views.setTextViewText(R.id.widget_line, line);
            views.setViewVisibility(R.id.widget_eye, money ? View.VISIBLE : View.GONE);
            views.setImageViewResource(R.id.widget_eye, shown ? R.drawable.ic_widget_eye : R.drawable.ic_widget_eye_off);
            views.setContentDescription(R.id.widget_eye, state.optString(shown ? "hide" : "show"));
            views.setTextViewText(R.id.widget_expense, state.optString("expense", "Gasto"));
            views.setTextViewText(R.id.widget_income, state.optString("income", "Ingreso"));
            views.setContentDescription(R.id.widget_assistant, state.optString("assistant", "Asistente"));
        }

        views.setOnClickPendingIntent(R.id.widget_body, open(context, null, 40));
        views.setOnClickPendingIntent(R.id.widget_expense, open(context, "expense", 41));
        views.setOnClickPendingIntent(R.id.widget_income, open(context, "income", 42));
        views.setOnClickPendingIntent(R.id.widget_assistant, open(context, "assistant", 43));
        Intent eye = new Intent(context, SpendWidget.class).setAction(ACTION_EYE);
        views.setOnClickPendingIntent(R.id.widget_eye, PendingIntent.getBroadcast(context, 44, eye,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return views;
    }

    /** Opens the app; with a shortcut's id, as the icon's long press does. */
    private static PendingIntent open(Context context, String shortcut, int code) {
        Intent intent = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (shortcut != null) intent.putExtra(ShortcutsPlugin.EXTRA_SHORTCUT, shortcut);
        return PendingIntent.getActivity(context, code, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** As `perDayOf` in spend-room.ts: whole hundreds of pesos, never below 0. */
    static long perDayOf(long minor, long days) {
        if (minor <= 0 || days <= 0) return 0;
        return (minor / days / 10_000) * 10_000;
    }

    /** Days from today to the month's last day, both counted. */
    static long daysLeft(String monthEnd) {
        if (monthEnd == null || monthEnd.length() < 10) return 0;
        Calendar now = Calendar.getInstance();
        int y = Integer.parseInt(monthEnd.substring(0, 4));
        int m = Integer.parseInt(monthEnd.substring(5, 7));
        int d = Integer.parseInt(monthEnd.substring(8, 10));
        if (now.get(Calendar.YEAR) != y || now.get(Calendar.MONTH) + 1 != m) return 0;
        return d - now.get(Calendar.DAY_OF_MONTH) + 1;
    }

    /** "$ 54.000": whole pesos, grouped by the app's own separator. */
    static String money(long minor, String symbol, String sep) {
        String digits = Long.toString(Math.abs(minor / 100));
        StringBuilder grouped = new StringBuilder();
        for (int at = 0; at < digits.length(); at++) {
            if (at > 0 && (digits.length() - at) % 3 == 0) grouped.append(sep);
            grouped.append(digits.charAt(at));
        }
        return (minor < 0 ? "−" : "") + symbol + " " + grouped;
    }

    private static String today() {
        Calendar now = Calendar.getInstance();
        return String.format(java.util.Locale.ROOT, "%04d-%02d-%02d",
                now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
    }
}
