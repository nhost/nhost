// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "NhostSwiftToolchainSmoke",
    products: [
        .library(name: "NhostSwiftToolchainSmoke", targets: ["NhostSwiftToolchainSmoke"]),
    ],
    targets: [
        .target(name: "NhostSwiftToolchainSmoke"),
        .testTarget(
            name: "NhostSwiftToolchainSmokeTests",
            dependencies: ["NhostSwiftToolchainSmoke"]
        ),
    ]
)
