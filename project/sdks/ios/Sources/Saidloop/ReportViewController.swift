#if canImport(UIKit)
#if canImport(SaidloopCore)
import SaidloopCore // SwiftPM: separate module; CocoaPods: same module
#endif
import UIKit

/// S-22 report sheet: type, message, masked screenshot, Send. Offline shows the queued state.
@MainActor
final class ReportViewController: UIViewController, UITextViewDelegate {
    private let screenshot: Data?
    private var type = "bug"
    private let segmented = UISegmentedControl(items: ["Bug", "Idea", "Question"])
    private let message = UITextView()
    private let placeholder = UILabel()
    private let send = UIButton(type: .system)
    private let stack = UIStackView()

    init(screenshot: Data?) {
        self.screenshot = screenshot
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
        ])
        buildForm()
    }

    private func buildForm() {
        stack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        let head = UIStackView()
        let title = label("Report a problem", size: 17, weight: .semibold)
        let close = UIButton(type: .close)
        close.addAction(UIAction { [weak self] _ in self?.dismiss(animated: true) }, for: .touchUpInside)
        head.addArrangedSubview(title)
        head.addArrangedSubview(close)
        stack.addArrangedSubview(head)

        segmented.selectedSegmentIndex = 0
        segmented.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.type = ReportPayload.types[self.segmented.selectedSegmentIndex]
            self.placeholder.text = self.hint()
        }, for: .valueChanged)
        stack.addArrangedSubview(segmented)

        message.font = .systemFont(ofSize: 15)
        message.layer.borderColor = UIColor.systemGray4.cgColor
        message.layer.borderWidth = 1
        message.layer.cornerRadius = 10
        message.textContainerInset = UIEdgeInsets(top: 10, left: 8, bottom: 10, right: 8)
        message.delegate = self
        message.heightAnchor.constraint(equalToConstant: 96).isActive = true
        placeholder.text = hint()
        placeholder.textColor = .placeholderText
        placeholder.font = .systemFont(ofSize: 15)
        placeholder.translatesAutoresizingMaskIntoConstraints = false
        message.addSubview(placeholder)
        NSLayoutConstraint.activate([
            placeholder.topAnchor.constraint(equalTo: message.topAnchor, constant: 10),
            placeholder.leadingAnchor.constraint(equalTo: message.leadingAnchor, constant: 13),
        ])
        stack.addArrangedSubview(message)

        if let screenshot, let image = UIImage(data: screenshot) {
            let row = UIStackView()
            row.spacing = 12
            row.alignment = .center
            let thumb = UIImageView(image: image)
            thumb.contentMode = .scaleAspectFill
            thumb.clipsToBounds = true
            thumb.layer.cornerRadius = 8
            thumb.layer.borderColor = UIColor.systemGray5.cgColor
            thumb.layer.borderWidth = 1
            thumb.widthAnchor.constraint(equalToConstant: 44).isActive = true
            thumb.heightAnchor.constraint(equalToConstant: 78).isActive = true
            let texts = UIStackView(arrangedSubviews: [
                label("Screenshot attached", size: 13.5, weight: .semibold),
                label("Sensitive fields are hidden.", size: 12, color: .secondaryLabel),
            ])
            texts.axis = .vertical
            row.addArrangedSubview(thumb)
            row.addArrangedSubview(texts)
            stack.addArrangedSubview(row)
        }

        styleButton(send, title: "Send report")
        send.isEnabled = false
        send.alpha = 0.5
        send.addAction(UIAction { [weak self] _ in self?.submit() }, for: .touchUpInside)
        stack.addArrangedSubview(send)
    }

    func textViewDidChange(_ textView: UITextView) {
        let has = !textView.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        placeholder.isHidden = !textView.text.isEmpty
        send.isEnabled = has
        send.alpha = has ? 1 : 0.5
    }

    private func submit() {
        let body = message.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        send.isEnabled = false
        send.setTitle("Sending…", for: .normal)
        Task {
            let sent = await Saidloop.submit(type: type, message: body, screenshot: screenshot)
            if sent {
                showDone(title: "Report sent", body: "Thanks. The team gets it with the screenshot and device details.", queue: nil)
            } else {
                let n = Saidloop.queue.count
                showDone(
                    title: "Saved — you're offline",
                    body: "We'll send your report as soon as you're back online. You can close the app.",
                    queue: "\(n) report\(n == 1 ? "" : "s") waiting to send"
                )
            }
        }
    }

    private func showDone(title: String, body: String, queue: String?) {
        stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        stack.addArrangedSubview(label(title, size: 17, weight: .semibold))
        let text = label(body, size: 14, color: .secondaryLabel)
        text.numberOfLines = 0
        stack.addArrangedSubview(text)
        if let queue { stack.addArrangedSubview(label("● \(queue)", size: 13, color: .systemOrange)) }
        let done = UIButton(type: .system)
        styleButton(done, title: "Done")
        done.addAction(UIAction { [weak self] _ in self?.dismiss(animated: true) }, for: .touchUpInside)
        stack.addArrangedSubview(done)
    }

    private func hint() -> String {
        switch type {
        case "idea": return "What would make this better?"
        case "question": return "What do you want to know?"
        default: return "What happened?"
        }
    }

    private func label(_ text: String, size: CGFloat, weight: UIFont.Weight = .regular, color: UIColor = .label) -> UILabel {
        let l = UILabel()
        l.text = text
        l.font = .systemFont(ofSize: size, weight: weight)
        l.textColor = color
        return l
    }

    private func styleButton(_ b: UIButton, title: String) {
        var conf = UIButton.Configuration.filled()
        conf.title = title
        conf.baseBackgroundColor = UIColor(red: 0.09, green: 0.09, blue: 0.09, alpha: 1)
        conf.baseForegroundColor = .white
        conf.cornerStyle = .medium
        b.configuration = conf
        b.heightAnchor.constraint(equalToConstant: 48).isActive = true
    }
}
#endif
