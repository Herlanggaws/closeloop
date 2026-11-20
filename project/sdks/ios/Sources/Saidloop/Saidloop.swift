#if canImport(UIKit)
import CoreMotion
import Network
import SaidloopCore
import UIKit

/// Saidloop iOS SDK.
///
/// ```swift
/// Saidloop.start(key: "pk_…", api: URL(string: "https://<your API host>")!)
/// Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1")
/// Saidloop.show() // or shake the phone
/// balanceLabel.closeloopMask = true
/// ```
@MainActor
public enum Saidloop {
    public static let defaultAPI = URL(string: "https://api.saidloop.com")!

    struct Config {
        var key: String
        var api: URL
        var userId: String?
        var email: String?
        var appVersion: String?
        var maskTextInputs: Bool
        var shakeToReport: Bool
    }

    static var config: Config?
    static let motion = CMMotionManager()
    static var shake: ShakeDetector?
    static let pathMonitor = NWPathMonitor()
    static var lastScreenName: String?

    static var queue: ReportQueue = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return ReportQueue(directory: base.appendingPathComponent("saidloop-queue", isDirectory: true))
    }()

    public static func start(key: String, api: URL = defaultAPI, shakeToReport: Bool = true, maskTextInputs: Bool = true) {
        precondition(key.hasPrefix("pk_"), "Saidloop: use your project's public key (pk_…)")
        config = Config(key: key, api: api, maskTextInputs: maskTextInputs, shakeToReport: shakeToReport)
        if shakeToReport { startShake() }
        // Queued reports go out whenever the network comes back.
        pathMonitor.pathUpdateHandler = { path in
            if path.status == .satisfied { Task { @MainActor in flush() } }
        }
        pathMonitor.start(queue: DispatchQueue(label: "saidloop.path"))
        flush()
    }

    public static func identify(userId: String? = nil, email: String? = nil, appVersion: String? = nil) {
        if let userId { config?.userId = userId }
        if let email { config?.email = email }
        if let appVersion { config?.appVersion = appVersion }
    }

    /// Opens the report sheet with a masked screenshot of the current screen.
    public static func show() {
        guard let cfg = config, let top = topViewController(), !(top is ReportViewController) else { return }
        lastScreenName = String(describing: type(of: top))
        let shot = ScreenCapture.capture(maskTextInputs: cfg.maskTextInputs)
        let sheet = ReportViewController(screenshot: shot)
        if let presentation = sheet.sheetPresentationController {
            presentation.detents = [.medium(), .large()]
            presentation.prefersGrabberVisible = true
        }
        top.present(sheet, animated: true)
    }

    /// Queue the report and try to send it right away. Returns true if it went out now.
    static func submit(type: String, message: String, screenshot: Data?) async -> Bool {
        guard let cfg = config, let report = try? ReportPayload(
            type: type,
            message: message,
            userId: cfg.userId,
            email: cfg.email,
            appVersion: cfg.appVersion,
            context: deviceContext()
        ) else { return false }
        try? queue.enqueue(report, screenshot: screenshot)
        return await QueueFlusher.flush(queue: queue, client: IngestClient(api: cfg.api, key: cfg.key))
    }

    static func flush() {
        guard let cfg = config, queue.count > 0 else { return }
        let q = queue
        Task.detached { await QueueFlusher.flush(queue: q, client: IngestClient(api: cfg.api, key: cfg.key)) }
    }

    private static func deviceContext() -> [String: String] {
        let screen = UIScreen.main.bounds
        let scale = UIScreen.main.scale
        var ctx = [
            "os": "iOS \(UIDevice.current.systemVersion)",
            "device": UIDevice.current.model,
            "screen": "\(Int(screen.width * scale)) × \(Int(screen.height * scale))",
            "sdk": "ios/0.1.0",
        ]
        if let lastScreenName { ctx["screen_name"] = lastScreenName }
        return ctx
    }

    private static func startShake() {
        guard motion.isAccelerometerAvailable else { return }
        let detector = ShakeDetector { Task { @MainActor in show() } }
        shake = detector
        motion.accelerometerUpdateInterval = 1.0 / 30
        motion.startAccelerometerUpdates(to: .main) { data, _ in
            guard let a = data?.acceleration else { return }
            detector.sample(x: a.x, y: a.y, z: a.z, at: data?.timestamp ?? 0)
        }
    }

    static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? scenes.first?.windows.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
#endif
