import AppIntents
import Foundation

/// The two actions Finance offers in Apple's Shortcuts app, for the person's
/// own automations (CLAUDE.md, "iOS"): a bank's SMS ("Mensaje" trigger) and a
/// payment with Apple Pay ("Transacción" trigger, iOS 17). Each one only keeps
/// the words for the app to read (`MessageInbox`); nothing is saved as a
/// movement until the person answers it in Por revisar (rule 22).
///
/// Written in Spanish, the app's own first language: Shortcuts shows an
/// intent's title as the app gives it.

@available(iOS 16.0, *)
struct RecordMessageIntent: AppIntent {
    static var title: LocalizedStringResource = "Registrar un mensaje del banco en Finance"
    static var description = IntentDescription("Guarda el texto de un SMS de tu banco para revisarlo en Movimientos por revisar. Finance no guarda nada como movimiento sin que tú lo apruebes.")
    static var openAppWhenRun = false

    @Parameter(title: "Mensaje")
    var message: String

    @Parameter(title: "Remitente")
    var sender: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Registrar \(\.$message) de \(\.$sender) en Finance")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let open = MessageInbox.keep(package: MessageInbox.smsPackage, app: "Mensajes", sender: sender, text: message)
        MessageInbox.ring(title: "Movimiento detectado", body: "Revísalo en Movimientos por revisar de Finance.", open: open)
        return .result(dialog: "Listo. Quedó en Movimientos por revisar de Finance.")
    }
}

@available(iOS 16.0, *)
struct RecordPaymentIntent: AppIntent {
    static var title: LocalizedStringResource = "Registrar un pago con Apple Pay en Finance"
    static var description = IntentDescription("Guarda una compra hecha con Apple Pay (el comercio, el valor y la tarjeta) para revisarla en Movimientos por revisar. Finance no guarda nada como movimiento sin que tú lo apruebes.")
    static var openAppWhenRun = false

    @Parameter(title: "Comercio")
    var merchant: String

    @Parameter(title: "Valor")
    var amount: String

    @Parameter(title: "Tarjeta")
    var card: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Registrar el pago de \(\.$amount) en \(\.$merchant) con \(\.$card) en Finance")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let text = PaymentWords.sentence(merchant: merchant, amount: amount, card: card)
        let open = MessageInbox.keep(package: MessageInbox.payPackage, app: "Apple Pay", sender: card, text: text)
        MessageInbox.ring(title: "Gasto detectado", body: "\(merchant) · \(amount). Revísalo en Movimientos por revisar de Finance.", open: open)
        return .result(dialog: "Listo. Quedó en Movimientos por revisar de Finance.")
    }
}

/// A payment said in the words a bank's message uses, so the app's one
/// reading (`readNotice`) takes it as money that went out: the shop after
/// "en", the amount with its currency sign.
enum PaymentWords {
    static func sentence(merchant: String, amount: String, card: String?) -> String {
        var figure = amount.trimmingCharacters(in: .whitespacesAndNewlines)
        // Shortcuts may hand a bare number; a figure with no sign is no money to the reader.
        if let first = figure.first, first.isNumber { figure = "$ " + figure }
        var words = "Compraste en \(merchant.trimmingCharacters(in: .whitespacesAndNewlines)) por \(figure)"
        if let card = card?.trimmingCharacters(in: .whitespacesAndNewlines), !card.isEmpty {
            words += " con tu tarjeta \(card)"
        }
        return words + " con Apple Pay."
    }
}

@available(iOS 16.0, *)
struct FinanceShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: RecordMessageIntent(),
            phrases: ["Registrar un mensaje del banco en \(.applicationName)"]
        )
        AppShortcut(
            intent: RecordPaymentIntent(),
            phrases: ["Registrar un pago en \(.applicationName)"]
        )
    }
}
