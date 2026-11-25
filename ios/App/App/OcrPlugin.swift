import UIKit
import Vision
import Capacitor

/// The text of a photo or a screenshot (receipts, statements, a position),
/// read on the phone by Apple's Vision - the iPhone twin of `OcrPlugin.java`.
///
/// Nothing leaves the phone and nothing is paid per use. The app hands over the
/// image already turned upright and shrunk, as JPEG in base64, and gets back
/// each line with its box in the image's pixels (top-left origin), the shape
/// `ocr-items.ts` lays out for the statement reader.
@objc(OcrPlugin)
public class OcrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OcrPlugin"
    public let jsName = "Ocr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
    ]

    @objc func read(_ call: CAPPluginCall) {
        guard let data = call.getString("image"), !data.isEmpty else {
            call.reject("no image")
            return
        }
        guard let bytes = Data(base64Encoded: data, options: .ignoreUnknownCharacters),
              let image = UIImage(data: bytes),
              let cgImage = image.cgImage else {
            call.reject("unreadable image")
            return
        }
        let width = Double(cgImage.width)
        let height = Double(cgImage.height)

        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                call.reject("failed: \(error.localizedDescription)")
                return
            }
            var lines: [[String: Any]] = []
            for case let observation as VNRecognizedTextObservation in request.results ?? [] {
                guard let best = observation.topCandidates(1).first else { continue }
                // Vision's box is normalized, with its origin at the bottom left.
                let box = observation.boundingBox
                lines.append([
                    "text": best.string,
                    "left": Int((box.minX * width).rounded()),
                    "top": Int(((1 - box.maxY) * height).rounded()),
                    "right": Int((box.maxX * width).rounded()),
                    "bottom": Int(((1 - box.minY) * height).rounded()),
                ])
            }
            call.resolve(["width": Int(width), "height": Int(height), "lines": lines])
        }
        request.recognitionLevel = .accurate
        // Figures are money: no word correction turning a digit into a letter.
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["es-ES", "en-US"]

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
            } catch {
                call.reject("failed: \(error.localizedDescription)")
            }
        }
    }
}
