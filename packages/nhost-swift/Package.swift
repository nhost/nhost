// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "nhost-swift",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
        .tvOS(.v15),
        .watchOS(.v8),
    ],
    products: [
        .library(
            name: "Nhost",
            targets: ["Nhost"]
        ),
    ],
    targets: [
        .target(name: "Nhost"),
        .testTarget(
            name: "NhostTests",
            dependencies: ["Nhost"]
        ),
    ]
)
