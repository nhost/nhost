import Foundation

enum GraphQLOperationKind: String, Sendable, Equatable {
    case query
    case mutation
    case subscription
}

struct GraphQLSelectedOperation: Sendable, Equatable {
    let kind: GraphQLOperationKind
    let name: String?
}

/// A deliberately conservative GraphQL lexer/selector. Failure to prove one
/// selected operation returns nil and therefore makes the request ineligible.
enum GraphQLOperationClassifier {
    static func selectOperation(
        query: String,
        operationName: String?
    ) -> GraphQLSelectedOperation? {
        var lexer = GraphQLLexer(source: query)
        guard let tokens = lexer.tokenize() else {
            return nil
        }

        var parser = GraphQLDocumentParser(tokens: tokens)
        guard let operations = parser.parse(), !operations.isEmpty else {
            return nil
        }

        if let operationName {
            let matches = operations.filter { $0.name == operationName }
            guard matches.count == 1 else { return nil }
            return matches[0]
        }

        guard operations.count == 1 else { return nil }
        return operations[0]
    }
}

private struct GraphQLDocumentParser {
    private let tokens: [GraphQLToken]
    private var index = 0

    init(tokens: [GraphQLToken]) {
        self.tokens = tokens
    }

    mutating func parse() -> [GraphQLSelectedOperation]? {
        var operations: [GraphQLSelectedOperation] = []
        var operationNames = Set<String>()
        var fragmentNames = Set<String>()

        while index < tokens.count {
            if peekPunctuator("{") {
                guard consumeSelectionSet() else { return nil }
                operations.append(GraphQLSelectedOperation(kind: .query, name: nil))
                continue
            }

            guard case let .name(keyword) = tokens[index] else { return nil }
            index += 1

            if let kind = GraphQLOperationKind(rawValue: keyword) {
                guard let operation = parseOperation(kind: kind) else { return nil }
                if let name = operation.name, !operationNames.insert(name).inserted {
                    return nil
                }
                operations.append(operation)
            } else if keyword == "fragment" {
                guard let fragmentName = parseFragment(), fragmentNames.insert(fragmentName).inserted else {
                    return nil
                }
            } else {
                return nil
            }
        }

        if operations.count > 1, operations.contains(where: { $0.name == nil }) {
            return nil
        }

        return operations
    }

    private mutating func parseOperation(kind: GraphQLOperationKind) -> GraphQLSelectedOperation? {
        let name: String?
        if index < tokens.count, case let .name(candidate) = tokens[index] {
            name = candidate
            index += 1
        } else {
            name = nil
        }

        if peekPunctuator("(") {
            guard consumeBalanced(opening: "(") else { return nil }
        }
        guard consumeDirectives(), consumeSelectionSet() else { return nil }

        return GraphQLSelectedOperation(kind: kind, name: name)
    }

    private mutating func parseFragment() -> String? {
        guard index < tokens.count, case let .name(fragmentName) = tokens[index], fragmentName != "on" else {
            return nil
        }
        index += 1
        guard consumeName("on"), consumeAnyName(), consumeDirectives(), consumeSelectionSet() else {
            return nil
        }
        return fragmentName
    }

    private mutating func consumeDirectives() -> Bool {
        while peekPunctuator("@") {
            index += 1
            guard consumeAnyName() else { return false }
            if peekPunctuator("(") && !consumeBalanced(opening: "(") {
                return false
            }
        }
        return true
    }

    private mutating func consumeSelectionSet() -> Bool {
        let openingIndex = index
        guard peekPunctuator("{"), consumeBalanced(opening: "{") else { return false }
        guard index > openingIndex + 2 else { return false }
        return !containsEmptyNestedSelectionSet(in: (openingIndex + 1)..<(index - 1))
    }

    private func containsEmptyNestedSelectionSet(in range: Range<Int>) -> Bool {
        var valueDelimiterDepth = 0

        for tokenIndex in range {
            guard case let .punctuator(byte) = tokens[tokenIndex] else { continue }

            switch byte {
            case UInt8(ascii: "("), UInt8(ascii: "["):
                valueDelimiterDepth += 1
            case UInt8(ascii: ")"), UInt8(ascii: "]"):
                valueDelimiterDepth -= 1
            case UInt8(ascii: "{"):
                let nextIndex = tokenIndex + 1
                if valueDelimiterDepth == 0,
                   nextIndex < range.upperBound,
                   tokens[nextIndex] == .punctuator(UInt8(ascii: "}")) {
                    return true
                }
            default:
                break
            }
        }

        return false
    }

    private mutating func consumeBalanced(opening: Character) -> Bool {
        guard let closingByte = closingPunctuator(for: opening), peekPunctuator(opening) else {
            return false
        }

        var stack = [closingByte]
        index += 1
        while index < tokens.count, !stack.isEmpty {
            let token = tokens[index]
            index += 1
            guard updateDelimiterStack(&stack, with: token) else { return false }
        }

        return stack.isEmpty
    }

    private func closingPunctuator(for opening: Character) -> UInt8? {
        switch opening.asciiValue {
        case UInt8(ascii: "{"):
            UInt8(ascii: "}")
        case UInt8(ascii: "("):
            UInt8(ascii: ")")
        case UInt8(ascii: "["):
            UInt8(ascii: "]")
        default:
            nil
        }
    }

    private func updateDelimiterStack(_ stack: inout [UInt8], with token: GraphQLToken) -> Bool {
        guard case let .punctuator(byte) = token else { return true }

        switch byte {
        case UInt8(ascii: "{"):
            stack.append(UInt8(ascii: "}"))
        case UInt8(ascii: "("):
            stack.append(UInt8(ascii: ")"))
        case UInt8(ascii: "["):
            stack.append(UInt8(ascii: "]"))
        case UInt8(ascii: "}"), UInt8(ascii: ")"), UInt8(ascii: "]"):
            guard byte == stack.last else { return false }
            stack.removeLast()
        default:
            break
        }
        return true
    }

    private mutating func consumeName(_ expected: String) -> Bool {
        guard index < tokens.count, tokens[index] == .name(expected) else { return false }
        index += 1
        return true
    }

    private mutating func consumeAnyName() -> Bool {
        guard index < tokens.count, case .name = tokens[index] else { return false }
        index += 1
        return true
    }

    private func peekPunctuator(_ character: Character) -> Bool {
        guard let byte = character.asciiValue, index < tokens.count else { return false }
        return tokens[index] == .punctuator(byte)
    }
}
