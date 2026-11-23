import Flutter
import Saidloop
import UIKit

/// Forwards the Dart `Saidloop` calls to the native iOS SDK.
public class SaidloopFlutterPlugin: NSObject, FlutterPlugin {
    public static func register(with registrar: FlutterPluginRegistrar) {
        let channel = FlutterMethodChannel(name: "ai.closeloop/saidloop", binaryMessenger: registrar.messenger())
        registrar.addMethodCallDelegate(SaidloopFlutterPlugin(), channel: channel)
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        let args = call.arguments as? [String: Any] ?? [:]
        MainActor.assumeIsolated {
            switch call.method {
            case "init":
                guard let key = args["key"] as? String else { return result(FlutterError(code: "saidloop", message: "key required", details: nil)) }
                let api = (args["api"] as? String).flatMap(URL.init(string:)) ?? Saidloop.defaultAPI
                Saidloop.start(
                    key: key,
                    api: api,
                    shakeToReport: args["shakeToReport"] as? Bool ?? true,
                    maskTextInputs: args["maskTextInputs"] as? Bool ?? true
                )
                result(nil)
            case "identify":
                Saidloop.identify(userId: args["userId"] as? String, email: args["email"] as? String, appVersion: args["appVersion"] as? String)
                result(nil)
            case "setMaskRects":
                // Dart logical pixels == UIKit points (the Flutter view fills the window).
                let rects = (args["rects"] as? [[String: Double]] ?? []).map {
                    CGRect(x: $0["x"] ?? 0, y: $0["y"] ?? 0, width: $0["w"] ?? 0, height: $0["h"] ?? 0)
                }
                Saidloop.setMaskRects(rects)
                result(nil)
            case "show":
                Saidloop.show()
                result(nil)
            default:
                result(FlutterMethodNotImplemented)
            }
        }
    }
}
