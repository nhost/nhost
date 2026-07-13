import Foundation

enum GraphQLCacheKeyGenerationFailure: Error, Sendable, Equatable {
    case nonFiniteNumber
}

enum GraphQLCanonicalVariables {
    static func serialize(_ variables: [String: JSONValue]?) throws -> Data {
        var output = Data()
        if let variables {
            output.append(0x01)
            try append(.object(variables), to: &output)
        } else {
            output.append(0x00)
        }
        return output
    }

    private static func append(_ value: JSONValue, to output: inout Data) throws {
        switch value {
        case .null:
            output.append(0x00)
        case let .bool(value):
            output.append(value ? 0x02 : 0x01)
        case let .number(value):
            guard value.isFinite else {
                throw GraphQLCacheKeyGenerationFailure.nonFiniteNumber
            }
            output.append(0x03)
            appendFixedWidth(value.bitPattern, to: &output)
        case let .string(value):
            output.append(0x04)
            appendFrame(Data(value.utf8), to: &output)
        case let .array(values):
            output.append(0x05)
            appendFixedWidth(UInt64(values.count), to: &output)
            for element in values {
                var encodedElement = Data()
                try append(element, to: &encodedElement)
                appendFrame(encodedElement, to: &output)
            }
        case let .object(values):
            output.append(0x06)
            let sortedKeys = values.keys.sorted(by: utf8Precedes)
            appendFixedWidth(UInt64(sortedKeys.count), to: &output)
            for key in sortedKeys {
                guard let value = values[key] else { continue }
                appendFrame(Data(key.utf8), to: &output)
                var encodedValue = Data()
                try append(value, to: &encodedValue)
                appendFrame(encodedValue, to: &output)
            }
        }
    }

    private static func utf8Precedes(_ lhs: String, _ rhs: String) -> Bool {
        Array(lhs.utf8).lexicographicallyPrecedes(Array(rhs.utf8))
    }

    private static func appendFrame(_ data: Data, to output: inout Data) {
        appendFixedWidth(UInt64(data.count), to: &output)
        output.append(data)
    }

    private static func appendFixedWidth<T: FixedWidthInteger>(_ value: T, to output: inout Data) {
        var bigEndian = value.bigEndian
        withUnsafeBytes(of: &bigEndian) { output.append(contentsOf: $0) }
    }
}

struct GraphQLCacheIdentity: Sendable, Equatable {
    let key: GraphQLCacheKey
    let queryDigest: GraphQLCacheDigest
    let variablesDigest: GraphQLCacheDigest
    let facets: GraphQLCacheEntryFacets
}

enum GraphQLCacheKeyBuilder {
    static func queryDigest(_ query: String) -> GraphQLCacheDigest {
        digest(domain: "nhost.graphql.query.v1", components: [Data(query.utf8)])
    }

    static func variablesDigest(_ variables: [String: JSONValue]?) throws -> GraphQLCacheDigest {
        let canonical = try GraphQLCanonicalVariables.serialize(variables)
        return digest(domain: "nhost.graphql.variables.v1", components: [canonical])
    }

    static func facetDigest(domain: String, value: String) -> GraphQLCacheDigest {
        digest(domain: "nhost.graphql.facet.\(domain).v1", components: [Data(value.utf8)])
    }

    static func makeIdentity(
        endpoint: URL,
        operation: GraphQLSelectedOperation,
        query: String,
        variables: [String: JSONValue]?,
        authorizationScope: GraphQLCacheDigest,
        userIdentity: String? = nil,
        namespace: String? = nil,
        tags: Set<String> = []
    ) throws -> GraphQLCacheIdentity {
        let endpointDigest = facetDigest(domain: "endpoint", value: canonicalEndpoint(endpoint))
        let queryDigest = queryDigest(query)
        let variablesDigest = try variablesDigest(variables)
        let operationNameDigest = operation.name.map {
            facetDigest(domain: "operation-name", value: $0)
        }
        let namespaceDigest = namespace.map {
            facetDigest(domain: "namespace", value: $0)
        }
        let userIdentityDigest = userIdentity.map {
            facetDigest(domain: "user", value: $0)
        }
        let tagDigests = Set(tags.map { facetDigest(domain: "tag", value: $0) })
        let sortedTagDigests = tagDigests.map(\.rawValue).sorted()

        let key = GraphQLCacheKey(
            rawValue: digest(
                domain: "nhost.graphql.cache-key.v1",
                components: [
                    Data(endpointDigest.rawValue.utf8),
                    Data(operation.kind.rawValue.utf8),
                    optionalStringData(operation.name),
                    Data(queryDigest.rawValue.utf8),
                    Data(variablesDigest.rawValue.utf8),
                    Data(authorizationScope.rawValue.utf8),
                    optionalStringData(namespaceDigest?.rawValue),
                    framedStringsData(sortedTagDigests)
                ]
            ).rawValue
        )

        return GraphQLCacheIdentity(
            key: key,
            queryDigest: queryDigest,
            variablesDigest: variablesDigest,
            facets: GraphQLCacheEntryFacets(
                endpoint: endpointDigest,
                authorizationScope: authorizationScope,
                userIdentity: userIdentityDigest,
                operationName: operationNameDigest,
                namespace: namespaceDigest,
                tags: tagDigests
            )
        )
    }

    private static func canonicalEndpoint(_ endpoint: URL) -> String {
        guard var components = URLComponents(url: endpoint.absoluteURL, resolvingAgainstBaseURL: true) else {
            return endpoint.absoluteString
        }
        components.scheme = components.scheme?.lowercased()
        components.host = components.host?.lowercased()
        let isDefaultHTTPSPort = components.scheme == "https" && components.port == 443
        let isDefaultHTTPPort = components.scheme == "http" && components.port == 80
        if isDefaultHTTPSPort || isDefaultHTTPPort {
            components.port = nil
        }
        return components.url?.standardized.absoluteString ?? endpoint.absoluteString
    }

    private static func optionalStringData(_ value: String?) -> Data {
        guard let value else { return Data([0x00]) }
        var output = Data([0x01])
        appendFrame(Data(value.utf8), to: &output)
        return output
    }

    private static func framedStringsData(_ values: [String]) -> Data {
        var output = Data()
        appendFixedWidth(UInt64(values.count), to: &output)
        for value in values {
            appendFrame(Data(value.utf8), to: &output)
        }
        return output
    }

    private static func digest(domain: String, components: [Data]) -> GraphQLCacheDigest {
        var input = Data()
        appendFrame(Data(domain.utf8), to: &input)
        for component in components {
            appendFrame(component, to: &input)
        }
        return GraphQLCacheDigest(rawValue: NhostSHA256.hexadecimalDigest(input))
    }

    private static func appendFrame(_ data: Data, to output: inout Data) {
        appendFixedWidth(UInt64(data.count), to: &output)
        output.append(data)
    }

    private static func appendFixedWidth<T: FixedWidthInteger>(_ value: T, to output: inout Data) {
        var bigEndian = value.bigEndian
        withUnsafeBytes(of: &bigEndian) { output.append(contentsOf: $0) }
    }
}
