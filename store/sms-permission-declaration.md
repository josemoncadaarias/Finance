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

**Video demonstration (required):** record on the phone: Más → Notificaciones
del teléfono → "Permitir leer los SMS" → Android's dialog → tick the bank's
sender → a bank SMS arrives → the
"Movimiento detectado" notification appears → tap Revisar → open the app → Movimientos por revisar shows
the proposal → accept it. Upload it (unlisted YouTube or Drive link).
