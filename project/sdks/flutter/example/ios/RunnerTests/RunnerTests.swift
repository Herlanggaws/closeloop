import Flutter
import UIKit
import XCTest

@testable import saidloop_flutter

class RunnerTests: XCTestCase {

  @MainActor
  func testUnknownMethodIsNotImplemented() {
    let plugin = SaidloopFlutterPlugin()
    let call = FlutterMethodCall(methodName: "doesNotExist", arguments: nil)

    let resultExpectation = expectation(description: "result block must be called.")
    plugin.handle(call) { result in
      XCTAssertTrue((result as AnyObject) === FlutterMethodNotImplemented)
      resultExpectation.fulfill()
    }
    waitForExpectations(timeout: 1)
  }

}
