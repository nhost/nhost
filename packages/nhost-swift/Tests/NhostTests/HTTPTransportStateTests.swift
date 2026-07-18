import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import XCTest
@testable import Nhost

final class HTTPTransportStateTests: XCTestCase {
    func testDefaultTransportCannotReplaySharedCookiesOrCredentials() throws {
        let host = "l06-\(UUID().uuidString.lowercased()).example.test"
        let url = try XCTUnwrap(URL(string: "https://\(host)/v1"))
        let cookie = try XCTUnwrap(
            HTTPCookie(
                properties: [
                    .name: "nhost-affinity",
                    .value: "shared-cookie",
                    .domain: host,
                    .path: "/",
                    .secure: "TRUE",
                    .expires: Date(timeIntervalSinceNow: 3_600)
                ]
            )
        )
        let protectionSpace = URLProtectionSpace(
            host: host,
            port: 443,
            protocol: "https",
            realm: "nhost-l06",
            authenticationMethod: NSURLAuthenticationMethodHTTPBasic
        )
        let credential = URLCredential(
            user: "shared-user",
            password: "shared-password",
            persistence: .forSession
        )

        HTTPCookieStorage.shared.setCookie(cookie)
        URLCredentialStorage.shared.setDefaultCredential(credential, for: protectionSpace)
        defer {
            HTTPCookieStorage.shared.deleteCookie(cookie)
            URLCredentialStorage.shared.remove(credential, for: protectionSpace)
        }

        let replayableCookies = try XCTUnwrap(HTTPCookieStorage.shared.cookies(for: url))
        XCTAssertEqual(
            HTTPCookie.requestHeaderFields(with: replayableCookies)["Cookie"],
            "nhost-affinity=shared-cookie"
        )
        XCTAssertEqual(
            URLCredentialStorage.shared.defaultCredential(for: protectionSpace)?.user,
            "shared-user"
        )

        let configuration = URLSessionTransport().sessionConfiguration
        XCTAssertNil(configuration.httpCookieStorage)
        XCTAssertFalse(configuration.httpShouldSetCookies)
        XCTAssertNil(configuration.urlCredentialStorage)
        XCTAssertNil(configuration.urlCache)
        XCTAssertEqual(configuration.requestCachePolicy, .reloadIgnoringLocalCacheData)
    }

    func testInjectedSessionPreservesCookieAndCredentialStorageOptIn() throws {
        let host = "l06-injected-\(UUID().uuidString.lowercased()).example.test"
        let url = try XCTUnwrap(URL(string: "https://\(host)/v1"))
        let cookie = try XCTUnwrap(
            HTTPCookie(
                properties: [
                    .name: "nhost-affinity",
                    .value: "injected-cookie",
                    .domain: host,
                    .path: "/",
                    .secure: "TRUE"
                ]
            )
        )
        let protectionSpace = URLProtectionSpace(
            host: host,
            port: 443,
            protocol: "https",
            realm: "nhost-l06-injected",
            authenticationMethod: NSURLAuthenticationMethodHTTPBasic
        )
        let credential = URLCredential(
            user: "injected-user",
            password: "injected-password",
            persistence: .forSession
        )
        let cookieStorage = HTTPCookieStorage.shared
        let credentialStorage = URLCredentialStorage.shared

        cookieStorage.setCookie(cookie)
        credentialStorage.setDefaultCredential(credential, for: protectionSpace)
        defer {
            cookieStorage.deleteCookie(cookie)
            credentialStorage.remove(credential, for: protectionSpace)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = cookieStorage
        configuration.httpShouldSetCookies = true
        configuration.urlCredentialStorage = credentialStorage
        let transport = URLSessionTransport(session: URLSession(configuration: configuration))
        let injectedConfiguration = transport.sessionConfiguration

        let injectedCookies = try XCTUnwrap(injectedConfiguration.httpCookieStorage?.cookies(for: url))
        XCTAssertEqual(
            HTTPCookie.requestHeaderFields(with: injectedCookies)["Cookie"],
            "nhost-affinity=injected-cookie"
        )
        XCTAssertTrue(injectedConfiguration.httpShouldSetCookies)
        XCTAssertEqual(
            injectedConfiguration.urlCredentialStorage?
                .defaultCredential(for: protectionSpace)?.user,
            "injected-user"
        )
    }

    func testDefaultTransportStillEmitsExplicitAuthorizationAndCookieHeaders() throws {
        let request = NhostRequest(
            method: "GET",
            url: try XCTUnwrap(URL(string: "https://example.test/v1")),
            headers: [
                "Authorization": "Bearer explicit-token",
                "Cookie": "explicit-cookie=value"
            ]
        )

        let urlRequest = URLSessionTransport.urlRequest(from: request)

        XCTAssertEqual(
            urlRequest.value(forHTTPHeaderField: "Authorization"),
            "Bearer explicit-token"
        )
        XCTAssertEqual(
            urlRequest.value(forHTTPHeaderField: "Cookie"),
            "explicit-cookie=value"
        )
    }
}
