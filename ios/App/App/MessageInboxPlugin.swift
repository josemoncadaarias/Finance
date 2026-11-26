import Foundation
import Capacitor

/// Hands the app what the Shortcuts' intents kept (`MessageInbox`), in the
/// shape of Android's `BankNotifications.caught`, so `NoticeInboxService`
/// reads both phones the same way.
@objc(MessageInboxPlugin)
public class MessageInboxPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MessageInboxPlugin"
    public let jsName = "MessageInbox"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "caught", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeOpen", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        // A tap while the app runs: the app is told at once ("asked").
        NotificationCenter.default.addObserver(forName: NotificationTaps.tapped, object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("asked", data: [:], retainUntilConsumed: true)
        }
    }

    /// What a tapped "Movimiento detectado" asked to open, once; '' otherwise.
    @objc func takeOpen(_ call: CAPPluginCall) {
        let open = MessageInbox.asked ?? ""
        MessageInbox.asked = nil
        call.resolve(["open": open])
    }

    @objc func caught(_ call: CAPPluginCall) {
        call.resolve(["caught": MessageInbox.read()])
    }

    @objc func forget(_ call: CAPPluginCall) {
        MessageInbox.forget()
        call.resolve()
    }
}
