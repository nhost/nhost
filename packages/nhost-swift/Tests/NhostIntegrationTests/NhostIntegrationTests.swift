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
    let storageURL: URL
    let graphqlURL: URL
    let functionsURL: URL
    let email: String
    let password: String
    let storageBucketID: String
    let graphqlQuery: String
    let functionsPath: String

    static func load() throws -> IntegrationEnvironment {
        let environment = ProcessInfo.processInfo.environment
        let runID = environment["NHOST_SWIFT_TEST_RUN_ID"].nilIfEmpty ?? UUID().uuidString

        return IntegrationEnvironment(
            authURL: try url("NHOST_AUTH_URL", defaultValue: "https://local.auth.local.nhost.run/v1", in: environment),
            storageURL: try url("NHOST_STORAGE_URL", defaultValue: "https://local.storage.local.nhost.run/v1", in: environment),
            graphqlURL: try url("NHOST_GRAPHQL_URL", defaultValue: "https://local.graphql.local.nhost.run/v1", in: environment),
            functionsURL: try url("NHOST_FUNCTIONS_URL", defaultValue: "https://local.functions.local.nhost.run/v1", in: environment),
            email: environment["NHOST_SWIFT_TEST_EMAIL"].nilIfEmpty ?? "swift-\(runID)@example.com",
            password: environment["NHOST_SWIFT_TEST_PASSWORD"].nilIfEmpty ?? "password123",
            storageBucketID: environment["NHOST_SWIFT_STORAGE_BUCKET_ID"].nilIfEmpty ?? "default",
            graphqlQuery: environment["NHOST_SWIFT_GRAPHQL_QUERY"].nilIfEmpty ?? "query { users(limit: 1) { id displayName metadata } }",
            functionsPath: environment["NHOST_SWIFT_FUNCTION_PATH"].nilIfEmpty ?? "/echo"
        )
    }

    func makeClient() -> NhostClient {
        createClient(
            NhostClientOptions(
                authURL: authURL,
                storageURL: storageURL,
                graphqlURL: graphqlURL,
                functionsURL: functionsURL,
                sessionStorage: MemorySessionStorageBackend()
            )
        )
    }

    private static func url(
        _ name: String,
        defaultValue: String,
        in environment: [String: String]
    ) throws -> URL {
        let value = environment[name].nilIfEmpty ?? defaultValue
        guard let url = URL(string: value) else {
            throw IntegrationConfigurationError(description: "Integration variable \(name) is not a valid URL")
        }

        return url
    }
}

private struct GraphQLUser: Decodable, Sendable, Equatable {
    let id: String
    let displayName: String
    let metadata: JSONValue?
}

private struct GraphQLUsersData: Decodable, Sendable, Equatable {
    let users: [GraphQLUser]
}

private struct GraphQLUpdateUserData: Decodable, Sendable, Equatable {
    let updateUser: GraphQLUser?
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
    func testHealthEndpoints() async throws {
        let client = try IntegrationEnvironment.load().makeClient()

        let health = try await client.auth.healthCheckGet()
        XCTAssertEqual(health.status, 200)
        XCTAssertEqual(health.body, .ok)

        let head = try await client.auth.healthCheckHead()
        XCTAssertEqual(head.status, 200)
    }

    func testEmailPasswordSignUpStoresSession() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        let session = try await signUp(client: client, integration: integration)
        let storedSession = try await client.getUserSession()

