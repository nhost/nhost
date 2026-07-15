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
    let adminSecret: String

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
            functionsPath: environment["NHOST_SWIFT_FUNCTION_PATH"].nilIfEmpty ?? "/echo",
            adminSecret: environment["NHOST_SWIFT_ADMIN_SECRET"].nilIfEmpty ?? "nhost-admin-secret"
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

    func isolatedAuthAccount(for purpose: String) -> IntegrationEnvironment {
        let identifier = UUID().uuidString.lowercased()

        return IntegrationEnvironment(
            authURL: authURL,
            storageURL: storageURL,
            graphqlURL: graphqlURL,
            functionsURL: functionsURL,
            email: "swift-\(purpose)-\(identifier)@example.com",
            password: "password-\(identifier)",
            storageBucketID: storageBucketID,
            graphqlQuery: graphqlQuery,
            functionsPath: functionsPath,
            adminSecret: adminSecret
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

            let decoded = try required(
                error.decodedBody(AuthErrorResponse.self),
                "Auth error body did not decode into AuthErrorResponse"
            )
            XCTAssertEqual(decoded.error, .invalidEmailPassword)
            XCTAssertEqual(decoded.status, 401)
        }
    }

    func testRefreshSessionAndMiddlewareRefreshAgainstBackend() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)

        // Forced refresh through the shared refresher updates the stored session.
        // Refresh tokens rotate on every refresh; access tokens can be byte-identical
        // when issued within the same second (iat has second resolution).
        let before = try await client.getUserSession()
        let refreshed = await client.refreshSession(marginSeconds: 0)
        let refreshedSession = try required(refreshed, "Forced session refresh failed")
        XCTAssertNotEqual(refreshedSession.refreshToken, before?.refreshToken)
        let stored = try await client.getUserSession()
        XCTAssertEqual(stored?.refreshToken, refreshedSession.refreshToken)

        // A refresh margin larger than the backend's 900 s access-token lifetime
        // forces the session middleware itself to refresh before the next call.
        let eagerClient = createClient(
            NhostClientOptions(
                authURL: integration.authURL,
                storageURL: integration.storageURL,
                graphqlURL: integration.graphqlURL,
                functionsURL: integration.functionsURL,
                sessionStorage: MemorySessionStorageBackend(),
                sessionRefreshMarginSeconds: 3600
            )
        )
        _ = try await signIn(client: eagerClient, integration: integration)
        let seeded = try await eagerClient.getUserSession()

        let user = try await eagerClient.auth.getUser()
        XCTAssertEqual(user.status, 200)

        let afterCall = try await eagerClient.getUserSession()
        XCTAssertNotEqual(
            afterCall?.refreshToken,
            seeded?.refreshToken,
            "session middleware should have refreshed proactively before getUser"
        )
    }

    func testSignOutInvalidatesRefreshTokenServerSide() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        let session = try await signUp(client: client, integration: integration)

        let signOut = try await client.auth.signOut(
            body: AuthSignOutRequest(refreshToken: session.refreshToken)
        )
        XCTAssertEqual(signOut.status, 200)

        let freshClient = integration.makeClient()
        do {
            _ = try await freshClient.auth.refreshToken(
                body: AuthRefreshTokenRequest(refreshToken: session.refreshToken)
            )
            XCTFail("Expected the signed-out refresh token to be rejected")
        } catch let error as FetchError {
            XCTAssertEqual(error.status, 401)
        }
    }

    func testRefreshWithUnknownTokenFails() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()

        do {
            _ = try await client.auth.refreshToken(
                body: AuthRefreshTokenRequest(refreshToken: UUID().uuidString.lowercased())
            )
            XCTFail("Expected an unknown refresh token to be rejected")
        } catch let error as FetchError {
            XCTAssertEqual(error.status, 401)
        }
    }

    func testCreatePATAndSignInWithIt() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        let session = try await signUp(client: client, integration: integration)

        let pat = try await client.auth.createPAT(
            body: AuthCreatePATRequest(
                expiresAt: Date().addingTimeInterval(3600),
                metadata: ["purpose": .string("integration-test")]
            )
        )
        XCTAssertEqual(pat.status, 200)
        XCTAssertFalse(pat.body.personalAccessToken.isEmpty)

        let patClient = integration.makeClient()
        let patSignIn = try await patClient.auth.signInPAT(
            body: AuthSignInPATRequest(personalAccessToken: pat.body.personalAccessToken)
        )
        let patSession = try required(patSignIn.body.session, "PAT sign-in did not return a session")
        XCTAssertEqual(patSession.user?.id, session.user?.id)

        let storedSession = try await patClient.getUserSession()
        XCTAssertEqual(storedSession?.accessToken, patSession.accessToken)
    }

    func testChangePasswordUsesIsolatedAccountAndPreservesConfiguredCredentials() async throws {
        let integration = try IntegrationEnvironment.load()
        let configuredClient = integration.makeClient()
        _ = try await signUp(client: configuredClient, integration: integration)

        let passwordChangeAccount = integration.isolatedAuthAccount(for: "password-change")
        let client = passwordChangeAccount.makeClient()
        _ = try await signUp(client: client, integration: passwordChangeAccount)

        let newPassword = "changed-\(UUID().uuidString.lowercased())"
        let change = try await client.auth.changeUserPassword(
            body: AuthUserPasswordRequest(newPassword: newPassword)
        )
        XCTAssertEqual(change.status, 200)

        // The /user/password middleware special case clears the stored session.
        let cleared = try await client.getUserSession()
        XCTAssertNil(cleared)

        let signInResponse = try await client.auth.signInEmailPassword(
            body: AuthSignInEmailPasswordRequest(email: passwordChangeAccount.email, password: newPassword)
        )
        XCTAssertNotNil(signInResponse.body.session)

        let configuredSession = try await signIn(client: integration.makeClient(), integration: integration)
        XCTAssertEqual(configuredSession.user?.email, integration.email)
    }

    func testUnauthenticatedGetUserFails() async throws {
        let integration = try IntegrationEnvironment.load()
        let bareClient = createNhostClient(
            NhostClientOptions(
                authURL: integration.authURL,
                storageURL: integration.storageURL,
                graphqlURL: integration.graphqlURL,
                functionsURL: integration.functionsURL
            )
        )

        do {
            _ = try await bareClient.auth.getUser()
            XCTFail("Expected unauthenticated getUser to fail")
        } catch let error as FetchError {
            // The auth service rejects a missing Authorization header with 400
            // (request validation), not 401.
            XCTAssertEqual(error.status, 400)
        }
    }

    // getJWKs and getOpenIDConfiguration are deliberately not smoke-tested: the
    // local backend signs with HS256, so the server returns `keys: null` for the
    // JWKS endpoint (the spec declares a required array — see review finding 041),
    // and the OIDC discovery endpoint is not enabled locally (404).

    func testAnonymousSignInAndDeanonymize() async throws {
        // The auth spec declares user.metadata as a required non-nullable object,
        // but the server returns `metadata: null` for anonymous users, so the
        // generated decode fails — see review finding 041 (spec/server
        // mismatches). Run with NHOST_SWIFT_RUN_ANONYMOUS_TESTS=1 once the auth
        // OpenAPI spec marks it nullable and the clients are regenerated.
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["NHOST_SWIFT_RUN_ANONYMOUS_TESTS"] == "1",
            "Blocked on auth OpenAPI spec marking user.metadata nullable (review finding 041)"
        )

        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()

        let anonymous = try await client.auth.signInAnonymous()
        let anonymousSession = try required(
            anonymous.body.session,
            "Anonymous sign-in did not return a session"
        )
        XCTAssertEqual(anonymousSession.user?.isAnonymous, true)

        let storedSession = try await client.getUserSession()
        XCTAssertEqual(storedSession?.accessToken, anonymousSession.accessToken)

        let deanonymize = try await client.auth.deanonymizeUser(
            body: AuthUserDeanonymizeRequest(
                signInMethod: .emailPassword,
                email: "deanonymized-\(UUID().uuidString.lowercased())@example.com",
                password: integration.password
            )
        )
        XCTAssertEqual(deanonymize.status, 200)
        XCTAssertEqual(deanonymize.body, .ok)
    }
}

