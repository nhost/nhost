import Foundation
import XCTest
@testable import Nhost

final class ManagedSessionFailureMiddlewareTests: XCTestCase {
    func testStorageFailuresAreNotSwallowed() async throws {
        let replacement = try testAuthSession(exp: testNowSeconds + 600)
        let writeBackend = FaultInjectingSessionBackend(setFailures: 1)
        let producerTransport = ManagedRecordingTransport { _ in
            NhostRawResponse(
                status: 200,
                body: try NhostJSON.restEncoder.encode(AuthSessionPayload(session: replacement))
            )
        }
        let producerPipeline = makeManagedPipeline(
            store: SessionStore(storage: writeBackend),
            transport: producerTransport
        )
        do {
            _ = try await producerPipeline.send(managedRequest("POST", "/signin/anonymous", body: Data("{}".utf8)))
            XCTFail("Expected storage write failure")
        } catch let error as ManagedMiddlewareTestError {
            XCTAssertEqual(error, .storageWrite)
        }

        let readBackend = FaultInjectingSessionBackend(getFailure: .storageRead)
        let directTransport = ManagedRecordingTransport { _ in
            XCTFail("transport must not run after storage read failure")
            return NhostRawResponse(status: 500)
        }
        let directPipeline = makeManagedPipeline(store: SessionStore(storage: readBackend), transport: directTransport)
        let directBody = try NhostJSON.restEncoder.encode(AuthRefreshTokenRequest(refreshToken: "token"))
        do {
            _ = try await directPipeline.send(managedRequest("POST", "/token", body: directBody))
            XCTFail("Expected storage read failure")
        } catch let error as ManagedMiddlewareTestError {
            XCTAssertEqual(error, .storageRead)
        }
    }

    func testUserMiddlewareCannotRewriteRepeatOrReenterManagedAuth() async throws {
        let store = SessionStore(storage: MemorySessionStorageBackend())
        let transport = ManagedRecordingTransport { _ in NhostRawResponse(status: 200, body: Data(#"{"ok":true}"#.utf8)) }
        let rewrite: ChainFunction = { request, next in
            var request = request
            request.url = URL(string: "https://auth.example.test/v1/token")!
            return try await next(request)
        }
        let rewritePipeline = makeManagedPipeline(store: store, transport: transport, userMiddleware: [rewrite])
        do {
            _ = try await rewritePipeline.send(managedRequest("POST", "/signin/otp/email", body: Data("{}".utf8)))
            XCTFail("Expected rewrite rejection")
        } catch let error as ManagedSessionError {
            XCTAssertEqual(error, .managedRequestWasRewritten)
        }

        let repeatMiddleware: ChainFunction = { request, next in
            _ = try await next(request)
            return try await next(request)
        }
        let repeatPipeline = makeManagedPipeline(
            store: SessionStore(storage: MemorySessionStorageBackend()),
            transport: transport,
            userMiddleware: [repeatMiddleware]
        )
        do {
            _ = try await repeatPipeline.send(managedRequest("POST", "/signin/anonymous", body: Data("{}".utf8)))
            XCTFail("Expected repeated terminal request rejection")
        } catch let error as ManagedSessionError {
            XCTAssertEqual(error, .managedRequestWasRewritten)
        }

        let recursiveBox = RecursiveManagedFetchBox()
        let recursiveMiddleware: ChainFunction = { request, next in
            let nested = NhostRequest(
                method: "GET",
                url: URL(string: "https://auth.example.test/v1/healthz")!
            )
            _ = try await recursiveBox.fetch(nested)
            return try await next(request)
        }
        let recursivePipeline = makeManagedPipeline(
            store: SessionStore(storage: MemorySessionStorageBackend()),
            transport: transport,
            userMiddleware: [recursiveMiddleware]
        )
        recursiveBox.set(recursivePipeline.fetch)
        do {
            _ = try await recursivePipeline.send(managedRequest("POST", "/signin/anonymous", body: Data("{}".utf8)))
            XCTFail("Expected managed reentry rejection")
        } catch let error as ManagedSessionError {
            XCTAssertEqual(error, .reentrantManagedOperation)
        }
    }

}
