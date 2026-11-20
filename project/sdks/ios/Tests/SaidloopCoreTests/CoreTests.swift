import XCTest
@testable import SaidloopCore

final class ReportPayloadTests: XCTestCase {
    func testIngestBodyMatchesTheAPI() throws {
        let r = try ReportPayload(type: "bug", message: "Save \"again\"", userId: "rina", appVersion: "2.4.1", context: ["os": "iOS 18"])
        let obj = try JSONSerialization.jsonObject(with: r.ingestBody()) as! [String: Any]
        XCTAssertEqual(obj["platform"] as? String, "ios")
        XCTAssertEqual(obj["user_id"] as? String, "rina")
        XCTAssertEqual(obj["app_version"] as? String, "2.4.1")
        XCTAssertNil(obj["email"], "nil fields are left out")
        XCTAssertEqual((obj["context"] as? [String: String])?["os"], "iOS 18")
    }

    func testRejectsUnknownType() {
        XCTAssertThrowsError(try ReportPayload(type: "rant", message: "hi"))
    }
}

final class ReportQueueTests: XCTestCase {
    private func tempQueue(max: Int = 50) -> ReportQueue {
        ReportQueue(directory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString), maxItems: max)
    }

    func testKeepsReportsAndScreenshotsUntilRemoved() throws {
        let q = tempQueue()
        try q.enqueue(ReportPayload(id: "b", type: "idea", message: "b", createdAt: Date(timeIntervalSince1970: 2)), screenshot: Data([1, 2, 3]))
        try q.enqueue(ReportPayload(id: "a", type: "idea", message: "a", createdAt: Date(timeIntervalSince1970: 1)), screenshot: nil)
        XCTAssertEqual(q.list().map(\.id), ["a", "b"])
        XCTAssertEqual(q.screenshot(id: "b")?.count, 3)
        q.remove("b")
        XCTAssertEqual(q.list().map(\.id), ["a"])
        XCTAssertNil(q.screenshot(id: "b"))
    }

    func testDropsOldestWhenFull() throws {
        let q = tempQueue(max: 2)
        for i in 1...3 {
            try q.enqueue(ReportPayload(id: "\(i)", type: "bug", message: "x", createdAt: Date(timeIntervalSince1970: Double(i))), screenshot: nil)
        }
        XCTAssertEqual(q.list().map(\.id), ["2", "3"])
    }
}

final class ShakeDetectorTests: XCTestCase {
    func testFiresAfterThreeJolts() {
        var fired = 0
        let d = ShakeDetector { fired += 1 }
        d.sample(x: 3.2, y: 0, z: 0, at: 0)
        d.sample(x: 3.2, y: 0, z: 0, at: 0.2)
        XCTAssertTrue(d.sample(x: 3.2, y: 0, z: 0, at: 0.4))
        XCTAssertEqual(fired, 1)
    }

    func testIgnoresSlowOrWeakMovement() {
        var fired = 0
        let d = ShakeDetector { fired += 1 }
        d.sample(x: 3.2, y: 0, z: 0, at: 0)
        d.sample(x: 3.2, y: 0, z: 0, at: 1)
        d.sample(x: 3.2, y: 0, z: 0, at: 2)
        d.sample(x: 1, y: 0, z: 0, at: 2.1)
        XCTAssertEqual(fired, 0)
    }

    func testCooldownStopsDoubleOpen() {
        var fired = 0
        let d = ShakeDetector { fired += 1 }
        for i in 0..<6 { d.sample(x: 3.2, y: 0, z: 0, at: Double(i) * 0.1) }
        XCTAssertEqual(fired, 1)
    }
}

final class FlushTests: XCTestCase {
    func testPermanentErrorsAreDropped() {
        XCTAssertTrue(SaidloopError.http(status: 400, body: "").isPermanent)
        XCTAssertFalse(SaidloopError.http(status: 429, body: "").isPermanent)
        XCTAssertFalse(SaidloopError.http(status: 503, body: "").isPermanent)
    }
}
