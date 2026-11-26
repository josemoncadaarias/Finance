import Foundation
import UserNotifications

/// Hears a tap on "Movimiento detectado" (`MessageInbox.ring`) so the app opens
/// that movement in Por revisar, as Android's notice does
/// (`NoticeInboxService.takeOpen`).
///
/// Capacitor's own router is the notification centre's delegate and hands
/// every notice to the local-notifications plugin (reminders, a card's
/// payment day). This stands in front of it: it notes what one of ours asked
/// to open, then passes everything on unchanged, so no other notice changes.
final class NotificationTaps: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationTaps()
    /// Said when a notice of ours was tapped, for `MessageInboxPlugin`.
    static let tapped = Notification.Name("finance.noticeTapped")

    private weak var next: UNUserNotificationCenterDelegate?

    /// Called once the bridge has set Capacitor's router as the delegate.
    func standInFront() {
        let center = UNUserNotificationCenter.current()
        guard center.delegate !== self else { return }
        next = center.delegate
        center.delegate = self
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        if let next = next, next.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
            next.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            completionHandler([.banner, .sound])
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        if response.actionIdentifier == UNNotificationDefaultActionIdentifier,
           let open = response.notification.request.content.userInfo[MessageInbox.openKey] as? String {
            MessageInbox.asked = open
            NotificationCenter.default.post(name: NotificationTaps.tapped, object: nil)
        }
        if let next = next, next.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
            next.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }
}
