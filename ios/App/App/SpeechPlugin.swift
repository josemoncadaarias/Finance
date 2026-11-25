import AVFoundation
import Speech
import Capacitor

/// The phone's own dictation for the assistant - the iPhone twin of
/// `SpeechPlugin.java`.
///
/// iOS has no system "speak now" screen to hand the listening to, so the app
/// listens itself with Apple's Speech framework: it asks for the microphone and
/// speech recognition the first time, keeps no audio, and stops on its own
/// after a short silence (or 20 seconds), handing back what it heard. On
/// device when the phone has the language's model; otherwise Apple's servers
/// hear it, which the privacy policy says.
@objc(SpeechPlugin)
public class SpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechPlugin"
    public let jsName = "Speech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listen", returnType: CAPPluginReturnPromise),
    ]

    /// Silence after speech that ends the listening.
    private let quietAfter: TimeInterval = 1.6
    /// Nothing said at all: give up.
    private let nothingAfter: TimeInterval = 7
    /// The longest a sentence may take.
    private let longest: TimeInterval = 20

    private let engine = AVAudioEngine()
    private var task: SFSpeechRecognitionTask?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var call: CAPPluginCall?
    private var heard = ""
    private var quietTimer: Timer?
    private var longestTimer: Timer?

    @objc func available(_ call: CAPPluginCall) {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "es-CO")) ?? SFSpeechRecognizer()
        call.resolve(["available": recognizer != nil])
    }

    @objc func listen(_ call: CAPPluginCall) {
        let language = call.getString("language") ?? "es-CO"
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                call.reject("denied")
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { allowed in
                DispatchQueue.main.async {
                    guard allowed else {
                        call.reject("denied")
                        return
                    }
                    self.start(call, language: language)
                }
            }
        }
    }

    private func start(_ call: CAPPluginCall, language: String) {
        finish() // a listening still open answers with what it had
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)), recognizer.isAvailable else {
            call.reject("unavailable")
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }

            let input = engine.inputNode
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in
                request.append(buffer)
            }
            engine.prepare()
            try engine.start()

            self.call = call
            self.request = request
            self.heard = ""
            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self = self, self.call != nil else { return }
                    if let result = result {
                        self.heard = result.bestTranscription.formattedString
                        self.waitQuiet(self.quietAfter)
                        if result.isFinal { self.finish() }
                    } else if error != nil {
                        self.finish()
                    }
                }
            }
            waitQuiet(nothingAfter)
            longestTimer = Timer.scheduledTimer(withTimeInterval: longest, repeats: false) { [weak self] _ in self?.finish() }
        } catch {
            stopAudio()
            call.reject("unavailable")
        }
    }

    private func waitQuiet(_ seconds: TimeInterval) {
        quietTimer?.invalidate()
        quietTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in self?.finish() }
    }

    /// Stops listening and answers the waiting call with what was heard.
    private func finish() {
        guard let call = call else { return }
        self.call = nil
        stopAudio()
        call.resolve(["text": heard])
    }

    private func stopAudio() {
        quietTimer?.invalidate()
        longestTimer?.invalidate()
        quietTimer = nil
        longestTimer = nil
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
