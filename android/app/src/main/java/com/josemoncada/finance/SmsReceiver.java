package com.josemoncada.finance;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/**
 * An SMS the moment it arrives, so "Movimiento detectado" rings without
 * waiting for the app to be opened (Jose, 2026-10-08). Only for senders the
 * person ticked; nothing is stored here - the words are read again from the
 * inbox when the app opens (`SmsInbox`), and only a notice is posted.
 */
public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        // An SMS wakes the app: a good moment to bring the listener back.
        NotificationCatcher.ensureBound(context);
        SmsMessage[] parts;
        try {
            parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        } catch (Exception unreadable) {
            return;
        }
        if (parts == null || parts.length == 0 || parts[0] == null) return;
        String sender = parts[0].getOriginatingAddress();
        if (sender == null) return;
        sender = sender.trim();
        if (!SmsInbox.isWatched(context, sender)) return;
        StringBuilder body = new StringBuilder();
        for (SmsMessage part : parts) if (part != null && part.getMessageBody() != null) body.append(part.getMessageBody());
        try {
            MovementAlert.post(context, SmsInbox.PACKAGE + "|" + sender, sender, body.toString(), System.currentTimeMillis());
        } catch (Throwable error) {
            NotificationStore.noteError(context, error);
        }
    }
}
