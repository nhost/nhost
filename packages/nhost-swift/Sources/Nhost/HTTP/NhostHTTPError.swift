import Foundation

public struct NhostHTTPError: Error, Sendable, Equatable {
    public let status: Int
    public let headers: [String: String]
    public let body: JSONValue?
    public let rawBody: Data
    public let messages: [String]

    public init(
        status: Int,
        headers: [String: String],
        body: JSONValue?,
        rawBody: Data,
        messages: [String]
    ) {
        self.status = status
        self.headers = headers
        self.body = body
        self.rawBody = rawBody
        self.messages = messages
    }

    public static func decode(status: Int, headers: [String: String], body rawBody: Data) -> NhostHTTPError {
        let decodedBody = try? NhostJSON.restDecoder.decode(JSONValue.self, from: rawBody)
        let messages = NhostErrorMessageExtractor.messages(from: decodedBody, status: status)

        return NhostHTTPError(
            status: status,
            headers: headers,
            body: decodedBody,
            rawBody: rawBody,
            messages: messages
        )
    }
}

public enum FetchError: Error, Sendable, Equatable {
    case transport(String)
    case invalidResponse(String)
    case encoding(String)
    case decoding(String)
    case http(NhostHTTPError)

    public var status: Int? {
        guard case let .http(error) = self else { return nil }
        return error.status
    }

    public var headers: [String: String] {
        guard case let .http(error) = self else { return [:] }
        return error.headers
    }

    public var body: JSONValue? {
        guard case let .http(error) = self else { return nil }
        return error.body
    }

    public var messages: [String] {
        switch self {
        case let .transport(message), let .invalidResponse(message), let .encoding(message), let .decoding(message):
            [message]
        case let .http(error):
            error.messages
        }
    }
}

extension FetchError: LocalizedError {
    public var errorDescription: String? {
        messages.joined(separator: ", ")
    }
}

enum NhostErrorMessageExtractor {
    static func messages(from body: JSONValue?, status: Int) -> [String] {
        var messages: [String] = []

        if let body {
            collectMessages(from: body, into: &messages)
        }

        if messages.isEmpty {
            messages.append("HTTP request failed with status \(status)")
        }

        return messages
    }

    private static func collectMessages(from value: JSONValue, into messages: inout [String]) {
        switch value {
        case let .string(message):
            append(message, into: &messages)
        case let .array(values):
            values.forEach { collectMessages(from: $0, into: &messages) }
        case let .object(object):
            collectCommonMessageFields(from: object, into: &messages)
        case .null, .bool, .number:
            return
        }
    }

    private static func collectCommonMessageFields(
        from object: [String: JSONValue],
        into messages: inout [String]
    ) {
        ["message", "error", "description"].forEach { key in
            guard let value = object[key] else { return }
            collectMessages(from: value, into: &messages)
        }

        ["errors", "details"].forEach { key in
            guard let value = object[key] else { return }
            collectMessages(from: value, into: &messages)
        }
    }

    private static func append(_ message: String, into messages: inout [String]) {
        guard !message.isEmpty, !messages.contains(message) else { return }
        messages.append(message)
    }
}
