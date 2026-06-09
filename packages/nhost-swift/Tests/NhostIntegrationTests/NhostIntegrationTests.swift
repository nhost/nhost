import Foundation
import XCTest
@testable import Nhost

private struct IntegrationConfigurationError: Error, CustomStringConvertible, LocalizedError {
    let description: String

    var errorDescription: String? {
        description
    }
}

private struct IntegrationEnvironment: Sendable {
    let authURL: URL
    let storageURL: URL?
    let graphqlURL: URL?
    let functionsURL: URL?
    let email: String
    let password: String
    let storageBucketID: String
    let graphqlQuery: String?
    let functionsPath: String?

    static func load(requireStorage: Bool = false) throws -> IntegrationEnvironment {
        let environment = ProcessInfo.processInfo.environment
        guard environment["NHOST_SWIFT_RUN_INTEGRATION"] == "1" else {
            throw XCTSkip("Set NHOST_SWIFT_RUN_INTEGRATION=1 to run Nhost Swift integration tests")
        }

        let authURL = try requiredURL("NHOST_AUTH_URL", in: environment)
        let storageURL = try optionalURL("NHOST_STORAGE_URL", in: environment)
        if requireStorage, storageURL == nil {
            throw IntegrationConfigurationError(description: "Missing required integration variable NHOST_STORAGE_URL")
        }

        return IntegrationEnvironment(
            authURL: authURL,
            storageURL: storageURL,
            graphqlURL: try optionalURL("NHOST_GRAPHQL_URL", in: environment),
            functionsURL: try optionalURL("NHOST_FUNCTIONS_URL", in: environment),
            email: try required("NHOST_SWIFT_TEST_EMAIL", in: environment),
            password: try required("NHOST_SWIFT_TEST_PASSWORD", in: environment),
            storageBucketID: environment["NHOST_SWIFT_STORAGE_BUCKET_ID"].nilIfEmpty ?? "default",
            graphqlQuery: environment["NHOST_SWIFT_GRAPHQL_QUERY"].nilIfEmpty,
            functionsPath: environment["NHOST_SWIFT_FUNCTION_PATH"].nilIfEmpty
        )
    }

    func makeClient() -> NhostClient {
        createClient(
            NhostClientOptions(
                authURL: authURL,
                storageURL: storageURL,
                graphqlURL: graphqlURL,
                functionsURL: functionsURL,
                storage: MemorySessionStorageBackend()
            )
        )
    }

    private static func required(_ name: String, in environment: [String: String]) throws -> String {
        guard let value = environment[name].nilIfEmpty else {
            throw IntegrationConfigurationError(description: "Missing required integration variable \(name)")
        }

        return value
    }

    private static func requiredURL(_ name: String, in environment: [String: String]) throws -> URL {
        let value = try required(name, in: environment)
        guard let url = URL(string: value) else {
            throw IntegrationConfigurationError(description: "Integration variable \(name) is not a valid URL")
        }

        return url
    }

    private static func optionalURL(_ name: String, in environment: [String: String]) throws -> URL? {
        guard let value = environment[name].nilIfEmpty else {
            return nil
        }

        guard let url = URL(string: value) else {
            throw IntegrationConfigurationError(description: "Integration variable \(name) is not a valid URL")
        }

        return url
    }
}

private extension Optional where Wrapped == String {
    var nilIfEmpty: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }

        return value
    }
}

final class AuthIntegrationTests: XCTestCase {
    func testEmailPasswordSignInStoresSession() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        let session = try await signIn(client: client, integration: integration)
        let storedSession = try await client.getUserSession()

        XCTAssertFalse(session.accessToken.isEmpty)
        XCTAssertFalse(session.refreshToken.isEmpty)
        XCTAssertEqual(storedSession?.accessToken, session.accessToken)
    }
}

final class StorageIntegrationTests: XCTestCase {
    func testUploadDownloadAndDeleteFile() async throws {
        let integration = try IntegrationEnvironment.load(requireStorage: true)
        let client = integration.makeClient()
        _ = try await signIn(client: client, integration: integration)

        let fileID = "nhost-swift-integration-\(UUID().uuidString).txt"
        let fileData = Data("nhost swift integration \(fileID)".utf8)
        let upload = try await client.storage.uploadFiles(
            body: StorageUploadFilesBody(
                bucketId: integration.storageBucketID,
                metadata: [
                    StorageUploadFileMetadata(
                        id: fileID,
                        name: fileID,
                        metadata: ["suite": .string("nhost-swift")]
                    ),
                ],
                file: [fileData]
            )
        )

        guard let uploaded = upload.body.processedFiles.first else {
            throw IntegrationConfigurationError(description: "Storage upload returned no processed files")
        }

        do {
            let downloaded = try await client.storage.getFile(id: uploaded.id)
            XCTAssertEqual(upload.status, 201)
            XCTAssertEqual(uploaded.bucketId, integration.storageBucketID)
            XCTAssertEqual(downloaded.body, fileData)
        } catch {
            _ = try? await client.storage.deleteFile(id: uploaded.id)
            throw error
        }

        _ = try? await client.storage.deleteFile(id: uploaded.id)
    }
}

final class ServiceIntegrationTests: XCTestCase {
    func testConfiguredGraphQLQuery() async throws {
        let integration = try IntegrationEnvironment.load()
        guard integration.graphqlURL != nil, let query = integration.graphqlQuery else {
            throw XCTSkip("Set NHOST_GRAPHQL_URL and NHOST_SWIFT_GRAPHQL_QUERY to run the GraphQL integration test")
        }

        let client = integration.makeClient()
        _ = try await signIn(client: client, integration: integration)
        let response = try await client.graphql.request(JSONValue.self, query: query)

        XCTAssertTrue((200..<300).contains(response.status))
        XCTAssertNil(response.body.errors)
        XCTAssertNotNil(response.body.data)
    }

    func testConfiguredFunctionFetch() async throws {
        let integration = try IntegrationEnvironment.load()
        guard integration.functionsURL != nil, let path = integration.functionsPath else {
            throw XCTSkip("Set NHOST_FUNCTIONS_URL and NHOST_SWIFT_FUNCTION_PATH to run the Functions integration test")
        }

        let client = integration.makeClient()
        _ = try await signIn(client: client, integration: integration)
        let response = try await client.functions.fetch(JSONValue.self, path: path)

        XCTAssertTrue((200..<300).contains(response.status))
    }
}

@discardableResult
private func signIn(client: NhostClient, integration: IntegrationEnvironment) async throws -> AuthSession {
    let response = try await client.auth.signInEmailPassword(
        body: AuthSignInEmailPasswordRequest(
            email: integration.email,
            password: integration.password
        )
    )

    guard let session = response.body.session else {
        throw IntegrationConfigurationError(description: "Auth sign-in succeeded but did not return a session")
    }

    return session
}
