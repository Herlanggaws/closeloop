import Foundation

/// One report as sent to `POST /v1/ingest/reports`.
public struct ReportPayload: Codable, Equatable {
    public static let types = ["bug", "idea", "question"]

    public var id: String
    public var type: String
    public var message: String
    public var platform: String
    public var userId: String?
    public var email: String?
    public var appVersion: String?
    public var context: [String: String]
    public var createdAt: Date

    public init(
        id: String = UUID().uuidString,
        type: String,
        message: String,
        platform: String = "ios",
        userId: String? = nil,
        email: String? = nil,
        appVersion: String? = nil,
        context: [String: String] = [:],
        createdAt: Date = Date()
    ) throws {
        guard Self.types.contains(type) else { throw SaidloopError.invalidType(type) }
        self.id = id
        self.type = type
        self.message = message
        self.platform = platform
        self.userId = userId
        self.email = email
        self.appVersion = appVersion
        self.context = context
        self.createdAt = createdAt
    }

    /// Body for the ingest API (snake_case, nil fields left out).
    public func ingestBody() throws -> Data {
        var body: [String: Any] = ["type": type, "message": message, "platform": platform, "context": context]
        if let userId { body["user_id"] = userId }
        if let email { body["email"] = email }
        if let appVersion { body["app_version"] = appVersion }
        return try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
    }
}

public enum SaidloopError: Error, Equatable {
    case invalidType(String)
    case http(status: Int, body: String)
    case badResponse

    /// 4xx (except 408/429) won't succeed on retry.
    public var isPermanent: Bool {
        if case let .http(status, _) = self { return (400..<500).contains(status) && status != 408 && status != 429 }
        return self == .badResponse
    }
}

/// Offline queue on disk: `<id>.json` plus optional `<id>.png`. Oldest first.
public final class ReportQueue {
    private let dir: URL
    private let maxItems: Int
    private let fm = FileManager.default
    private let lock = NSLock()

    public init(directory: URL, maxItems: Int = 50) {
        dir = directory
        self.maxItems = maxItems
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    public func enqueue(_ report: ReportPayload, screenshot: Data?) throws {
        lock.lock(); defer { lock.unlock() }
        let pending = listUnlocked()
        if pending.count >= maxItems {
            pending.prefix(pending.count - maxItems + 1).forEach { removeUnlocked($0.id) }
        }
        if let screenshot { try screenshot.write(to: dir.appendingPathComponent("\(report.id).png"), options: .atomic) }
        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .millisecondsSince1970
        try enc.encode(report).write(to: dir.appendingPathComponent("\(report.id).json"), options: .atomic)
    }

    public func list() -> [ReportPayload] {
        lock.lock(); defer { lock.unlock() }
        return listUnlocked()
    }

    public func screenshot(id: String) -> Data? {
        try? Data(contentsOf: dir.appendingPathComponent("\(id).png"))
    }

    public func remove(_ id: String) {
        lock.lock(); defer { lock.unlock() }
        removeUnlocked(id)
    }

    public var count: Int { list().count }

    private func listUnlocked() -> [ReportPayload] {
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .millisecondsSince1970
        let files = (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "json" }
            .compactMap { try? dec.decode(ReportPayload.self, from: Data(contentsOf: $0)) }
            .sorted { $0.createdAt < $1.createdAt }
    }

    private func removeUnlocked(_ id: String) {
        try? fm.removeItem(at: dir.appendingPathComponent("\(id).json"))
        try? fm.removeItem(at: dir.appendingPathComponent("\(id).png"))
    }
}

/// Create report, upload screenshot, mark complete. Same calls the web widget makes.
public final class IngestClient {
    let api: URL
    let key: String
    let session: URLSession

    public init(api: URL, key: String, session: URLSession = .shared) {
        self.api = api
        self.key = key
        self.session = session
    }

    @discardableResult
    public func send(_ report: ReportPayload, screenshot: Data?) async throws -> String {
        let created = try await request("POST", api.appendingPathComponent("v1/ingest/reports"), body: report.ingestBody(), contentType: "application/json")
        guard let obj = try JSONSerialization.jsonObject(with: created) as? [String: Any],
              let reportId = obj["report_id"] as? String else { throw SaidloopError.badResponse }
        if let screenshot, let upload = obj["upload_url"] as? String, let url = URL(string: upload) {
            _ = try await request("PUT", url, body: screenshot, contentType: "image/png")
        }
        _ = try await request("POST", api.appendingPathComponent("v1/ingest/reports/\(reportId)/complete"), body: Data(), contentType: "application/json")
        return (obj["ticket_id"] as? String) ?? reportId
    }

    private func request(_ method: String, _ url: URL, body: Data, contentType: String) async throws -> Data {
        var req = URLRequest(url: url, timeoutInterval: 30)
        req.httpMethod = method
        req.setValue(key, forHTTPHeaderField: "X-Closeloop-Key")
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        req.httpBody = body
        let (data, resp) = try await session.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw SaidloopError.http(status: status, body: String(data: data, encoding: .utf8) ?? "")
        }
        return data
    }
}

/// Sends everything in the queue; drops reports the API rejects for good.
public enum QueueFlusher {
    /// Returns true when the queue is empty afterwards.
    @discardableResult
    public static func flush(queue: ReportQueue, client: IngestClient) async -> Bool {
        var pendingLeft = false
        for report in queue.list() {
            do {
                try await client.send(report, screenshot: queue.screenshot(id: report.id))
                queue.remove(report.id)
            } catch let e as SaidloopError where e.isPermanent {
                queue.remove(report.id)
            } catch {
                pendingLeft = true
            }
        }
        return !pendingLeft
    }
}

/// A few strong jolts within a short window, with a cooldown. Accelerations in g.
public final class ShakeDetector {
    private let threshold: Double
    private let window: TimeInterval
    private let jolts: Int
    private let cooldown: TimeInterval
    private var hits: [TimeInterval] = []
    private var lastFired: TimeInterval = -.infinity
    private let onShake: () -> Void

    public init(threshold: Double = 2.7, window: TimeInterval = 0.6, jolts: Int = 3, cooldown: TimeInterval = 1.5, onShake: @escaping () -> Void) {
        self.threshold = threshold
        self.window = window
        self.jolts = jolts
        self.cooldown = cooldown
        self.onShake = onShake
    }

    @discardableResult
    public func sample(x: Double, y: Double, z: Double, at time: TimeInterval) -> Bool {
        let g = (x * x + y * y + z * z).squareRoot()
        guard g >= threshold, time - lastFired >= cooldown else { return false }
        hits.append(time)
        hits.removeAll { time - $0 > window }
        guard hits.count >= jolts else { return false }
        hits.removeAll()
        lastFired = time
        onShake()
        return true
    }
}
