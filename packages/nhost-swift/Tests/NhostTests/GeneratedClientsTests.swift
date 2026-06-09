import Foundation
import XCTest
@testable import Nhost

private actor GeneratedClientRecorder {
    private var requests: [NhostRequest] = []

    func record(_ request: NhostRequest) {
        requests.append(request)
    }

    func request(at index: Int = 0) -> NhostRequest? {
        guard requests.indices.contains(index) else { return nil }
        return requests[index]
    }
}

final class GeneratedClientsTests: XCTestCase {
    func testGeneratedAuthJSONClientAndErrorPath() async throws {
        let recorder = GeneratedClientRecorder()
        let transport = StubTransport { request in
            await recorder.record(request)

            if request.method == "POST" {
                return NhostRawResponse(
                    status: 200,
                    headers: ["content-type": "application/json"],
                    body: Data(
                        #"{"session":{"accessToken":"access-token","accessTokenExpiresIn":3600,"refreshTokenId":"refresh-id","refreshToken":"refresh-token"}}"#.utf8
                    )
                )
            }

            return NhostRawResponse(
                status: 401,
                headers: ["content-type": "application/json", "x-request-id": "req-1"],
                body: Data(#"{"status":401,"message":"Unauthorized","error":"invalid-request"}"#.utf8)
            )
        }
        let client = AuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
            transport: transport
        )

        let credential = ["test", "value"].joined(separator: "-")
        let response = try await client.signInEmailPassword(
            body: AuthSignInEmailPasswordRequest(email: "me@example.test", password: credential)
        )

        let recordedRequest = await recorder.request()
        let request = try XCTUnwrap(recordedRequest)
        let decodedBody = try NhostJSON.restDecoder.decode(
            AuthSignInEmailPasswordRequest.self,
            from: try XCTUnwrap(request.body)
        )

        XCTAssertEqual(response.body.session?.accessToken, "access-token")
        XCTAssertEqual(response.status, 200)
        XCTAssertEqual(request.method, "POST")
        XCTAssertEqual(request.url.absoluteString, "https://auth.example.test/v1/signin/email-password")
        XCTAssertEqual(request.headers["accept"], "application/json")
        XCTAssertEqual(request.headers["content-type"], "application/json")
        XCTAssertEqual(decodedBody.email, "me@example.test")
        XCTAssertEqual(decodedBody.password, credential)

        do {
            _ = try await client.getJwKs()
            XCTFail("Expected a FetchError.http error")
        } catch let FetchError.http(error) {
            XCTAssertEqual(error.status, 401)
            XCTAssertEqual(error.headers["x-request-id"], "req-1")
            XCTAssertEqual(error.messages, ["Unauthorized", "invalid-request"])
            XCTAssertEqual(error.body?["error"], .string("invalid-request"))
        }
    }