        XCTAssertFalse(session.accessToken.isEmpty)
        XCTAssertFalse(session.refreshToken.isEmpty)
        XCTAssertEqual(storedSession?.accessToken, session.accessToken)
    }

    func testEmailPasswordSignInRefreshGetUserAndSignOut() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)
        try await client.clearSession()

        let signInResponse = try await client.auth.signInEmailPassword(
            body: AuthSignInEmailPasswordRequest(email: integration.email, password: integration.password)
        )
        let signedInSession = try required(
            signInResponse.body.session,
            "Email/password sign-in did not return a session"
        )
        let storedSession = try await client.getUserSession()
        XCTAssertEqual(storedSession?.refreshToken, signedInSession.refreshToken)

        let user = try await client.auth.getUser()
        XCTAssertEqual(user.status, 200)
        XCTAssertEqual(user.body.email, integration.email)
        XCTAssertEqual(user.body.id, signedInSession.user?.id)

        let tokenVerification = try await client.auth.verifyToken()
        XCTAssertEqual(tokenVerification.status, 200)
        XCTAssertFalse(tokenVerification.body.isEmpty)

        let refresh = try await client.auth.refreshToken(
            body: AuthRefreshTokenRequest(refreshToken: signedInSession.refreshToken)
        )
        XCTAssertEqual(refresh.status, 200)
        XCTAssertFalse(refresh.body.accessToken.isEmpty)
        XCTAssertFalse(refresh.body.refreshToken.isEmpty)
        let refreshedStoredSession = try await client.getUserSession()
        XCTAssertEqual(refreshedStoredSession?.refreshToken, refresh.body.refreshToken)

        let signOut = try await client.auth.signOut(
            body: AuthSignOutRequest(refreshToken: refresh.body.refreshToken)
        )
        XCTAssertEqual(signOut.status, 200)
        XCTAssertEqual(signOut.body, .ok)
        let signedOutSession = try await client.getUserSession()
        XCTAssertNil(signedOutSession)
    }

    func testInvalidEmailPasswordSignInFails() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)

        do {
            _ = try await client.auth.signInEmailPassword(
                body: AuthSignInEmailPasswordRequest(email: integration.email, password: integration.password + "-invalid")
            )
            XCTFail("Expected invalid credentials to fail")
        } catch let error as FetchError {
            XCTAssertEqual(error.status, 401)
            XCTAssertTrue(error.messages.contains("Incorrect email or password"))
        }
    }
}

final class StorageIntegrationTests: XCTestCase {
    func testStorageVersion() async throws {
        let client = try IntegrationEnvironment.load().makeClient()
        let version = try await client.storage.getVersion()

        XCTAssertEqual(version.status, 200)
        XCTAssertEqual(version.body.buildVersion, "0.8.0-beta3")
    }

