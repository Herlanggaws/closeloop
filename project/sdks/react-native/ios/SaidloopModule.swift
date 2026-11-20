import Foundation
import React
import Saidloop

/// Forwards the JS `Saidloop` calls to the native iOS SDK.
@objc(Saidloop)
final class SaidloopModule: NSObject {
    @objc static func requiresMainQueueSetup() -> Bool { true }

    @objc func start(_ options: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let key = options["key"] as? String else { return reject("saidloop", "key required", nil) }
            let api = (options["api"] as? String).flatMap(URL.init(string:)) ?? Saidloop.defaultAPI
            MainActor.assumeIsolated {
                Saidloop.start(
                    key: key,
                    api: api,
                    shakeToReport: options["shakeToReport"] as? Bool ?? true,
                    maskTextInputs: options["maskTextInputs"] as? Bool ?? true
                )
            }
            resolve(nil)
        }
    }

    @objc func identify(_ fields: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                Saidloop.identify(userId: fields["userId"] as? String, email: fields["email"] as? String, appVersion: fields["appVersion"] as? String)
            }
            resolve(nil)
        }
    }

    @objc func setMaskRects(_ rects: NSArray, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        // JS sends points in window coordinates, same as UIKit.
        let list: [CGRect] = rects.compactMap { item in
            guard let r = item as? NSDictionary else { return nil }
            func d(_ k: String) -> CGFloat { CGFloat((r[k] as? NSNumber)?.doubleValue ?? 0) }
            return CGRect(x: d("x"), y: d("y"), width: d("w"), height: d("h"))
        }
        DispatchQueue.main.async {
            MainActor.assumeIsolated { Saidloop.setMaskRects(list) }
            resolve(nil)
        }
    }

    @objc func show(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated { Saidloop.show() }
            resolve(nil)
        }
    }
}
