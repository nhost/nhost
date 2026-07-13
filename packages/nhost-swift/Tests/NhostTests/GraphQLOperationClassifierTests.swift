import XCTest
@testable import Nhost

final class GraphQLOperationClassifierTests: XCTestCase {
    func testSelectsShorthandAndNamedQueries() {
        XCTAssertEqual(
            GraphQLOperationClassifier.selectOperation(query: "{ viewer { id } }", operationName: nil),
            GraphQLSelectedOperation(kind: .query, name: nil)
        )
        XCTAssertEqual(
            GraphQLOperationClassifier.selectOperation(
                query: "query Viewer($id: ID!) @cached { viewer(id: $id) { id } }",
                operationName: "Viewer"
            ),
            GraphQLSelectedOperation(kind: .query, name: "Viewer")
        )
    }

    func testSelectsNamedOperationFromMultipleOperations() {
        let document = """
        query First { first }
        query Second { second }
        """

        XCTAssertEqual(
            GraphQLOperationClassifier.selectOperation(query: document, operationName: "Second"),
            GraphQLSelectedOperation(kind: .query, name: "Second")
        )
        XCTAssertNil(GraphQLOperationClassifier.selectOperation(query: document, operationName: nil))
        XCTAssertNil(
            GraphQLOperationClassifier.selectOperation(query: document, operationName: "Missing")
        )
    }

    func testClassifiesMutationAndSubscriptionAsIneligibleKinds() {
        XCTAssertEqual(
            GraphQLOperationClassifier.selectOperation(
                query: "mutation Save { save }",
                operationName: nil
            ),
            GraphQLSelectedOperation(kind: .mutation, name: "Save")
        )
        XCTAssertEqual(
            GraphQLOperationClassifier.selectOperation(
                query: "subscription Events { events }",
                operationName: "Events"
            ),
            GraphQLSelectedOperation(kind: .subscription, name: "Events")
        )
    }

    func testAllowsFragmentsCommentsBOMAndLexicalTraps() {
        let document = "\u{feff}# query Fake { ignored }\n"
            + "fragment Details on User { bio(format: \"mutation { notAnOperation }\") }\n"
            + "query Viewer {\n"
            + "  viewer {\n"
            + "    ...Details\n"
            + "    note(value: \"\"\"subscription { alsoNotAnOperation }\"\"\")\n"
            + "  }\n"
            + "}\n"

        XCTAssertEqual(
            GraphQLOperationClassifier.selectOperation(query: document, operationName: nil),
            GraphQLSelectedOperation(kind: .query, name: "Viewer")
        )
    }

    func testRejectsDuplicateNamesAndAnonymousMultiOperationDocuments() {
        XCTAssertNil(
            GraphQLOperationClassifier.selectOperation(
                query: "query Same { one } query Same { two }",
                operationName: "Same"
            )
        )
        XCTAssertNil(
            GraphQLOperationClassifier.selectOperation(
                query: "{ one } query Two { two }",
                operationName: "Two"
            )
        )
        XCTAssertNil(
            GraphQLOperationClassifier.selectOperation(
                query: "fragment Same on User { id } fragment Same on User { name } query Q { user { ...Same } }",
                operationName: "Q"
            )
        )
    }

    func testRejectsMalformedDocuments() {
        let malformedDocuments = [
            "{}",
            "query Empty {}",
            "fragment Empty on User {} query Q { user { id } }",
            "query MissingSelection",
            "query Broken { viewer(id: [1, 2) }",
            "query Broken { viewer(note: \"unterminated) }",
            "query Broken { viewer(note: \"\"\"unterminated) }",
            "fragment Details User { id } query Q { user { ...Details } }",
            "query Q { field } trailing",
            "query Q { field } \u{feff}"
        ]

        for document in malformedDocuments {
            XCTAssertNil(
                GraphQLOperationClassifier.selectOperation(query: document, operationName: nil),
                "expected malformed document to be rejected: \(document)"
            )
        }
    }

    func testRejectsEmptyNestedSelectionSets() {
        let malformedDocuments = [
            "query Q { field {} }",
            "query Q { field { nested {} } }",
            "fragment Details on User { profile {} } query Q { user { ...Details } }"
        ]

        for document in malformedDocuments {
            XCTAssertNil(
                GraphQLOperationClassifier.selectOperation(query: document, operationName: "Q"),
                "expected empty nested selection set to be rejected: \(document)"
            )
        }
    }

    func testAllowsEmptyInputObjectsInsideArguments() {
        XCTAssertEqual(
            GraphQLOperationClassifier.selectOperation(
                query: "query Q { field(input: {}, nested: { value: {} }) }",
                operationName: "Q"
            ),
            GraphQLSelectedOperation(kind: .query, name: "Q")
        )
    }

    func testFragmentOnlyDocumentHasNoSelectableOperation() {
        XCTAssertNil(
            GraphQLOperationClassifier.selectOperation(
                query: "fragment Details on User { id }",
                operationName: nil
            )
        )
    }
}
