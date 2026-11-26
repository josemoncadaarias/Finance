# Getting Finance onto a real iPhone (TestFlight)

What is ready in the repository (2026-11-26), and what only Jose can do.
**These steps are given to Jose one at a time, waiting for his screenshot
before the next** (CLAUDE.md, "About the user"). This file is the list, not a
message to send whole.

## Ready, nothing to do

- `ios/` builds for the simulator ("iOS simulator" workflow) and for a real
  iPhone in Release ("iOS TestFlight" workflow, unsigned while there are no
  keys - it proves the phone build compiles).
- Bundle id `com.jadexlabs.finance` (the same as Android's), version 1.0,
  build number = the workflow's run number, iPhone only (no iPad, so the store
  asks for no iPad screenshots), iOS 15 or later.
- What App Store Connect checks on upload: the privacy manifest
  (`PrivacyInfo.xcprivacy`: no tracking, nothing collected, UserDefaults with
  reason CA92.1), `ITSAppUsesNonExemptEncryption = false` (only HTTPS, so no
  export-compliance question per build), the reason for every permission
  (microphone, speech, camera), a 64-bit app. Held by `device.test.mjs`.
- The privacy policy (`site/privacy.html`) has a section "En iPhone"
  (Apple's Speech and Vision, Shortcuts) and Apple among the providers.
- Signing: automatic, made by Xcode on GitHub's Mac with an App Store Connect
  API key. No certificate or profile is kept anywhere.

## What Jose does, in this order (from memory, to confirm on each page)

1. **Join the Apple Developer Program** - developer.apple.com/programs,
   US$99 a year, with his Apple ID (2-factor authentication on). As an
   individual his own name is shown as the seller on the App Store; as an
   organization ("Jadex Labs") Apple asks for a D-U-N-S number, which a
   Colombian company can request for free but takes days. Apple's approval
   can take up to 48 hours.
2. **Register the app's id** - developer.apple.com → Certificates,
   Identifiers & Profiles → Identifiers → "+" → App IDs → App → description
   "Finance", Bundle ID explicit `com.jadexlabs.finance`. No capability needs
   ticking (notices are local, the Shortcuts actions need none).
3. **Create the app in App Store Connect** - appstoreconnect.apple.com →
   Apps → "+" → New App: iOS, name "Finance: gastos y rendimientos" (the name
   must be free on the whole App Store; Play's listing name), primary language
   Spanish (Mexico or Spain - there is no Colombia option, assumed), the
   bundle id of step 2, SKU `finance-ios`, full access.
4. **An API key for GitHub** - App Store Connect → Users and Access →
   Integrations → App Store Connect API → Team Keys → "+": name "GitHub",
   access **Admin** (needed to make the certificate). Download the `.p8` (it
   can be downloaded ONCE), and note the Key ID and the Issuer ID shown on
   that page.
5. **The Team ID** - developer.apple.com → Account → Membership details →
   Team ID (10 characters).
6. **Four secrets in GitHub** - the repository → Settings → Secrets and
   variables → Actions → New repository secret:
   `APPLE_TEAM_ID`, `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID` and
   `APPSTORE_API_KEY_P8` (the `.p8` file's whole text, or its base64).
7. **Run "iOS TestFlight"** - Actions → iOS TestFlight → Run workflow on
   `main`. It signs and uploads; App Store Connect takes 10-30 minutes to
   process the build, and emails when it is ready.
8. **TestFlight** - App Store Connect → the app → TestFlight → Internal
   Testing → "+" a group, add the testers (internal testers must be users of
   his App Store Connect team, up to 100; anybody else is an external tester,
   whose first build Apple reviews, usually within a day). Each tester
   installs the TestFlight app on the iPhone and accepts the invitation.

## Still Android only on the iPhone, and what each needs

- **Google sign-in and the Drive copy**: an iOS OAuth client in Google Cloud
  project 76504816542 (Credentials → Create → OAuth client ID → iOS, bundle id
  `com.jadexlabs.finance`) - free, no Apple account needed - then its id in
  `environment*.ts`, its reversed id as a URL scheme in `Info.plist`, and the
  Drive token on iOS (Android's `DriveAuthPlugin` is Java). Until then the app
  hides Google on iOS and backups go to a file.
- **Finance Pro**: the subscription made again in App Store Connect and its
  products in RevenueCat with an iOS key. Until then the iPhone app is open,
  as a browser is (`DEVICE.storePurchases` false).
- **The home-screen widget** (WidgetKit) and **stock alerts with the app
  closed** (iOS decides when an app wakes).

## What only a real iPhone can prove

The Shortcuts automations (Message, Transaction) firing and a tapped notice
opening its movement; Apple Pay at a till; the camera and voice; reminders
ringing; how the screens read with Dynamic Type; a backup from Android
restored on iOS's own SQLite.
