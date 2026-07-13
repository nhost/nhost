enum GraphQLToken: Equatable {
    case name(String)
    case punctuator(UInt8)
    case value
    case spread
}

private enum GraphQLTokenizationStep {
    case skip
    case token(GraphQLToken)
    case invalid
}

struct GraphQLLexer {
    private let bytes: [UInt8]
    private var index: Int

    init(source: String) {
        bytes = Array(source.utf8)
        index = bytes.starts(with: [0xef, 0xbb, 0xbf]) ? 3 : 0
    }

    mutating func tokenize() -> [GraphQLToken]? {
        var result: [GraphQLToken] = []

        while index < bytes.count {
            switch consumeToken() {
            case .skip:
                continue
            case let .token(token):
                result.append(token)
            case .invalid:
                return nil
            }
        }

        return result
    }

    private mutating func consumeToken() -> GraphQLTokenizationStep {
        let byte = bytes[index]

        if isIgnored(byte) {
            index += 1
            return .skip
        }
        if byte == UInt8(ascii: "#") {
            consumeComment()
            return .skip
        }
        if byte == UInt8(ascii: "\"") {
            return consumeString() ? .token(.value) : .invalid
        }
        if isNameStart(byte) {
            return .token(.name(consumeName()))
        }
        if byte == UInt8(ascii: ".") {
            return consumeSpread() ? .token(.spread) : .invalid
        }
        if byte == UInt8(ascii: "-") || isDigit(byte) {
            return consumeNumber() ? .token(.value) : .invalid
        }
        if isPunctuator(byte) {
            index += 1
            return .token(.punctuator(byte))
        }
        return .invalid
    }

    private func isIgnored(_ byte: UInt8) -> Bool {
        byte == UInt8(ascii: " ")
            || byte == UInt8(ascii: "\t")
            || byte == UInt8(ascii: "\n")
            || byte == UInt8(ascii: "\r")
            || byte == UInt8(ascii: ",")
    }

    private mutating func consumeComment() {
        while index < bytes.count, bytes[index] != UInt8(ascii: "\n"), bytes[index] != UInt8(ascii: "\r") {
            index += 1
        }
    }

    private mutating func consumeString() -> Bool {
        if hasBytes([0x22, 0x22, 0x22], at: index) {
            return consumeBlockString()
        }

        index += 1
        while index < bytes.count {
            let byte = bytes[index]
            if byte == UInt8(ascii: "\"") {
                index += 1
                return true
            }
            if byte == UInt8(ascii: "\\") {
                guard consumeEscape() else { return false }
                continue
            }
            guard byte >= 0x20, byte != UInt8(ascii: "\n"), byte != UInt8(ascii: "\r") else {
                return false
            }
            index += 1
        }

        return false
    }

    private mutating func consumeBlockString() -> Bool {
        index += 3
        while index < bytes.count {
            if hasBytes([0x5c, 0x22, 0x22, 0x22], at: index) {
                index += 4
            } else if hasBytes([0x22, 0x22, 0x22], at: index) {
                index += 3
                return true
            } else {
                index += 1
            }
        }

        return false
    }

    private mutating func consumeEscape() -> Bool {
        index += 1
        guard index < bytes.count else { return false }

        let byte = bytes[index]
        if byte == UInt8(ascii: "u") {
            guard index + 4 < bytes.count else { return false }
            for offset in 1...4 where !isHexDigit(bytes[index + offset]) {
                return false
            }
            index += 5
            return true
        }

        let validEscapes = Array("\"\\/bfnrt".utf8)
        guard validEscapes.contains(byte) else { return false }
        index += 1
        return true
    }

    private mutating func consumeName() -> String {
        let start = index
        index += 1
        while index < bytes.count, isNameContinue(bytes[index]) {
            index += 1
        }
        return String(bytes: bytes[start..<index], encoding: .utf8) ?? ""
    }

    private mutating func consumeSpread() -> Bool {
        guard hasBytes([0x2e, 0x2e, 0x2e], at: index) else { return false }
        index += 3
        return true
    }

    private mutating func consumeNumber() -> Bool {
        if bytes[index] == UInt8(ascii: "-") {
            index += 1
            guard index < bytes.count else { return false }
        }

        guard consumeIntegerPart(), consumeFractionPart(), consumeExponentPart() else {
            return false
        }
        return index == bytes.count || !isNameStart(bytes[index])
    }

    private mutating func consumeIntegerPart() -> Bool {
        if bytes[index] == UInt8(ascii: "0") {
            index += 1
            return index == bytes.count || !isDigit(bytes[index])
        }

        guard isNonzeroDigit(bytes[index]) else { return false }
        consumeDigits()
        return true
    }

    private mutating func consumeFractionPart() -> Bool {
        guard index < bytes.count, bytes[index] == UInt8(ascii: ".") else { return true }
        index += 1
        guard index < bytes.count, isDigit(bytes[index]) else { return false }
        consumeDigits()
        return true
    }

    private mutating func consumeExponentPart() -> Bool {
        guard index < bytes.count, isExponentIndicator(bytes[index]) else { return true }
        index += 1
        if index < bytes.count, isSign(bytes[index]) {
            index += 1
        }
        guard index < bytes.count, isDigit(bytes[index]) else { return false }
        consumeDigits()
        return true
    }

    private mutating func consumeDigits() {
        while index < bytes.count, isDigit(bytes[index]) {
            index += 1
        }
    }

    private func isExponentIndicator(_ byte: UInt8) -> Bool {
        byte == UInt8(ascii: "e") || byte == UInt8(ascii: "E")
    }

    private func isSign(_ byte: UInt8) -> Bool {
        byte == UInt8(ascii: "+") || byte == UInt8(ascii: "-")
    }

    private func hasBytes(_ expected: [UInt8], at offset: Int) -> Bool {
        guard offset + expected.count <= bytes.count else { return false }
        return Array(bytes[offset..<(offset + expected.count)]) == expected
    }

    private func isNameStart(_ byte: UInt8) -> Bool {
        byte == UInt8(ascii: "_")
            || (UInt8(ascii: "A")...UInt8(ascii: "Z")).contains(byte)
            || (UInt8(ascii: "a")...UInt8(ascii: "z")).contains(byte)
    }

    private func isNameContinue(_ byte: UInt8) -> Bool {
        isNameStart(byte) || isDigit(byte)
    }

    private func isDigit(_ byte: UInt8) -> Bool {
        (UInt8(ascii: "0")...UInt8(ascii: "9")).contains(byte)
    }

    private func isNonzeroDigit(_ byte: UInt8) -> Bool {
        (UInt8(ascii: "1")...UInt8(ascii: "9")).contains(byte)
    }

    private func isHexDigit(_ byte: UInt8) -> Bool {
        isDigit(byte)
            || (UInt8(ascii: "A")...UInt8(ascii: "F")).contains(byte)
            || (UInt8(ascii: "a")...UInt8(ascii: "f")).contains(byte)
    }

    private func isPunctuator(_ byte: UInt8) -> Bool {
        Array("!$&():=@[]{|}".utf8).contains(byte)
    }
}
