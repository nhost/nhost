import Foundation

enum NhostHeaderLookup {
    static func value(in headers: [String: String], named name: String) -> String? {
        let lowercasedName = name.lowercased()
        return headers.first { key, _ in key.lowercased() == lowercasedName }?.value
    }

    static func hasHeader(_ headers: [String: String], named name: String) -> Bool {
        value(in: headers, named: name) != nil
    }

    static func setHeaderIfAbsent(_ name: String, _ value: String, on headers: inout [String: String]) {
        guard !hasHeader(headers, named: name) else { return }
        headers[name] = value
    }

    static func setHeaderIfAbsent(_ name: String, _ value: String, on request: inout NhostRequest) {
        guard !hasHeader(request.headers, named: name) else { return }
        request.setHeader(name, value)
    }
}
