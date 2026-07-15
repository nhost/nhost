import Foundation
import XCTest
@testable import Nhost

private actor ServiceRequestRecorder {
    private var requests: [NhostRequest] = []

    func record(_ request: NhostRequest) {
        requests.append(request)
    }

    func request(at index: Int = 0) -> NhostRequest? {
        guard requests.indices.contains(index) else { return nil }
        return requests[index]
    }

    func allRequests() -> [NhostRequest] {
        requests
    }
}

private actor TopLevelServiceTransport: HTTPTransport {
    private var requests: [NhostRequest] = []

    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        requests.append(request)

        if request.url.host == "graphql.example.test" {
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: Data(#"{"data":{"ok":true}}"#.utf8)
            )
        }

        if request.url.host == "functions.example.test" {
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "text/plain; charset=utf-8"],
                body: Data("function-ok".utf8)
            )
        }

        return NhostRawResponse(
            status: 200,
            headers: ["content-type": "application/json"],
            body: try NhostJSON.restEncoder.encode(try testAuthSession(exp: Int(Date().timeIntervalSince1970) + 600))
        )
    }

    func request(host: String) -> NhostRequest? {
        requests.first { $0.url.host == host }
    }
}

private struct Todo: Decodable, Equatable, Sendable {
    let id: String
    let title: String
}

private struct TodosData: Decodable, Equatable, Sendable {
    let todos: [Todo]
}

private struct DateData: Decodable, Equatable, Sendable {
    let createdAt: Date
}

private struct FunctionJSON: Codable, Equatable, Sendable {
    let ok: Bool
    let value: String?
}

private struct BoolData: Decodable, Equatable, Sendable {
    let ok: Bool
}

