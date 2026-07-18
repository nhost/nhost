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
        // Test-support executable only; it exposes no Nhost library API.
        .executable(
            name: "NhostSessionCoordinationTestHelper",
            targets: ["NhostSessionCoordinationTestHelper"]
        ),
    ],
    targets: [
        .target(name: "Nhost"),
        .executableTarget(
            name: "NhostSessionCoordinationTestHelper",
            dependencies: ["Nhost"],
            path: "Tests/NhostSessionCoordinationTestHelper"
        ),
        .testTarget(
            name: "NhostTests",
            dependencies: ["Nhost"]
        ),
        .testTarget(
            name: "NhostIntegrationTests",
            dependencies: ["Nhost"]
        ),
    ]
)