    func testGeneratedAuthURLEncodedAndRedirectURLPaths() async throws {
        let recorder = GeneratedClientRecorder()
        let transport = StubTransport { request in
            await recorder.record(request)
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: Data(
                    #"{"access_token":"access-token","token_type":"bearer","expires_in":3600,"refresh_token":"refresh-token","scope":"openid"}"#.utf8
                )
            )
        }
        let client = AuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.test")),
            transport: transport
        )

        let token = try await client.oauth2Token(
            body: AuthOAuth2TokenRequest(
                grantType: .authorizationCode,
                code: "code-1",
                redirectUri: "https://app.example.test/callback",
                clientId: "client-1",
                resource: "graphql"
            )
        )

        let recordedRequest = await recorder.request()
        let request = try XCTUnwrap(recordedRequest)
        let bodyText = try XCTUnwrap(String(data: try XCTUnwrap(request.body), encoding: .utf8))

        XCTAssertEqual(token.body.accessToken, "access-token")
        XCTAssertEqual(request.method, "POST")
        XCTAssertEqual(request.url.absoluteString, "https://auth.example.test/oauth2/token")
        XCTAssertEqual(request.headers["content-type"], NhostURLEncodedFormEncoder.contentType)
        XCTAssertTrue(bodyText.split(separator: "&").contains("client_id=client-1"))
        XCTAssertTrue(bodyText.split(separator: "&").contains("code=code-1"))
        XCTAssertTrue(bodyText.split(separator: "&").contains("grant_type=authorization_code"))
        XCTAssertTrue(bodyText.split(separator: "&").contains("redirect_uri=https%3A%2F%2Fapp.example.test%2Fcallback"))
        XCTAssertTrue(bodyText.split(separator: "&").contains("resource=graphql"))

        let redirect = try client.signInProviderURL(
            provider: .github,
            query: AuthSignInProviderQuery(
                allowedRoles: ["user", "editor"],
                codeChallenge: "challenge-1",
                redirectTo: "https://app.example.test/auth/callback",
                state: "state-1"
            )
        )
        let components = try XCTUnwrap(URLComponents(url: redirect, resolvingAgainstBaseURL: false))
        let queryItems = components.queryItems ?? []

        XCTAssertEqual(components.percentEncodedPath, "/signin/provider/github")
        XCTAssertTrue(queryItems.contains(URLQueryItem(name: "allowedRoles", value: "user,editor")))
        XCTAssertTrue(queryItems.contains(URLQueryItem(name: "codeChallenge", value: "challenge-1")))
        XCTAssertTrue(queryItems.contains(URLQueryItem(name: "redirectTo", value: "https://app.example.test/auth/callback")))
        XCTAssertTrue(queryItems.contains(URLQueryItem(name: "state", value: "state-1")))

        let postAuthorizeRedirect = try client.oauth2AuthorizePostURL(
            body: AuthOauth2AuthorizePostBody(
                clientId: "client-1",
                redirectUri: "https://app.example.test/oauth/callback",
                responseType: "code",
                scope: "openid email",
                state: "state-2",
                codeChallenge: "challenge-2",
                codeChallengeMethod: "S256"
            )
        )
        let postAuthorizeComponents = try XCTUnwrap(
            URLComponents(url: postAuthorizeRedirect, resolvingAgainstBaseURL: false)
        )
        let postAuthorizeQueryItems = postAuthorizeComponents.queryItems ?? []

        XCTAssertEqual(postAuthorizeComponents.percentEncodedPath, "/oauth2/authorize")
        XCTAssertTrue(postAuthorizeQueryItems.contains(URLQueryItem(name: "client_id", value: "client-1")))
        XCTAssertTrue(postAuthorizeQueryItems.contains(URLQueryItem(name: "code_challenge", value: "challenge-2")))
        XCTAssertTrue(postAuthorizeQueryItems.contains(URLQueryItem(name: "code_challenge_method", value: "S256")))
        XCTAssertTrue(postAuthorizeQueryItems.contains(URLQueryItem(name: "redirect_uri", value: "https://app.example.test/oauth/callback")))
        XCTAssertTrue(postAuthorizeQueryItems.contains(URLQueryItem(name: "response_type", value: "code")))
        XCTAssertTrue(postAuthorizeQueryItems.contains(URLQueryItem(name: "scope", value: "openid email")))
        XCTAssertTrue(postAuthorizeQueryItems.contains(URLQueryItem(name: "state", value: "state-2")))
    }

    func testGeneratedStorageBinaryHeadersAndMultipartPaths() async throws {
        let recorder = GeneratedClientRecorder()
        let transport = StubTransport { request in
            await recorder.record(request)

            if request.method == "GET" {
                return NhostRawResponse(status: 200, headers: ["etag": "etag-1"], body: Data("file-bytes".utf8))
            }

            if request.method == "HEAD" {
                return NhostRawResponse(status: 412, headers: ["Etag": "etag-new"], body: Data())
            }

            return NhostRawResponse(
                status: 201,
                headers: ["content-type": "application/json"],
                body: Data(
                    #"{"processedFiles":[{"id":"file-1","name":"avatar.png","size":10,"bucketId":"avatars","etag":"etag-2","createdAt":"2026-06-09T12:00:00Z","updatedAt":"2026-06-09T12:00:01Z","isUploaded":true,"mimeType":"image/png","metadata":{"kind":"avatar"}}]}"#.utf8
                )
            )
        }
        let client = StorageClient(
            baseURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
            transport: transport
        )

        let binary = try await client.getFile(
            id: "folder/file 1.png",
            query: StorageGetFileQuery(f: .webp, h: 64, q: 80, w: 64),
            headers: StorageGetFileHeaders(range: "bytes=0-9", ifNoneMatch: "etag-old")
        )

        let recordedGetRequest = await recorder.request()
        let getRequest = try XCTUnwrap(recordedGetRequest)
        let getComponents = try XCTUnwrap(URLComponents(url: getRequest.url, resolvingAgainstBaseURL: false))
        let getQueryItems = getComponents.queryItems ?? []

        XCTAssertEqual(binary.body, Data("file-bytes".utf8))
        XCTAssertEqual(binary.headers["etag"], "etag-1")
        XCTAssertEqual(getRequest.method, "GET")
        XCTAssertEqual(getComponents.percentEncodedPath, "/v1/files/folder%2Ffile%201.png")
        XCTAssertEqual(getRequest.headers["Range"], "bytes=0-9")
        XCTAssertEqual(getRequest.headers["if-none-match"], "etag-old")
        XCTAssertTrue(getQueryItems.contains(URLQueryItem(name: "f", value: "webp")))
        XCTAssertTrue(getQueryItems.contains(URLQueryItem(name: "h", value: "64")))
        XCTAssertTrue(getQueryItems.contains(URLQueryItem(name: "q", value: "80")))
        XCTAssertTrue(getQueryItems.contains(URLQueryItem(name: "w", value: "64")))

        let upload = try await client.uploadFiles(
            body: StorageUploadFilesBody(
                bucketId: "avatars",
                metadata: [
                    StorageUploadFileMetadata(
                        id: "file-1",
                        name: "avatar.png",
                        metadata: ["kind": .string("avatar")]
                    ),
                ],
                file: [Data("png-bytes".utf8)]
            )
        )

        let recordedUploadRequest = await recorder.request(at: 1)
        let uploadRequest = try XCTUnwrap(recordedUploadRequest)
        let uploadBody = try XCTUnwrap(uploadRequest.body)
        let uploadBodyText = try XCTUnwrap(String(data: uploadBody, encoding: .utf8))

        XCTAssertEqual(upload.body.processedFiles.first?.id, "file-1")
        XCTAssertEqual(upload.body.processedFiles.first?.metadata?["kind"], .string("avatar"))
        XCTAssertEqual(uploadRequest.method, "POST")
        XCTAssertEqual(uploadRequest.url.absoluteString, "https://storage.example.test/v1/files")
        XCTAssertEqual(uploadRequest.headers["accept"], "application/json")
        XCTAssertTrue(uploadRequest.headers["content-type"]?.hasPrefix("multipart/form-data; boundary=") == true)
        XCTAssertTrue(uploadBodyText.contains(#"name="bucket-id""#))
        XCTAssertTrue(uploadBodyText.contains(#"name="file[]""#))
        XCTAssertTrue(uploadBodyText.contains(#"name="metadata[]""#))
        XCTAssertTrue(uploadBodyText.contains("png-bytes"))

        do {
            _ = try await client.getFileMetadataHeaders(
                id: "file-1",
                headers: StorageGetFileMetadataHeadersHeaders(ifMatch: "etag-old")
            )
            XCTFail("Expected a FetchError.http error")
        } catch let FetchError.http(error) {
            XCTAssertEqual(error.status, 412)
            XCTAssertEqual(error.headers["Etag"], "etag-new")
            XCTAssertEqual(error.rawBody, Data())
            XCTAssertNil(error.body)
        }
    }
}