final class GraphQLClientTests: XCTestCase {
    func testGraphQLSuccessEncodesVariablesAndCustomHeaders() async throws {
        let recorder = ServiceRequestRecorder()
        let client = GraphQLClient(
            url: try XCTUnwrap(URL(string: "https://graphql.example.test/v1")),
            transport: StubTransport { request in
                await recorder.record(request)
                return NhostRawResponse(
                    status: 200,
                    headers: ["content-type": "application/json", "x-request-id": "req-1"],
                    body: Data(#"{"data":{"todos":[{"id":"todo-1","title":"Ship SDK"}]}}"#.utf8)
                )
            }
        )

        let response = try await client.request(
            TodosData.self,
            query: "query Todos($limit: Int!) { todos(limit: $limit) { id title } }",
            variables: ["limit": .number(1)],
            operationName: "Todos",
            headers: ["Content-Type": "application/graphql+json", "x-custom": "yes"]
        )

        let recordedRequest = await recorder.request()
        let request = try XCTUnwrap(recordedRequest)
        let body = try XCTUnwrap(request.body)
        let decodedRequest = try NhostJSON.neutralDecoder.decode(GraphQLRequest.self, from: body)

        XCTAssertEqual(response.status, 200)
        XCTAssertEqual(response.headers["x-request-id"], "req-1")
        XCTAssertEqual(response.body.data?.todos, [Todo(id: "todo-1", title: "Ship SDK")])
        XCTAssertNil(response.body.errors)
        XCTAssertEqual(request.method, "POST")
        XCTAssertEqual(request.url.absoluteString, "https://graphql.example.test/v1")
        XCTAssertEqual(request.headers["Content-Type"], "application/graphql+json")
        XCTAssertNil(request.headers["content-type"])
        XCTAssertEqual(request.headers["accept"], "application/json")
        XCTAssertEqual(request.headers["x-custom"], "yes")
        XCTAssertEqual(decodedRequest.variables?["limit"], .number(1))
        XCTAssertEqual(decodedRequest.operationName, "Todos")
    }

    func testGraphQLErrorsThrowStructuredError() async throws {
        let client = GraphQLClient(
            url: try XCTUnwrap(URL(string: "https://graphql.example.test/v1")),
            transport: StubTransport { _ in
                NhostRawResponse(
                    status: 200,
                    headers: ["content-type": "application/json", "x-request-id": "req-2"],
                    body: Data(
                        #"""
                        {
                          "data": {"todos": null},
                          "errors": [{
                            "message": "not allowed",
                            "locations": [{"line": 2, "column": 3}],
                            "path": ["todos", 0],
                            "extensions": {
                              "code": "permission-error",
                              "path": "$.selectionSet.todos"
                            }
                          }]
                        }
                        """#.utf8
                    )
                )
            }
        )

        do {
            _ = try await client.request(TodosData.self, query: "query { todos { id } }")
            XCTFail("Expected a GraphQLExecutionError")
        } catch let error as GraphQLExecutionError {
            XCTAssertEqual(error.status, 200)
            XCTAssertEqual(error.headers["x-request-id"], "req-2")
            XCTAssertEqual(error.messages, ["not allowed"])
            XCTAssertEqual(error.errors.first?.locations, [GraphQLErrorLocation(line: 2, column: 3)])
            XCTAssertEqual(error.errors.first?.path, [.string("todos"), .number(0)])
            XCTAssertEqual(error.errors.first?.extensions?["code"], .string("permission-error"))
            XCTAssertEqual(error.data?["todos"], .null)
            XCTAssertFalse(error.rawBody.isEmpty)
        }
    }

    func testGraphQLReturnsNonSuccessResponsesWithoutGraphQLErrors() async throws {
        let client = GraphQLClient(
            url: try XCTUnwrap(URL(string: "https://graphql.example.test/v1")),
            transport: StubTransport { _ in
                NhostRawResponse(
                    status: 401,
                    headers: ["content-type": "application/json", "x-request-id": "req-http"],
                    body: Data(#"{"data":{"ok":false}}"#.utf8)
                )
            }
        )

        let response = try await client.request(BoolData.self, query: "query { ok }")

        XCTAssertEqual(response.status, 401)
        XCTAssertEqual(response.headers["x-request-id"], "req-http")
        XCTAssertEqual(response.body.data?.ok, false)
        XCTAssertNil(response.body.errors)
    }

    func testGraphQLUsesNeutralDecoderUnlessCallerSuppliesOne() async throws {
        let responseBody = Data(#"{"data":{"createdAt":"2026-06-09T12:00:00Z"}}"#.utf8)
        let client = GraphQLClient(
            url: try XCTUnwrap(URL(string: "https://graphql.example.test/v1")),
            transport: StubTransport { _ in
                NhostRawResponse(status: 200, headers: ["content-type": "application/json"], body: responseBody)
            }
        )

        do {
            _ = try await client.request(DateData.self, query: "query { createdAt }")
            XCTFail("Expected neutral JSONDecoder to reject an RFC3339 Date string")
        } catch let FetchError.decoding(message) {
            XCTAssertFalse(message.isEmpty)
        }

        let decoded = try await client.request(
            DateData.self,
            query: "query { createdAt }",
            decoder: { NhostJSON.restDecoder }
        )
        let trailingClosureDecoded = try await client.request(
            DateData.self,
            query: "query { createdAt }"
        ) { NhostJSON.restDecoder }
        XCTAssertEqual(decoded.body.data?.createdAt, NhostJSON.parse("2026-06-09T12:00:00Z"))
        XCTAssertEqual(
            trailingClosureDecoded.body.data?.createdAt,
            NhostJSON.parse("2026-06-09T12:00:00Z")
        )
    }
}

final class FunctionsClientTests: XCTestCase {
    func testFunctionsParsesJSONTextAndBinaryResponses() async throws {
        let client = FunctionsClient(
            baseURL: try XCTUnwrap(URL(string: "https://functions.example.test/v1")),
            transport: StubTransport { request in
                if request.url.path.hasSuffix("/json") {
                    return NhostRawResponse(
                        status: 200,
                        headers: ["content-type": "application/json"],
                        body: Data(#"{"ok":true,"value":"json"}"#.utf8)
                    )
                }

                if request.url.path.hasSuffix("/text") {
                    return NhostRawResponse(
                        status: 200,
                        headers: ["content-type": "text/plain; charset=utf-8"],
                        body: Data("plain text".utf8)
                    )
                }

                return NhostRawResponse(
                    status: 200,
                    headers: ["content-type": "application/octet-stream"],
                    body: Data([0, 1, 2, 3])
                )
            }
        )

        let json = try await client.fetch(FunctionJSON.self, path: "/json")
        let text = try await client.fetch(JSONValue.self, path: "/text")
        let binary = try await client.fetch(JSONValue.self, path: "/binary")

        XCTAssertEqual(json.body, .json(FunctionJSON(ok: true, value: "json")))
        XCTAssertEqual(text.body, .text("plain text"))
        XCTAssertEqual(binary.body, .data(Data([0, 1, 2, 3])))
    }

    func testFunctionsPostEncodesJSONAndPreservesCustomHeaders() async throws {
        let recorder = ServiceRequestRecorder()
        let client = FunctionsClient(
            baseURL: try XCTUnwrap(URL(string: "https://functions.example.test/v1")),
            transport: StubTransport { request in
                await recorder.record(request)
                return NhostRawResponse(
                    status: 200,
                    headers: ["content-type": "application/json"],
                    body: Data(#"{"ok":true,"value":"posted"}"#.utf8)
                )
            }
        )

        let response = try await client.post(
            FunctionJSON.self,
            path: "echo?trace=1",
            body: ["name": JSONValue.string("Ada")],
            headers: ["Accept": "text/plain", "x-custom": "yes"]
        )

        let recordedRequest = await recorder.request()
        let request = try XCTUnwrap(recordedRequest)
        let body = try XCTUnwrap(request.body)
        let decodedBody = try NhostJSON.neutralDecoder.decode([String: JSONValue].self, from: body)

        XCTAssertEqual(response.body, .json(FunctionJSON(ok: true, value: "posted")))
        XCTAssertEqual(request.method, "POST")
        XCTAssertEqual(request.url.absoluteString, "https://functions.example.test/v1/echo?trace=1")
        XCTAssertEqual(request.headers["Accept"], "text/plain")
        XCTAssertNil(request.headers["accept"])
        XCTAssertEqual(request.headers["content-type"], "application/json")
        XCTAssertEqual(request.headers["x-custom"], "yes")
        XCTAssertEqual(decodedBody["name"], .string("Ada"))
    }

    func testFunctionsNonSuccessThrowsStructuredError() async throws {
        let client = FunctionsClient(
            baseURL: try XCTUnwrap(URL(string: "https://functions.example.test/v1")),
            transport: StubTransport { _ in
                NhostRawResponse(
                    status: 418,
                    headers: ["content-type": "text/plain", "x-request-id": "req-3"],
                    body: Data("short and stout".utf8)
                )
            }
        )

        do {
            _ = try await client.fetch(JSONValue.self, path: "/teapot")
            XCTFail("Expected a FunctionsHTTPError")
        } catch let error as FunctionsHTTPError {
            XCTAssertEqual(error.status, 418)
            XCTAssertEqual(error.headers["x-request-id"], "req-3")
            XCTAssertEqual(error.messages, ["short and stout"])
            XCTAssertEqual(error.body, .text("short and stout"))
            XCTAssertEqual(error.rawBody, Data("short and stout".utf8))
        }
    }

    func testFunctionsUsesNeutralDecoderUnlessCallerSuppliesOne() async throws {
        let responseBody = Data(#"{"createdAt":"2026-06-09T12:00:00Z"}"#.utf8)
        let client = FunctionsClient(
            baseURL: try XCTUnwrap(URL(string: "https://functions.example.test/v1")),
            transport: StubTransport { _ in
                NhostRawResponse(status: 200, headers: ["content-type": "application/json"], body: responseBody)
            }
        )

        do {
            _ = try await client.fetch(DateData.self, path: "/date")
            XCTFail("Expected neutral JSONDecoder to reject an RFC3339 Date string")
        } catch let FetchError.decoding(message) {
            XCTAssertFalse(message.isEmpty)
        }

        let decoded = try await client.fetch(DateData.self, path: "/date", decoder: { NhostJSON.restDecoder })
        let expectedDate = try XCTUnwrap(NhostJSON.parse("2026-06-09T12:00:00Z"))
        XCTAssertEqual(decoded.body, .json(DateData(createdAt: expectedDate)))
    }
}

final class TopLevelServiceClientTests: XCTestCase {
    func testNhostClientExposesGraphQLAndFunctionsWithSharedMiddleware() async throws {
        let session = try StoredSession(try testAuthSession(exp: Int(Date().timeIntervalSince1970) + 600))
        let transport = TopLevelServiceTransport()
        let graphqlURL = try XCTUnwrap(URL(string: "https://graphql.example.test/v1"))
        let functionsURL = try XCTUnwrap(URL(string: "https://functions.example.test/v1"))
        let client = createClient(
            NhostClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                storageURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
                graphqlURL: graphqlURL,
                functionsURL: functionsURL,
                sessionManagement: .processLocal(
                    storage: MemorySessionStorageBackend(session: session)
                ),
                transport: transport,
                defaultHeaders: ["x-sdk": "swift"],
                role: "user",
                adminSession: AdminSessionOptions(adminSecret: "secret")
            )
        )

        let graphql = try await client.graphql.request(BoolData.self, query: "query { ok }")
        let function = try await client.functions.fetch(JSONValue.self, path: "/hello")

        let recordedGraphQLRequest = await transport.request(host: "graphql.example.test")
        let recordedFunctionsRequest = await transport.request(host: "functions.example.test")
        let graphqlRequest = try XCTUnwrap(recordedGraphQLRequest)
        let functionsRequest = try XCTUnwrap(recordedFunctionsRequest)

        XCTAssertEqual(client.serviceURLs.graphql, graphqlURL)
        XCTAssertEqual(client.serviceURLs.functions, functionsURL)
        XCTAssertEqual(client.graphql.url, graphqlURL)
        XCTAssertEqual(client.functions.baseURL, functionsURL)
        XCTAssertEqual(graphql.body.data?.ok, true)
        XCTAssertEqual(function.body, .text("function-ok"))

        for request in [graphqlRequest, functionsRequest] {
            XCTAssertEqual(request.headers["Authorization"], "Bearer \(session.accessToken)")
            XCTAssertEqual(request.headers["x-sdk"], "swift")
            XCTAssertEqual(request.headers["x-hasura-role"], "user")
            XCTAssertEqual(request.headers["x-hasura-admin-secret"], "secret")
        }
    }
}
