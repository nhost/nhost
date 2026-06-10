import Foundation
import XCTest
@testable import Nhost

/// Executes the README's Swift code examples against the local backend, and
/// mechanically guards that every ```swift block in README.md appears verbatim
/// in this file (the Swift counterpart of nhost-js's docstrings.test.ts, where
/// the published doc examples are the test code). When you edit a README
/// example, update the matching block here — and vice versa.
final class ReadmeExamplesTests: XCTestCase {
    func testReadmeClientCreationExamples() throws {
        let nhost = createClient(
            NhostClientOptions(
                subdomain: "my-project",
                region: "eu-central-1"
            )
        )

        let local = createClient(
            NhostClientOptions(
                authURL: URL(string: "http://localhost:1337/v1")!,
                storageURL: URL(string: "http://localhost:1337/v1/storage")!,
                graphqlURL: URL(string: "http://localhost:1337/v1/graphql")!,
                functionsURL: URL(string: "http://localhost:1337/v1/functions")!,
                defaultHeaders: ["x-app-version": "1.0.0"],
                role: "user"
            )
        )

        XCTAssertEqual(
            nhost.serviceURLs.auth.absoluteString,
            "https://my-project.auth.eu-central-1.nhost.run/v1"
        )
        XCTAssertEqual(local.serviceURLs.auth.absoluteString, "http://localhost:1337/v1")
    }

    func testReadmeEndToEndFlow() async throws {
        let nhost = Self.readmeClient()

        // ## Auth and sessions
        let email = "ada-\(UUID().uuidString.lowercased())@example.com"
        let password = UUID().uuidString

        let signUp = try await nhost.auth.signUpEmailPassword(
            body: AuthSignUpEmailPasswordRequest(
                email: email,
                password: password,
                options: AuthSignUpOptions(
                    displayName: "Ada Lovelace",
                    metadata: ["favoriteNumber": .number(7)]
                )
            )
        )

        let session = signUp.body.session
        print("signed in with token expiring in \(session?.accessTokenExpiresIn ?? 0)s")

        let stored = try await nhost.getUserSession()
        let defaultRole = stored?.decodedToken.hasuraClaims?["x-hasura-default-role"]?.stringValue
        let userID = session?.user?.id ?? ""

        XCTAssertNotNil(session)
        XCTAssertEqual(defaultRole, "user")
        XCTAssertFalse(userID.isEmpty)

        // ## GraphQL
        struct UserRow: Decodable, Sendable {
            let id: String
            let displayName: String
        }

        struct UsersData: Decodable, Sendable {
            let users: [UserRow]
        }

        let users = try await nhost.graphql.request(
            UsersData.self,
            query: """
            query Users($limit: Int!) {
              users(limit: $limit) { id displayName }
            }
            """,
            variables: ["limit": .number(10)],
            operationName: "Users"
        )

        print(users.body.data?.users ?? [])

        XCTAssertEqual(users.body.data?.users.first?.id, userID)

        struct UpdatedUser: Decodable, Sendable {
            let id: String
            let displayName: String
        }

        struct UpdateUserData: Decodable, Sendable {
            let updateUser: UpdatedUser?
        }

        let updated = try await nhost.graphql.request(
            UpdateUserData.self,
            query: """
            mutation UpdateDisplayName($id: uuid!, $displayName: String!) {
              updateUser(pk_columns: { id: $id }, _set: { displayName: $displayName }) {
                id
                displayName
              }
            }
            """,
            variables: ["id": .string(userID), "displayName": .string("Ada King")],
            operationName: "UpdateDisplayName"
        )

        print(updated.body.data?.updateUser?.displayName ?? "")

        XCTAssertEqual(updated.body.data?.updateUser?.displayName, "Ada King")

        // ## Storage
        let fileData = Data("hello from Swift".utf8)

        let upload = try await nhost.storage.uploadFiles(
            body: StorageUploadFilesBody(
                bucketId: "default",
                metadata: [
                    StorageUploadFileMetadata(
                        name: "hello-swift.txt",
                        metadata: ["source": .string("swift-sdk")]
                    ),
                ],
                file: [fileData]
            )
        )

        let fileID = upload.body.processedFiles[0].id
        let download = try await nhost.storage.getFile(id: fileID)
        print(String(decoding: download.body, as: UTF8.self))

        _ = try await nhost.storage.deleteFile(id: fileID)

        XCTAssertEqual(upload.status, 201)
        XCTAssertEqual(String(decoding: download.body, as: UTF8.self), "hello from Swift")

        // ### Streaming uploads
        let movieURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("readme-movie-\(UUID().uuidString).mov")
        try Data(repeating: 0x42, count: 1024 * 1024).write(to: movieURL)
        defer { try? FileManager.default.removeItem(at: movieURL) }

        let streamedUpload = try await nhost.storage.uploadFiles(
            bucketId: "default",
            files: [
                .fileURL(movieURL, metadata: ["source": .string("swift-sdk")]),
            ]
        )

        _ = try await nhost.storage.deleteFile(id: streamedUpload.body.processedFiles[0].id)

        XCTAssertEqual(streamedUpload.status, 201)

        // ## Functions
        struct HelloResponse: Decodable, Sendable {
            let message: String
        }

        let hello = try await nhost.functions.post(
            HelloResponse.self,
            path: "/helloworld"
        )

        if case let .json(body) = hello.body {
            print(body.message)
        }

        struct EchoRequest: Encodable, Sendable { let message: String }

        let echo = try await nhost.functions.post(
            JSONValue.self,
            path: "/echo",
            body: EchoRequest(message: "Hi")
        )

        print(echo.body.json?["body"]?["message"]?.stringValue ?? "")

        XCTAssertEqual(hello.body.json?.message, "Hello, World!")
        XCTAssertEqual(echo.body.json?["body"]?["message"]?.stringValue, "Hi")
    }

