import UIKit
import Capacitor

/// The quick actions a long press on the app's icon shows (a new spending, a
/// new income, the assistant, Por revisar) - the iPhone twin of
/// `ShortcutsPlugin.java`.
///
/// Set from the app on every opening and change of language, so their words
/// are the app's. The one tapped is kept until the app takes it (`take`), as on
/// Android; `SceneDelegate` hands it over.
@objc(ShortcutsPlugin)
public class ShortcutsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShortcutsPlugin"
    public let jsName = "Shortcuts"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "take", returnType: CAPPluginReturnPromise),
    ]

    /// The shortcut the app was opened from, until the app takes it.
    static var asked: String?

    @objc func set(_ call: CAPPluginCall) {
        let items = call.getArray("items", JSObject.self) ?? []
        let shortcuts: [UIApplicationShortcutItem] = items.compactMap { item in
            guard let id = item["id"] as? String, let short = item["short"] as? String else { return nil }
            return UIApplicationShortcutItem(
                type: id,
                localizedTitle: short,
                localizedSubtitle: nil,
                icon: UIApplicationShortcutIcon(systemImageName: ShortcutsPlugin.symbolOf(id)),
                userInfo: nil
            )
        }
        DispatchQueue.main.async {
            UIApplication.shared.shortcutItems = shortcuts
            call.resolve()
        }
    }

    @objc func take(_ call: CAPPluginCall) {
        let id = ShortcutsPlugin.asked ?? ""
        ShortcutsPlugin.asked = nil
        call.resolve(["id": id])
    }

    private static func symbolOf(_ id: String) -> String {
        switch id {
        case "income": return "arrow.down.circle"
        case "assistant": return "sparkles"
        case "review": return "tray.full"
        default: return "arrow.up.circle"
        }
    }
}
