#if canImport(UIKit)
import ObjectiveC
import UIKit

private var maskKey: UInt8 = 0

public extension UIView {
    /// Hide this view in Saidloop screenshots: `view.closeloopMask = true`.
    var closeloopMask: Bool {
        get { (objc_getAssociatedObject(self, &maskKey) as? Bool) ?? false }
        set { objc_setAssociatedObject(self, &maskKey, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC) }
    }
}

@MainActor
enum ScreenCapture {
    /// PNG of the key window with masked views covered.
    static func capture(maskTextInputs: Bool) -> Data? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let window = scenes.flatMap(\.windows).first(where: { $0.isKeyWindow }) else { return nil }
        var masks: [CGRect] = []
        collect(window, in: window, maskTextInputs: maskTextInputs, into: &masks)
        let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
        let image = renderer.image { ctx in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: false)
            UIColor(white: 0.83, alpha: 1).setFill()
            masks.forEach { ctx.fill($0) }
        }
        return image.pngData()
    }

    private static func collect(_ view: UIView, in window: UIWindow, maskTextInputs: Bool, into out: inout [CGRect]) {
        guard !view.isHidden, view.alpha > 0.01 else { return }
        if view.closeloopMask || (maskTextInputs && (view is UITextField || view is UITextView)) {
            out.append(view.convert(view.bounds, to: window))
            return
        }
        view.subviews.forEach { collect($0, in: window, maskTextInputs: maskTextInputs, into: &out) }
    }
}
#endif
