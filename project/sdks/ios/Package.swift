// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Saidloop",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "Saidloop", targets: ["Saidloop"]),
    ],
    targets: [
        // Pure Foundation: payload, offline queue, API client, shake detection. Tested on macOS.
        .target(name: "SaidloopCore"),
        // UIKit: report sheet, screenshots with masking, shake, offline flush.
        .target(name: "Saidloop", dependencies: ["SaidloopCore"]),
        .testTarget(name: "SaidloopCoreTests", dependencies: ["SaidloopCore"]),
    ]
)
