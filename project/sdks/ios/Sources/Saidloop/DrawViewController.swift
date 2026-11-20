#if canImport(UIKit)
import UIKit

/// Full-screen drawing on the screenshot ("Tap to draw on it", S-22).
@MainActor
final class DrawViewController: UIViewController {
    private let base: UIImage
    private let onDone: (Data) -> Void
    private let canvas: DrawCanvas

    init(image: UIImage, onDone: @escaping (Data) -> Void) {
        base = image
        self.onDone = onDone
        canvas = DrawCanvas(image: image)
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(white: 0.09, alpha: 1)
        let title = UILabel()
        title.text = "Draw on the screenshot"
        title.textColor = .white
        title.font = .systemFont(ofSize: 15, weight: .semibold)
        let undo = UIButton(type: .system)
        undo.setTitle("Undo", for: .normal)
        undo.tintColor = .white
        undo.addAction(UIAction { [weak self] _ in self?.canvas.undo() }, for: .touchUpInside)
        let done = UIButton(type: .system)
        done.setTitle("Done", for: .normal)
        done.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        done.tintColor = .white
        done.addAction(UIAction { [weak self] _ in self?.finish() }, for: .touchUpInside)
        let bar = UIStackView(arrangedSubviews: [title, UIView(), undo, done])
        bar.spacing = 16
        bar.translatesAutoresizingMaskIntoConstraints = false
        canvas.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bar)
        view.addSubview(canvas)
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            canvas.topAnchor.constraint(equalTo: bar.bottomAnchor, constant: 8),
            canvas.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            canvas.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            canvas.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
        ])
    }

    private func finish() {
        if canvas.hasStrokes, let png = canvas.render().pngData() { onDone(png) }
        dismiss(animated: true)
    }
}

/// Keeps strokes in image coordinates so the final PNG matches the screenshot size.
@MainActor
final class DrawCanvas: UIView {
    private let image: UIImage
    private var strokes: [[CGPoint]] = []
    private let color = UIColor(red: 218 / 255, green: 49 / 255, blue: 74 / 255, alpha: 1)

    var hasStrokes: Bool { !strokes.isEmpty }

    init(image: UIImage) {
        self.image = image
        super.init(frame: .zero)
        backgroundColor = .clear
        isAccessibilityElement = true
        accessibilityLabel = "Screenshot drawing area"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private var imageRect: CGRect {
        let s = min(bounds.width / image.size.width, bounds.height / image.size.height)
        let size = CGSize(width: image.size.width * s, height: image.size.height * s)
        return CGRect(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2, width: size.width, height: size.height)
    }

    private func toImage(_ p: CGPoint) -> CGPoint {
        let r = imageRect
        return CGPoint(x: (p.x - r.minX) / r.width * image.size.width, y: (p.y - r.minY) / r.height * image.size.height)
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let t = touches.first else { return }
        strokes.append([toImage(t.location(in: self))])
        setNeedsDisplay()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let t = touches.first, !strokes.isEmpty else { return }
        strokes[strokes.count - 1].append(toImage(t.location(in: self)))
        setNeedsDisplay()
    }

    func undo() {
        if !strokes.isEmpty { strokes.removeLast() }
        setNeedsDisplay()
    }

    override func draw(_ rect: CGRect) {
        let r = imageRect
        image.draw(in: r)
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        ctx.saveGState()
        ctx.translateBy(x: r.minX, y: r.minY)
        ctx.scaleBy(x: r.width / image.size.width, y: r.height / image.size.height)
        stroke(in: ctx)
        ctx.restoreGState()
    }

    func render() -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = image.scale
        return UIGraphicsImageRenderer(size: image.size, format: format).image { ctx in
            image.draw(at: .zero)
            stroke(in: ctx.cgContext)
        }
    }

    private func stroke(in ctx: CGContext) {
        ctx.setStrokeColor(color.cgColor)
        ctx.setLineWidth(image.size.width / 90)
        ctx.setLineCap(.round)
        ctx.setLineJoin(.round)
        for s in strokes where !s.isEmpty {
            ctx.beginPath()
            ctx.move(to: s[0])
            s.dropFirst().forEach { ctx.addLine(to: $0) }
            if s.count == 1 { ctx.addLine(to: s[0]) }
            ctx.strokePath()
        }
    }
}
#endif