    func testUploadReadCacheReplacePresignAndDeleteFiles() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)

        let firstID = UUID().uuidString.lowercased()
        let secondID = UUID().uuidString.lowercased()
        let firstName = "nhost-swift-integration-\(firstID).txt"
        let secondName = "nhost-swift-integration-\(secondID).txt"
        let firstData = Data("test1".utf8)
        let secondData = Data("test2 is larger".utf8)
        var uploadedIDs: [String] = []

        do {
            let upload = try await client.storage.uploadFiles(
                body: StorageUploadFilesBody(
                    bucketId: integration.storageBucketID,
                    metadata: [
                        StorageUploadFileMetadata(
                            id: firstID,
                            name: firstName,
                            metadata: ["key": .string("value1")]
                        ),
                        StorageUploadFileMetadata(
                            id: secondID,
                            name: secondName,
                            metadata: ["key": .string("value2")]
                        ),
                    ],
                    file: [firstData, secondData]
                )
            )
            XCTAssertEqual(upload.status, 201)
            XCTAssertEqual(upload.body.processedFiles.count, 2)
            uploadedIDs = upload.body.processedFiles.map(\.id)

            let filesByID = Dictionary(uniqueKeysWithValues: upload.body.processedFiles.map { ($0.id, $0) })
            let first = try required(filesByID[firstID], "First uploaded file metadata missing")
            let second = try required(filesByID[secondID], "Second uploaded file metadata missing")
            XCTAssertEqual(first.bucketId, integration.storageBucketID)
            XCTAssertEqual(first.name, firstName)
            XCTAssertEqual(first.size, firstData.count)
            XCTAssertTrue(first.isUploaded)
            XCTAssertTrue(first.mimeType.hasPrefix("text/plain"))
            XCTAssertEqual(first.metadata?["key"]?.stringValue, "value1")
            XCTAssertEqual(second.name, secondName)
            XCTAssertEqual(second.size, secondData.count)
            XCTAssertEqual(second.metadata?["key"]?.stringValue, "value2")

            let metadata = try await client.storage.getFileMetadataHeaders(id: first.id)
            XCTAssertEqual(metadata.status, 200)
            XCTAssertEqual(header("content-type", in: metadata.headers), "text/plain; charset=utf-8")
            XCTAssertNotNil(header("last-modified", in: metadata.headers))
            if let contentLength = header("content-length", in: metadata.headers) {
                XCTAssertEqual(contentLength, String(firstData.count))
            }
            let etag = try required(header("etag", in: metadata.headers), "Missing ETag header")

            do {
                _ = try await client.storage.getFileMetadataHeaders(
                    id: first.id,
                    headers: StorageGetFileMetadataHeadersHeaders(ifNoneMatch: etag)
                )
                XCTFail("Expected matching If-None-Match metadata request to return 304")
            } catch let error as FetchError {
                XCTAssertEqual(error.status, 304)
            }

            let range = try await client.storage.getFile(
                id: first.id,
                headers: StorageGetFileHeaders(range: "bytes=0-4")
            )
            XCTAssertEqual(range.status, 206)
            XCTAssertEqual(range.body, firstData)

            let downloaded = try await client.storage.getFile(id: first.id)
            XCTAssertEqual(downloaded.status, 200)
            XCTAssertEqual(downloaded.body, firstData)

            let presigned = try await client.storage.getFilePresignedURL(id: first.id)
            XCTAssertEqual(presigned.status, 200)
            XCTAssertNotNil(URL(string: presigned.body.url))
            XCTAssertGreaterThan(presigned.body.expiration, 0)

            let replacementData = Data("test1 new".utf8)
            let replacement = try await client.storage.replaceFile(
                id: first.id,
                body: StorageReplaceFileBody(
                    metadata: StorageUpdateFileMetadata(
                        name: "\(firstName).replaced",
                        metadata: ["key": .string("value1 new")]
                    ),
                    file: replacementData
                )
            )
            XCTAssertEqual(replacement.status, 200)
            XCTAssertEqual(replacement.body.id, first.id)
            XCTAssertEqual(replacement.body.name, "\(firstName).replaced")
            XCTAssertEqual(replacement.body.size, replacementData.count)
            XCTAssertEqual(replacement.body.metadata?["key"]?.stringValue, "value1 new")

            let replacedDownload = try await client.storage.getFile(id: first.id)
            XCTAssertEqual(replacedDownload.body, replacementData)
        } catch {
            for id in uploadedIDs {
                _ = try? await client.storage.deleteFile(id: id)
            }
            throw error
        }

        for id in uploadedIDs {
            let deleted = try await client.storage.deleteFile(id: id)
            XCTAssertEqual(deleted.status, 204)
        }
    }
}

final class ServiceIntegrationTests: XCTestCase {
    func testGraphQLQueryAndMutation() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        let session = try await signUp(client: client, integration: integration)
        let userID = try required(session.user?.id, "Sign-up session did not include a user id")

        let users = try await client.graphql.request(
            GraphQLUsersData.self,
            query: """
            query GetUsers($id: uuid!) {
              users(where: {id: {_eq: $id}}) {
                id
                displayName
                metadata
              }
            }
            """,
            variables: ["id": .string(userID)]
        )
        XCTAssertEqual(users.status, 200)
        XCTAssertNil(users.body.errors)
        XCTAssertEqual(users.body.data?.users.count, 1)
        XCTAssertEqual(users.body.data?.users.first?.id, userID)
        XCTAssertEqual(users.body.data?.users.first?.metadata?["source"]?.stringValue, "test")