final class StorageIntegrationTests: XCTestCase {
    func testStorageVersion() async throws {
        let client = try IntegrationEnvironment.load().makeClient()
        let version = try await client.storage.getVersion()

        XCTAssertEqual(version.status, 200)
        XCTAssertEqual(version.body.buildVersion, "0.8.0-beta3")
    }

    func testStreamingUploadFromDiskRoundTripsLargeFile() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)

        let fileID = UUID().uuidString.lowercased()
        let fileName = "nhost-swift-integration-streaming-\(fileID).bin"
        // Large enough to span several streaming chunks and any transport buffering.
        let payload = Data((0..<(5 * 1024 * 1024)).map { UInt8(truncatingIfNeeded: $0 &* 31) })
        let sourceURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        try payload.write(to: sourceURL)
        defer { try? FileManager.default.removeItem(at: sourceURL) }

        var uploadedID: String?
        do {
            let upload = try await client.storage.uploadFiles(
                bucketId: integration.storageBucketID,
                files: [
                    .fileURL(
                        sourceURL,
                        id: fileID,
                        metadata: ["source": .string("streaming-integration")]
                    ),
                ]
            )
            XCTAssertEqual(upload.status, 201)
            let processed = try XCTUnwrap(upload.body.processedFiles.first)
            uploadedID = processed.id
            XCTAssertEqual(processed.id, fileID)
            XCTAssertEqual(processed.name, fileName)
            XCTAssertEqual(processed.size, payload.count)
            XCTAssertEqual(processed.metadata?["source"], .string("streaming-integration"))

            let download = try await client.storage.getFile(id: fileID)
            XCTAssertEqual(download.status, 200)
            XCTAssertEqual(download.body, payload)

            let delete = try await client.storage.deleteFile(id: fileID)
            XCTAssertEqual(delete.status, 204)
        } catch {
            if let uploadedID {
                _ = try? await client.storage.deleteFile(id: uploadedID)
            }
            throw error
        }
    }

    func testUploadReadCacheReplacePresignAndDeleteFiles() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        let session = try await signUp(client: client, integration: integration)

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
            XCTAssertFalse(first.etag.isEmpty)
            XCTAssertLessThanOrEqual(abs(first.createdAt.timeIntervalSinceNow), 300)
            XCTAssertEqual(first.uploadedByUserId, session.user?.id)

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

            let nonMatching = try await client.storage.getFileMetadataHeaders(
                id: first.id,
                headers: StorageGetFileMetadataHeadersHeaders(ifNoneMatch: "\"different-etag\"")
            )
            XCTAssertEqual(nonMatching.status, 200)
            XCTAssertNotNil(header("cache-control", in: nonMatching.headers))

            do {
                _ = try await client.storage.getFile(
                    id: first.id,
                    headers: StorageGetFileHeaders(ifNoneMatch: etag)
                )
                XCTFail("Expected matching If-None-Match download to return 304")
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

    func testStorageErrorPaths() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)

        do {
            _ = try await client.storage.uploadFiles(
                body: StorageUploadFilesBody(bucketId: integration.storageBucketID, file: [])
            )
            XCTFail("Expected an upload without files to fail")
        } catch let FetchError.http(error) {
            XCTAssertEqual(error.status, 400)
            XCTAssertNotNil(error.body)
            XCTAssertFalse(error.messages.isEmpty)
            XCTAssertNotNil(header("content-type", in: error.headers))
        }

        let missingID = UUID().uuidString.lowercased()

        do {
            _ = try await client.storage.getFile(id: missingID)
            XCTFail("Expected downloading a missing file to fail")
        } catch let FetchError.http(error) {
            XCTAssertEqual(error.status, 404)
        }

        do {
            _ = try await client.storage.deleteFile(id: missingID)
            XCTFail("Expected deleting a missing file to fail")
        } catch let FetchError.http(error) {
            XCTAssertEqual(error.status, 404)
        }
    }

    func testImageTransformationQueryParameters() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)

        let png = try required(
            Data(
                base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            ),
            "Invalid PNG fixture"
        )
        let fileID = UUID().uuidString.lowercased()

        let upload = try await client.storage.uploadFiles(
            body: StorageUploadFilesBody(
                bucketId: integration.storageBucketID,
                metadata: [
                    StorageUploadFileMetadata(id: fileID, name: "nhost-swift-\(fileID).png"),
                ],
                file: [png]
            )
        )
        XCTAssertEqual(upload.status, 201)

        do {
            let transformed = try await client.storage.getFile(
                id: fileID,
                query: StorageGetFileQuery(h: 1, q: 50, w: 1)
            )
            XCTAssertEqual(transformed.status, 200)
            XCTAssertTrue(
                header("content-type", in: transformed.headers)?.hasPrefix("image/") == true,
                "expected an image content type, got \(header("content-type", in: transformed.headers) ?? "nil")"
            )
            XCTAssertFalse(transformed.body.isEmpty)
        } catch {
            _ = try? await client.storage.deleteFile(id: fileID)
            throw error
        }

        let deleted = try await client.storage.deleteFile(id: fileID)
        XCTAssertEqual(deleted.status, 204)
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
            XCTAssertTrue(header("content-type", in: error.headers)?.hasPrefix("text/html") == true)
        }
    }

    func testGraphQLUnknownFieldReturnsValidationPath() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()
        _ = try await signUp(client: client, integration: integration)

        do {
            _ = try await client.graphql.request(JSONValue.self, query: "query { restricted { id } }")
            XCTFail("Expected an unknown field to fail validation")
        } catch let error as GraphQLExecutionError {
            let first = try required(error.errors.first, "GraphQL error payload missing")
            XCTAssertTrue(first.message.contains("restricted"), "unexpected message: \(first.message)")
            XCTAssertEqual(first.extensions?["path"], .string("$.selectionSet.restricted"))
        }
    }

    func testFunctionsGETQueryStringAndHelloworldAcceptNegotiation() async throws {
        let integration = try IntegrationEnvironment.load()
        let client = integration.makeClient()

        // GET with a query string in the path exercises the path/query splitting.
        let get = try await client.functions.fetch(
            JSONValue.self,
            path: "/echo?foo=bar",
            headers: ["Accept": "application/json"]
        )
        XCTAssertEqual(get.body.json?["method"]?.stringValue, "GET")

        let text = try await client.functions.fetch(
            JSONValue.self,
            path: "/helloworld",
            headers: ["Accept": "text/plain"]
        )
        XCTAssertEqual(text.body.text, "Hello, World!")

        let json = try await client.functions.post(JSONValue.self, path: "/helloworld")
        XCTAssertEqual(json.body.json?["message"]?.stringValue, "Hello, World!")

        do {
            _ = try await client.functions.fetch(
                JSONValue.self,
                path: "/helloworld",
                headers: ["Accept": "application/xml"]
            )
            XCTFail("Expected an unsupported Accept header to fail")
        } catch let error as FunctionsHTTPError {
            XCTAssertEqual(error.status, 400)
            XCTAssertTrue(error.messages.contains("Unsupported Accept Header"))
        }
    }

    func testAdminSessionClientActsAsImpersonatedUser() async throws {
        let integration = try IntegrationEnvironment.load()
        let userClient = integration.makeClient()
        let session = try await signUp(client: userClient, integration: integration)
        let userID = try required(session.user?.id, "Sign-up session did not include a user id")

        let adminClient = createNhostClient(
            NhostClientOptions(
                authURL: integration.authURL,
                storageURL: integration.storageURL,
                graphqlURL: integration.graphqlURL,
                functionsURL: integration.functionsURL,
                adminSession: AdminSessionOptions(
                    adminSecret: integration.adminSecret,
                    role: "user",
                    sessionVariables: ["user-id": userID]
                )
            )
        )

        let upload = try await adminClient.storage.uploadFiles(
            body: StorageUploadFilesBody(
                bucketId: integration.storageBucketID,
                file: [Data("admin-upload".utf8)]
            )
        )
        XCTAssertEqual(upload.status, 201)
        let file = try required(upload.body.processedFiles.first, "Admin upload returned no file")
        XCTAssertEqual(file.uploadedByUserId, userID, "upload should be attributed to the impersonated user")

        do {
            struct FileRecord: Decodable, Sendable {
                let id: String
                let name: String
            }
            struct FilesData: Decodable, Sendable {
                let files: [FileRecord]
            }

            let files = try await adminClient.graphql.request(
                FilesData.self,
                query: "query Files($id: uuid!) { files(where: { id: { _eq: $id } }) { id name } }",
                variables: ["id": .string(file.id)]
            )
            XCTAssertEqual(files.body.data?.files.first?.id, file.id)
        } catch {
            _ = try? await adminClient.storage.deleteFile(id: file.id)
            throw error
        }

        let deleted = try await adminClient.storage.deleteFile(id: file.id)
        XCTAssertEqual(deleted.status, 204)
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