    func testReadmeCustomSessionStorageExample() async throws {
        actor SessionBox {
            private var session: StoredSession?

            func get() -> StoredSession? { session }
            func set(_ value: StoredSession) { session = value }
            func remove() { session = nil }
        }

        let box = SessionBox()
        let sessionStorage = CustomSessionStorageBackend(
            get: { await box.get() },
            set: { await box.set($0) },
            remove: { await box.remove() }
        )

        let serverClient = createServerClient(
            NhostServerClientOptions(
                authURL: URL(string: "https://auth.example.com/v1")!,
                storageURL: URL(string: "https://storage.example.com/v1")!,
                graphqlURL: URL(string: "https://graphql.example.com/v1")!,
                functionsURL: URL(string: "https://functions.example.com/v1")!,
                sessionStorage: sessionStorage
            )
        )

        let initialSession = try await serverClient.getUserSession()
        XCTAssertNil(initialSession)
    }

    func testReadmeSwiftCodeBlocksAppearVerbatimInThisFile() throws {
        let testFileURL = URL(fileURLWithPath: #filePath)
        let packageRoot = testFileURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let readme = try String(contentsOf: packageRoot.appendingPathComponent("README.md"), encoding: .utf8)
        let source = try String(contentsOf: testFileURL, encoding: .utf8)
        let normalizedSource = Self.normalized(lines: source.components(separatedBy: "\n"))

        var verified = 0
        for block in Self.swiftCodeBlocks(in: readme) {
            // The package-manifest installation example is not executable test code.
            if block.contains("swift-tools-version") { continue }

            let normalizedBlock = Self.normalized(
                lines: block.components(separatedBy: "\n"),
                droppingImports: true
            )
            XCTAssertTrue(
                normalizedSource.contains(normalizedBlock),
                "README ```swift block is not present verbatim in ReadmeExamplesTests.swift; "
                    + "update the matching test when changing README examples:\n\(block)"
            )
            verified += 1
        }

        XCTAssertGreaterThanOrEqual(verified, 9, "README lost executable example blocks")
    }

    private static func readmeClient() -> NhostClient {
        let environment = ProcessInfo.processInfo.environment

        func url(_ name: String, _ fallback: String) -> URL {
            let value = environment[name].flatMap { $0.isEmpty ? nil : $0 } ?? fallback
            return URL(string: value)!
        }

        return createClient(
            NhostClientOptions(
                authURL: url("NHOST_AUTH_URL", "https://local.auth.local.nhost.run/v1"),
                storageURL: url("NHOST_STORAGE_URL", "https://local.storage.local.nhost.run/v1"),
                graphqlURL: url("NHOST_GRAPHQL_URL", "https://local.graphql.local.nhost.run/v1"),
                functionsURL: url("NHOST_FUNCTIONS_URL", "https://local.functions.local.nhost.run/v1"),
                sessionStorage: MemorySessionStorageBackend()
            )
        )
    }

    private static func swiftCodeBlocks(in markdown: String) -> [String] {
        var blocks: [String] = []
        var current: [String] = []
        var inBlock = false

        for line in markdown.components(separatedBy: "\n") {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if !inBlock, trimmed == "```swift" {
                inBlock = true
                current = []
                continue
            }

            if inBlock, trimmed == "```" {
                blocks.append(current.joined(separator: "\n"))
                inBlock = false
                continue
            }

            if inBlock {
                current.append(line)
            }
        }

        return blocks
    }

    private static func normalized(lines: [String], droppingImports: Bool = false) -> String {
        var trimmed = lines.map { $0.trimmingCharacters(in: .whitespaces) }

        if droppingImports {
            trimmed.removeAll { $0.hasPrefix("import ") }
        }

        while trimmed.first?.isEmpty == true {
            trimmed.removeFirst()
        }

        while trimmed.last?.isEmpty == true {
            trimmed.removeLast()
        }

        return trimmed.joined(separator: "\n")
    }
}
