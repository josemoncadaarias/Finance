package com.josemoncada.finance;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The notice's "Descartar", answered without opening the app. */
public class MovementAlertReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && MovementAlert.ACTION_DISMISS.equals(intent.getAction())) {
            MovementAlert.dismissAll(context);
        }
    }
}
