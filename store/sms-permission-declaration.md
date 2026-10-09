# Play Console: Permissions Declaration Form for READ_SMS and RECEIVE_SMS

Where: Play Console → Finance → Policy and programs → App content →
Sensitive permissions (or the prompt Play shows when a bundle declaring
`READ_SMS`/`RECEIVE_SMS` is uploaded). Answers to paste, in English (Play reviews in
English). Privacy policy: https://jadexlabs-finance.netlify.app/privacy.html

## Core functionality
**Category / exception:** SMS-based money management (apps that track and
manage budget).

**Describe the core functionality that requires this permission:**

Finance is a personal finance app that keeps the user's accounts, income and
expenses on their own phone. Many banks in Colombia notify every card
purchase, transfer and payment only by SMS. The user chooses, inside the app,
which senders are their banks (for example a bank's short code). For those
senders only, the app reads the SMS from the inbox and proposes the movement
(amount, merchant, date) in a review screen; nothing is recorded until the
user accepts it. When such an SMS arrives, the app shows a local notification so the user
can review it right away. This is the app's core budgeting flow: recording
movements without typing each one by hand.

**Why is the permission necessary / why can't an alternative be used?**

The app first tried notification access, but on many phones the messaging app
does not hand its notifications to other apps, so bank SMS never reach the
app. The SMS Retriever / User Consent APIs only work for one-time codes sent
to the app by its own server and cannot read messages a bank sends. Reading
the inbox is the only way to see the bank's message.

**How is the data used / shared?**

- Only messages from senders the user explicitly selected are read; the list
  of selectable senders is built from the sender address only and only shows
  short codes or alphanumeric senders, never personal phone numbers.
- Messages are processed on the device. The app has no server; no SMS
  content is transmitted, shared, sold or used for advertising.
- The user can deselect a sender, delete what was read, or revoke the
  permission at any time.
- RECEIVE_SMS is used only to notice, the moment it arrives, that a selected
  bank sender wrote; the app then shows a local notification ("Movement
  detected - review it?"). Nothing is recorded until the user opens the app
  and accepts it. Messages from any other sender are ignored and not stored.
- The app does not send SMS.

**Video demonstration (required).** One recording on the phone, about a
minute, used for this form and for the foreground-service one below:

1. Before recording: Android Settings → Apps → Finance → Permissions → SMS →
   "Don't allow" (so the request shows on camera), and switch off the bank
   sender you will use (e.g. Bold's short code) in Notificaciones del
   teléfono.
2. Start the phone's screen recorder.
3. Finance → Más → Notificaciones del teléfono → "Permitir leer los SMS" →
   Android's dialog → Allow.
4. In "SMS con dinero sin activar", switch on the bank's sender and answer
   "¿De qué cuenta es?".
5. Switch on "Avisarme siempre al instante", open "¿Qué cambia?", and pull
   down the status bar to show "Finance está atenta a tus bancos".
6. Leave the app, make a small real purchase or transfer with that bank,
   and wait for its SMS: "Movimiento detectado" appears.
7. Tap "Revisar y guardar": Movimientos por revisar opens on the proposal;
   save it.
8. Stop recording. Upload to YouTube as Unlisted (or Drive, anyone with the
   link) and paste the link in both forms.

# Play Console: foreground service declaration (special use)

Where: Play Console → Finance → Policy and programs → App content →
Foreground service permissions. Type: **Special use**
(`FOREGROUND_SERVICE_SPECIAL_USE`).

**Describe the feature that uses this foreground service:**

"Always tell me at once" ("Avisarme siempre al instante") is an optional
switch, off by default, on the app's notification screen. When the user
turns it on, the app keeps a silent, minimum-importance ongoing notification
("Finance is watching for your banks"). Its only purpose is to keep the app's
NotificationListenerService - which the user enabled to read their banks'
notifications - from being closed by the phone's battery management, so a
bank's notification is turned into a "Movement detected - review it?" notice
the moment it arrives. The service does no work of its own: no network, no
location, no media; it only keeps the listener bound.

**Why can't another API be used?** WorkManager and alarms run minutes late
(the app already uses an inexact 15-minute alarm as the fallback when the
switch is off). The user-visible notice of a bank movement is only useful
when it is immediate, and the listener can only be kept alive by the app's
process staying alive.

**User impact if deferred or interrupted:** the user is told of a bank
movement minutes late or only when opening the app; nothing is lost - the
movement still waits in the review screen.

**Video:** the same link as above (step 5 shows the switch and the notice).