        let updatedDisplayName = "Swift Integration \(UUID().uuidString.prefix(8))"
        let mutation = try await client.graphql.request(
            GraphQLUpdateUserData.self,
            query: """
            mutation UpdateUsersDisplayName($id: uuid!, $displayName: String!) {
              updateUser(pk_columns: {id: $id}, _set: {displayName: $displayName}) {
                id
                displayName
              }
            }
            """,
            variables: [
                "id": .string(userID),
                "displayName": .string(updatedDisplayName),
            ],
            operationName: "UpdateUsersDisplayName"
        )
        XCTAssertEqual(mutation.status, 200)
        XCTAssertEqual(mutation.body.data?.updateUser?.id, userID)
        XCTAssertEqual(mutation.body.data?.updateUser?.displayName, updatedDisplayName)
    }

    func testGraphQLBadQueryReturnsExecutionError() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)

        do {
            _ = try await client.graphql.request(JSONValue.self, query: "wrong query")
            XCTFail("Expected a GraphQL execution error")
        } catch let error as GraphQLExecutionError {
            XCTAssertEqual(error.errors.count, 1)
            XCTAssertEqual(error.errors.first?.message, "not a valid graphql query")
            XCTAssertEqual(error.errors.first?.extensions?["code"]?.stringValue, "validation-failed")
        }
    }

    func testConfiguredGraphQLQuery() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)
        let response = try await client.graphql.request(JSONValue.self, query: integration.graphqlQuery)

        XCTAssertEqual(response.status, 200)
        XCTAssertNil(response.body.errors)
        XCTAssertNotNil(response.body.data)
    }

    func testFunctionFetchDecodesJsonTextDataAndErrors() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)

        let jsonResponse = try await client.functions.post(
            JSONValue.self,
            path: integration.functionsPath,
            body: JSONValue.object(["message": .string("Hello, world!")])
        )
        XCTAssertEqual(jsonResponse.status, 200)
        let jsonBody = try required(jsonResponse.body.json, "Expected JSON function response")
        XCTAssertEqual(jsonBody["method"]?.stringValue, "POST")
        XCTAssertEqual(jsonBody["body"]?["message"]?.stringValue, "Hello, world!")
        XCTAssertNotNil(jsonBody["headers"]?["authorization"]?.stringValue)

        let textResponse = try await client.functions.fetch(
            JSONValue.self,
            path: integration.functionsPath,
            method: "POST",
            headers: [
                "Accept": "text/plain",
                "Content-Type": "application/json",
            ],
            body: Data(#"{"message":"Hello, world!"}"#.utf8)
        )
        let textBody = try required(textResponse.body.text, "Expected text function response")
        XCTAssertTrue(textBody.contains("\"method\":POST"))
        XCTAssertTrue(textBody.contains("\"body\":{\"message\":\"Hello, world!\"}"))

        let dataResponse = try await client.functions.fetch(
            JSONValue.self,
            path: integration.functionsPath,
            method: "POST",
            headers: ["Accept": "application/octet-stream"]
        )
        XCTAssertEqual(dataResponse.body.data, Data("beep-boop".utf8))

        do {
            _ = try await client.functions.fetch(
                JSONValue.self,
                path: "/crash",
                method: "POST",
                headers: ["Accept": "application/json"]
            )
            XCTFail("Expected crashing function to return an error")
        } catch let error as FunctionsHTTPError {
            XCTAssertEqual(error.status, 500)
            XCTAssertTrue(error.messages.contains("Internal Server Error"))
        }
    }
}

@discardableResult
private func signUp(client: NhostClient, integration: IntegrationEnvironment) async throws -> AuthSession {
    do {
        let response = try await client.auth.signUpEmailPassword(
            body: AuthSignUpEmailPasswordRequest(
                email: integration.email,
                password: integration.password,
                options: AuthSignUpOptions(
                    allowedRoles: ["user"],
                    defaultRole: "user",
                    displayName: "Swift Integration User",
                    locale: "en",
                    metadata: ["source": .string("test")]
                )
            )
        )

        return try required(response.body.session, "Auth sign-up succeeded but did not return a session")
    } catch let error as FetchError where error.status == 409 {
        return try await signIn(client: client, integration: integration)
    }
}

@discardableResult
private func signIn(client: NhostClient, integration: IntegrationEnvironment) async throws -> AuthSession {
    let response = try await client.auth.signInEmailPassword(
        body: AuthSignInEmailPasswordRequest(email: integration.email, password: integration.password)
    )

    return try required(response.body.session, "Auth sign-in succeeded but did not return a session")
}

private func required<Value>(_ value: Value?, _ message: String) throws -> Value {
    guard let value else {
        throw IntegrationConfigurationError(description: message)
    }

    return value
}

private func header(_ name: String, in headers: [String: String]) -> String? {
    headers.first { key, _ in key.caseInsensitiveCompare(name) == .orderedSame }?.value
}
