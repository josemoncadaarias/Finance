import Foundation
import UserNotifications

/// What the iPhone's Shortcuts hand the app: a bank's SMS, or a payment made
/// with Apple Pay. The iPhone's stand-in for what Android's
/// `NotificationCatcher` keeps.
///
/// iOS lets no app read another app's notifications, so the person makes a
/// personal automation in Shortcuts ("When I get a message from {bank}",
/// "When I tap {card}") that calls one of the app's own intents
/// (`FinanceIntents.swift`). The intent writes the raw words here, nothing read
/// into them, in the shape `CaughtNotification` has in TypeScript; the app
/// reads them on its next pass (`MessageInboxPlugin.caught`) and the same
/// reading, molds and Por revisar take over. Nothing is ever saved as a
/// movement from here (rule 22).
enum MessageInbox {
    private static let key = "finance.shortcutInbox"
    /// The same package the Android SMS inbox speaks under, so a sender's
    /// source, its batch and what it taught are the same on both phones.
    static let smsPackage = "sms"
    static let payPackage = "applepay"
    /// Kept for a month, at most this many: the app reads them within days.
    private static let keepDays: Double = 31
    private static let keepAtMost = 300

    static func keep(package: String, app: String, sender: String?, text: String) {
        let words = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !words.isEmpty else { return }
        let now = Date().timeIntervalSince1970 * 1000
        var all = read().filter { now - (($0["postedAt"] as? Double) ?? 0) < keepDays * 86_400_000 }
        var one: [String: Any] = ["package": package, "app": app, "title": sender ?? app, "text": words, "postedAt": now]
        if let sender = sender, !sender.isEmpty { one["sender"] = sender }
        all.append(one)
        if all.count > keepAtMost { all.removeFirst(all.count - keepAtMost) }
        UserDefaults.standard.set(all, forKey: key)
    }

    static func read() -> [[String: Any]] {
        UserDefaults.standard.array(forKey: key) as? [[String: Any]] ?? []
    }

    static func forget() {
        UserDefaults.standard.removeObject(forKey: key)
    }

    /// "Movimiento detectado" on the phone, as on Android: nothing saved, a
    /// tap opens the app, which reads the message into Por revisar. Only when
    /// the person has allowed Finance's notices; otherwise the message still
    /// waits for the next opening.
    static func ring(title: String, body: String) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            content.threadIdentifier = "movements"
            let request = UNNotificationRequest(identifier: "movement-\(Date().timeIntervalSince1970)", content: content, trigger: nil)
            center.add(request)
        }
    }
}
