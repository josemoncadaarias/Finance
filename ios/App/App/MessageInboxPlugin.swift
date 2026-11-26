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
    ]

    @objc func caught(_ call: CAPPluginCall) {
        call.resolve(["caught": MessageInbox.read()])
    }

    @objc func forget(_ call: CAPPluginCall) {
        MessageInbox.forget()
        call.resolve()
    }
}
