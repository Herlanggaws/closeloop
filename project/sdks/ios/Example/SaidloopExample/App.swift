import Saidloop
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let env = ProcessInfo.processInfo.environment
        let key = env["SAIDLOOP_KEY"] ?? (Bundle.main.object(forInfoDictionaryKey: "SaidloopKey") as? String) ?? "pk_demo"
        let api = URL(string: env["SAIDLOOP_API"] ?? "http://localhost:8080")!
        Saidloop.start(key: key, api: api)
        Saidloop.identify(userId: "sample_user", appVersion: "1.0")

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = HomeViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class HomeViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let title = UILabel()
        title.text = "Bear Budget sample"
        title.font = .systemFont(ofSize: 22, weight: .semibold)
        let balance = UILabel()
        balance.text = "Rp 12.450.000"
        balance.font = .systemFont(ofSize: 32, weight: .bold)
        balance.saidloopMask = true
        let button = UIButton(type: .system)
        button.setTitle("Report a problem", for: .normal)
        button.accessibilityIdentifier = "report"
        button.addAction(UIAction { _ in Saidloop.show() }, for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [title, balance, button])
        stack.axis = .vertical
        stack.spacing = 16
        stack.alignment = .leading
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 40),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
        ])
    }
}
