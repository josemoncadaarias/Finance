package com.josemoncada.finance;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The notice's "No es movimiento", "Descartar todos" and "Más tarde", answered without opening the app. */
public class MovementAlertReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && MovementAlert.ACTION_DISMISS.equals(intent.getAction())) {
            MovementAlert.dismissAll(context);
        } else if (intent != null && MovementAlert.ACTION_NOT_MOVEMENT.equals(intent.getAction())) {
            MovementAlert.notMovement(context);
        } else if (intent != null && MovementAlert.ACTION_LATER.equals(intent.getAction())) {
            MovementAlert.later(context);
        }
    }
}
