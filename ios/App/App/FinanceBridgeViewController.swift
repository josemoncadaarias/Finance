import UIKit
import Capacitor

/// The app's web view, with the plugins written for this app registered.
///
/// Android finds its own plugins by annotation; on iOS a plugin that lives in
/// the app (not in a package) is handed to the bridge here. Each one answers
/// under the same name as its Java twin, so the TypeScript does not change
/// (CLAUDE.md, "iOS: what each feature would be on an iPhone").
class FinanceBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(OcrPlugin())
        bridge?.registerPluginInstance(SpeechPlugin())
        bridge?.registerPluginInstance(ShortcutsPlugin())
    }
}
