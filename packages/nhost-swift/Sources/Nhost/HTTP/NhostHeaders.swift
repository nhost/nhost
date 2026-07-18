import Foundation

enum NhostHeaderLookup {
    static func canonicalName(_ name: String) -> String {
        name.lowercased()
    }

    /// Returns one lowercase key per HTTP field name. Sorting makes malformed input that contains
    /// case variants deterministic; for valid ASCII field names, the lowercase spelling wins.
    static func normalized(_ headers: [String: String]) -> [String: String] {
        var normalizedHeaders: [String: String] = [:]

        for name in headers.keys.sorted() {
            normalizedHeaders[canonicalName(name)] = headers[name]
        }

        return normalizedHeaders
    }

    static func merging(
        base: [String: String],
        overrides: [String: String]
    ) -> [String: String] {
        var headers = normalized(base)

        for name in overrides.keys.sorted() {
            headers[canonicalName(name)] = overrides[name]
        }

        return headers
    }

    static func value(in headers: [String: String], named name: String) -> String? {
        let canonicalName = canonicalName(name)
        if let value = headers[canonicalName] {
            return value
        }

        // Custom transports may preserve server spelling. Sort matching variants so even an
        // invalid dictionary containing duplicate case variants has a deterministic result.
        let matchingName = headers.keys
            .filter { $0.lowercased() == canonicalName }
            .sorted()
            .last
        return matchingName.flatMap { headers[$0] }
    }

    static func hasHeader(_ headers: [String: String], named name: String) -> Bool {
        value(in: headers, named: name) != nil
    }

    static func setHeader(_ name: String, _ value: String?, on headers: inout [String: String]) {
        let canonicalName = canonicalName(name)
        headers.keys
            .filter { $0.lowercased() == canonicalName }
            .forEach { headers.removeValue(forKey: $0) }

        if let value {
            headers[canonicalName] = value
        }
    }

    static func setHeaderIfAbsent(_ name: String, _ value: String, on headers: inout [String: String]) {
        headers = normalized(headers)
        guard !hasHeader(headers, named: name) else { return }
        headers[canonicalName(name)] = value
    }

    static func setHeaderIfAbsent(_ name: String, _ value: String, on request: inout NhostRequest) {
        guard !hasHeader(request.headers, named: name) else { return }
        request.setHeader(name, value)
    }
}
