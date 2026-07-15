import Foundation

struct ManagedAuthRequestClassifier: Sendable {
    private static let providers: Set<String> = [
        "apple", "github", "google", "linkedin", "discord", "spotify", "twitch", "gitlab",
        "bitbucket", "workos", "azuread", "entraid", "strava", "facebook", "windowslive", "twitter",
    ]

    private let scheme: String?
    private let host: String?
    private let port: Int?
    private let user: String?
    private let password: String?
    private let basePath: String

    init(baseURL: URL) {
        let components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        scheme = components?.scheme?.lowercased()
        host = components?.host?.lowercased()
        port = Self.effectivePort(components)
        user = components?.user
        password = components?.password
        basePath = Self.normalizedBasePath(components?.percentEncodedPath ?? "")
    }

    func operation(for request: NhostRequest) -> ManagedAuthOperationAudit? {
        guard request.method == request.method.uppercased(),
              let components = URLComponents(url: request.url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == scheme,
              components.host?.lowercased() == host,
              Self.effectivePort(components) == port,
              components.user == user,
              components.password == password,
              components.fragment == nil,
              let relativePath = relativePath(from: components.percentEncodedPath)
        else {
            return nil
        }

        return ManagedAuthOperationAudit.entries.first { entry in
            guard entry.method == request.method else { return false }
            return Self.matches(entry.path, relativePath: relativePath)
        }
    }

    private func relativePath(from requestPath: String) -> String? {
        if basePath.isEmpty {
            return requestPath.isEmpty ? "/" : requestPath
        }
        guard requestPath.hasPrefix(basePath) else { return nil }
        let boundary = requestPath.index(requestPath.startIndex, offsetBy: basePath.count)
        guard boundary < requestPath.endIndex, requestPath[boundary] == "/" else { return nil }
        return String(requestPath[boundary...])
    }

    private static func matches(_ pattern: ManagedAuthPath, relativePath: String) -> Bool {
        switch pattern {
        case let .exact(path):
            return relativePath == path
        case .providerCallbackTokens:
            let parts = relativePath.split(separator: "/", omittingEmptySubsequences: false)
            return parts.count == 6
                && parts[0].isEmpty
                && parts[1] == "signin"
                && parts[2] == "provider"
                && providers.contains(String(parts[3]))
                && parts[4] == "callback"
                && parts[5] == "tokens"
        case .providerRefresh:
            let parts = relativePath.split(separator: "/", omittingEmptySubsequences: false)
            return parts.count == 4
                && parts[0].isEmpty
                && parts[1] == "token"
                && parts[2] == "provider"
                && providers.contains(String(parts[3]))
        case .urlOnly:
            return false
        }
    }

    private static func normalizedBasePath(_ path: String) -> String {
        var path = path
        while path.count > 1, path.hasSuffix("/") {
            path.removeLast()
        }
        return path == "/" ? "" : path
    }

    private static func effectivePort(_ components: URLComponents?) -> Int? {
        if let port = components?.port { return port }
        switch components?.scheme?.lowercased() {
        case "http": return 80
        case "https": return 443
        default: return nil
        }
    }
}

func auditedManagedAuthOperation(
    for request: NhostRequest,
    authBaseURL: URL
) -> ManagedAuthOperationAudit? {
    ManagedAuthRequestClassifier(baseURL: authBaseURL).operation(for: request)
}

final class ManagedAuthRequestExpectation: @unchecked Sendable {
    private let lock = NSLock()
    let operationID: String?
    let requiresExactCredentialRequest: Bool
    let method: String
    let body: Data?
    let authorization: String?
    private var terminalCalls = 0

    init(operation: ManagedAuthOperationAudit?, request: NhostRequest) {
        operationID = operation?.operationID
        requiresExactCredentialRequest = operation?.policy.fullTransaction == true
        method = request.method
        body = request.body
        authorization = NhostHeaderLookup.value(in: request.headers, named: "Authorization")
    }

    func validateTerminalRequest(
        _ request: NhostRequest,
        operation: ManagedAuthOperationAudit?
    ) throws {
        let callCount = lock.withLock {
            terminalCalls += 1
            return terminalCalls
        }
        guard !requiresExactCredentialRequest || callCount == 1,
              operation?.operationID == operationID
        else {
            throw ManagedSessionError.managedRequestWasRewritten
        }

        if requiresExactCredentialRequest {
            guard request.method == method,
                  request.body == body,
                  NhostHeaderLookup.value(in: request.headers, named: "Authorization") == authorization
            else {
                throw ManagedSessionError.managedRequestWasRewritten
            }
        }
    }

    func validateCompletion() throws {
        guard !requiresExactCredentialRequest || lock.withLock({ terminalCalls == 1 }) else {
            throw ManagedSessionError.managedRequestWasRewritten
        }
    }
}

enum ManagedSessionTaskContext {
    @TaskLocal static var holdsLease = false
    @TaskLocal static var requestExpectation: ManagedAuthRequestExpectation?
}
