import Foundation
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// Persistent actor-isolated GraphQL response store. Files are created lazily
/// on the first operation. Stores using the same canonical directory share one
/// process-wide backend; incompatible storage limits fail closed.
public actor FileGraphQLCacheStore: GraphQLCacheStore {
    private let configuration: GraphQLCacheConfiguration
    private let didSynchronizeTemporaryFile: (@Sendable (URL) -> Void)?
    private var acquiredBackend: GraphQLFileCacheBackend?

    public init(configuration: GraphQLCacheConfiguration = GraphQLCacheConfiguration()) {
        self.configuration = configuration
        didSynchronizeTemporaryFile = nil
    }

    init(
        configuration: GraphQLCacheConfiguration,
        didSynchronizeTemporaryFile: @escaping @Sendable (URL) -> Void
    ) {
        self.configuration = configuration
        self.didSynchronizeTemporaryFile = didSynchronizeTemporaryFile
    }

    public func entry(for key: GraphQLCacheKey) async throws -> GraphQLCacheEntry? {
        try await backend().entry(for: key)
    }

    public func write(_ entry: GraphQLCacheEntry, for key: GraphQLCacheKey) async throws {
        try await backend().write(
            entry,
            for: key,
            didSynchronizeTemporaryFile: didSynchronizeTemporaryFile
        )
    }

    public func removeEntry(for key: GraphQLCacheKey) async throws {
        try await backend().removeEntry(for: key)
    }

    public func touchEntry(for key: GraphQLCacheKey, at date: Date) async throws {
        try await backend().touchEntry(for: key, at: date)
    }

    @discardableResult
    public func invalidate(_ filter: GraphQLCacheStoreFilter) async throws -> Int {
        try await backend().invalidate(filter)
    }

    public func prune() async throws {
        try await backend().prune()
    }

    private func backend() async throws -> GraphQLFileCacheBackend {
        if let acquiredBackend { return acquiredBackend }
        let settings = try GraphQLFileCacheSettings(configuration: configuration)
        let acquired = try await GraphQLFileCacheRegistry.shared.acquire(settings: settings)
        acquiredBackend = acquired
        return acquired
    }
}

private struct GraphQLFileCacheSettings: Sendable, Equatable {
    let directoryURL: URL
    let maximumTotalBytes: Int
    let maximumEntryBytes: Int
    let maximumEntries: Int
    let fileProtection: GraphQLCacheFileProtection

    init(configuration: GraphQLCacheConfiguration) throws {
        try configuration.validate()
        let directoryURL: URL
        if let configured = configuration.directoryURL {
            directoryURL = configured
        } else {
            guard let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            else {
                throw GraphQLCacheError.storeFailure("platform cache directory is unavailable")
            }
            directoryURL = caches
                .appendingPathComponent("io.nhost.swift", isDirectory: true)
                .appendingPathComponent("graphql-responses-v1", isDirectory: true)
        }
        self.directoryURL = Self.canonicalURL(directoryURL)
        maximumTotalBytes = configuration.maximumTotalBytes
        maximumEntryBytes = configuration.maximumEntryBytes
        maximumEntries = configuration.maximumEntries
        fileProtection = configuration.fileProtection
    }

    private static func canonicalURL(_ url: URL) -> URL {
        url.standardizedFileURL.resolvingSymlinksInPath()
    }
}

private final class GraphQLFileCacheRegistration {
    let settings: GraphQLFileCacheSettings
    weak var backend: GraphQLFileCacheBackend?

    init(settings: GraphQLFileCacheSettings, backend: GraphQLFileCacheBackend) {
        self.settings = settings
        self.backend = backend
    }
}

private actor GraphQLFileCacheRegistry {
    static let shared = GraphQLFileCacheRegistry()

    private var registrations: [String: GraphQLFileCacheRegistration] = [:]

    func acquire(settings: GraphQLFileCacheSettings) throws -> GraphQLFileCacheBackend {
        let key = settings.directoryURL.path
        if let registration = registrations[key], let backend = registration.backend {
            guard registration.settings == settings else {
                throw GraphQLCacheError.invalidConfiguration(
                    "the cache directory is already registered with different storage settings"
                )
            }
            return backend
        }
        let backend = GraphQLFileCacheBackend(settings: settings)
        registrations[key] = GraphQLFileCacheRegistration(settings: settings, backend: backend)
        return backend
    }
}

private actor GraphQLFileCacheBackend {
    private static let entryExtension = "entry"
    private static let indexName = "index-v1.json"

    private let settings: GraphQLFileCacheSettings
    private let fileManager = FileManager.default
    private var initialized = false
    private var entries: [GraphQLCacheKey: GraphQLCacheEntry] = [:]

    init(settings: GraphQLFileCacheSettings) {
        self.settings = settings
    }

    func entry(for key: GraphQLCacheKey) throws -> GraphQLCacheEntry? {
        try ensureInitialized()
        guard GraphQLCacheEntryValidation.isDigest(key.rawValue) else {
            throw GraphQLCacheError.storeFailure("cache key validation failed")
        }
        guard let entry = entries[key] else { return nil }
        do {
            return try GraphQLCacheEntryValidation.validatedCustomRead(
                entry,
                requestedKey: key,
                maximumEntryBytes: settings.maximumEntryBytes
            )
        } catch {
            try? fileManager.removeItem(at: entryURL(for: key))
            entries.removeValue(forKey: key)
            try? persistIndex()
            throw error
        }
    }

    func write(
        _ entry: GraphQLCacheEntry,
        for key: GraphQLCacheKey,
        didSynchronizeTemporaryFile: (@Sendable (URL) -> Void)?
    ) throws {
        try ensureInitialized()
        var value = try GraphQLCacheEntryValidation.validated(
            entry,
            requestedKey: key,
            maximumEntryBytes: settings.maximumEntryBytes,
            sanitizeContentType: true
        )
        if let existing = entries[key] {
            value = GraphQLCacheEntry(
                key: value.key,
                body: value.body,
                status: value.status,
                contentType: value.contentType,
                createdAt: existing.createdAt,
                lastSuccessfulWriteAt: value.lastSuccessfulWriteAt,
                lastAccessedAt: value.lastAccessedAt,
                facets: value.facets
            )
        }

        let envelope = try GraphQLCacheEnvelope.encode(value)
        try atomicWrite(
            envelope,
            to: entryURL(for: key),
            honorCancellation: true,
            didSynchronizeTemporaryFile: didSynchronizeTemporaryFile
        )
        entries[key] = value
        try pruneEntries()
        try persistIndex()
    }

    func removeEntry(for key: GraphQLCacheKey) throws {
        try ensureInitialized()
        guard GraphQLCacheEntryValidation.isDigest(key.rawValue) else {
            throw GraphQLCacheError.storeFailure("cache key validation failed")
        }
        if entries.removeValue(forKey: key) != nil {
            try removeIfPresent(entryURL(for: key))
            try persistIndex()
        }
    }

    func touchEntry(for key: GraphQLCacheKey, at date: Date) throws {
        try ensureInitialized()
        guard date.timeIntervalSinceReferenceDate.isFinite else {
            throw GraphQLCacheError.storeFailure("cache touch timestamp validation failed")
        }
        guard let old = entries[key] else { return }
        let value = GraphQLCacheEntry(
            key: old.key,
            body: old.body,
            status: old.status,
            contentType: old.contentType,
            createdAt: old.createdAt,
            lastSuccessfulWriteAt: old.lastSuccessfulWriteAt,
            lastAccessedAt: date,
            facets: old.facets
        )
        let envelope = try GraphQLCacheEnvelope.encode(value)
        try atomicWrite(envelope, to: entryURL(for: key), honorCancellation: true)
        entries[key] = value
        try persistIndex()
    }

    func invalidate(_ filter: GraphQLCacheStoreFilter) throws -> Int {
        try ensureInitialized()
        let keys = entries.compactMap { key, entry in
            GraphQLCacheEntryValidation.matches(entry, filter: filter) ? key : nil
        }
        for key in keys {
            try removeIfPresent(entryURL(for: key))
            entries.removeValue(forKey: key)
        }
        if !keys.isEmpty {
            try persistIndex()
        }
        return keys.count
    }

    func prune() throws {
        try ensureInitialized()
        let changed = try pruneEntries()
        if changed {
            try persistIndex()
        }
    }

    private func ensureInitialized() throws {
        guard !initialized else { return }
        do {
            try fileManager.createDirectory(
                at: settings.directoryURL,
                withIntermediateDirectories: true
            )
            try applyDirectoryAttributes()
            try recoverEntries()
            _ = try pruneEntries()
            try persistIndex()
            initialized = true
        } catch let error as GraphQLCacheError {
            throw error
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw GraphQLCacheError.storeFailure("persistent cache initialization failed")
        }
    }

    private func recoverEntries() throws {
        entries.removeAll(keepingCapacity: true)
        let (maximumFileSize, maximumFileSizeOverflow) = settings.maximumEntryBytes
            .addingReportingOverflow(GraphQLCacheEntryValidation.maximumEnvelopeOverheadBytes)
        guard !maximumFileSizeOverflow else {
            throw GraphQLCacheError.invalidConfiguration(
                "maximumEntryBytes leaves insufficient space for persistent cache envelope overhead"
            )
        }
        let files = try fileManager.contentsOfDirectory(
            at: settings.directoryURL,
            includingPropertiesForKeys: [.fileSizeKey],
            options: []
        )
        for url in files {
            if url.lastPathComponent.hasSuffix(".tmp") {
                try? fileManager.removeItem(at: url)
                continue
            }
            guard url.pathExtension == Self.entryExtension else { continue }
            let rawKey = url.deletingPathExtension().lastPathComponent
            guard GraphQLCacheEntryValidation.isDigest(rawKey) else {
                try? fileManager.removeItem(at: url)
                continue
            }
            let key = GraphQLCacheKey(rawValue: rawKey)
            do {
                let values = try url.resourceValues(forKeys: [.fileSizeKey])
                guard let fileSize = values.fileSize, fileSize <= maximumFileSize else {
                    throw GraphQLCacheError.storeFailure("cache envelope length validation failed")
                }
                let data = try Data(contentsOf: url, options: [.mappedIfSafe])
                let entry = try GraphQLCacheEnvelope.decode(
                    data,
                    requestedKey: key,
                    maximumEntryBytes: settings.maximumEntryBytes
                )
                entries[key] = entry
            } catch {
                try? fileManager.removeItem(at: url)
            }
        }

        let knownNames = Set(entries.keys.map { entryURL(for: $0).lastPathComponent })
        for url in files where url.pathExtension == Self.entryExtension
            && !knownNames.contains(url.lastPathComponent)
        {
            try? fileManager.removeItem(at: url)
        }
    }

    @discardableResult
    private func pruneEntries() throws -> Bool {
        var changed = false
        var totalBytes = entries.values.reduce(0) { $0 + $1.body.count }
        while entries.count > settings.maximumEntries || totalBytes > settings.maximumTotalBytes {
            guard let oldest = entries.values.min(by: lruPrecedes) else { break }
            try removeIfPresent(entryURL(for: oldest.key))
            entries.removeValue(forKey: oldest.key)
            totalBytes -= oldest.body.count
            changed = true
        }
        return changed
    }

    private func lruPrecedes(_ lhs: GraphQLCacheEntry, _ rhs: GraphQLCacheEntry) -> Bool {
        if lhs.lastAccessedAt != rhs.lastAccessedAt {
            return lhs.lastAccessedAt < rhs.lastAccessedAt
        }
        return lhs.key.rawValue < rhs.key.rawValue
    }

    private func persistIndex() throws {
        let records = entries.values
            .sorted { $0.key.rawValue < $1.key.rawValue }
            .map(GraphQLCacheIndex.Record.init)
        let index = GraphQLCacheIndex(version: 1, entries: records)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(index)
        try atomicWrite(data, to: settings.directoryURL.appendingPathComponent(Self.indexName), honorCancellation: false)
    }

    private func entryURL(for key: GraphQLCacheKey) -> URL {
        settings.directoryURL
            .appendingPathComponent(key.rawValue, isDirectory: false)
            .appendingPathExtension(Self.entryExtension)
    }

    private func atomicWrite(
        _ data: Data,
        to destination: URL,
        honorCancellation: Bool,
        didSynchronizeTemporaryFile: (@Sendable (URL) -> Void)? = nil
    ) throws {
        if honorCancellation { try Task.checkCancellation() }
        let temporary = settings.directoryURL.appendingPathComponent(
            ".\(destination.lastPathComponent).\(UUID().uuidString).tmp",
            isDirectory: false
        )
        do {
            guard fileManager.createFile(atPath: temporary.path, contents: nil) else {
                throw GraphQLCacheError.storeFailure("persistent cache temporary file creation failed")
            }
            let handle = try FileHandle(forWritingTo: temporary)
            do {
                try handle.write(contentsOf: data)
                try handle.synchronize()
                try handle.close()
            } catch {
                try? handle.close()
                throw error
            }
            try applyFileProtection(to: temporary)
            didSynchronizeTemporaryFile?(temporary)
            if honorCancellation { try Task.checkCancellation() }
            try atomicRename(temporary, destination)
        } catch is CancellationError {
            try? fileManager.removeItem(at: temporary)
            throw CancellationError()
        } catch let error as GraphQLCacheError {
            try? fileManager.removeItem(at: temporary)
            throw error
        } catch {
            try? fileManager.removeItem(at: temporary)
            throw GraphQLCacheError.storeFailure("persistent cache atomic write failed")
        }
    }

    private func atomicRename(_ source: URL, _ destination: URL) throws {
        #if canImport(Darwin) || canImport(Glibc)
        let result = source.withUnsafeFileSystemRepresentation { sourcePath in
            destination.withUnsafeFileSystemRepresentation { destinationPath in
                guard let sourcePath, let destinationPath else { return Int32(-1) }
                return rename(sourcePath, destinationPath)
            }
        }
        guard result == 0 else {
            throw GraphQLCacheError.storeFailure("persistent cache atomic replacement failed")
        }
        #else
        if fileManager.fileExists(atPath: destination.path) {
            try fileManager.removeItem(at: destination)
        }
        try fileManager.moveItem(at: source, to: destination)
        #endif
    }

    private func removeIfPresent(_ url: URL) throws {
        guard fileManager.fileExists(atPath: url.path) else { return }
        do {
            try fileManager.removeItem(at: url)
        } catch {
            throw GraphQLCacheError.storeFailure("persistent cache removal failed")
        }
    }

    private func applyDirectoryAttributes() throws {
        #if canImport(Darwin)
        var url = settings.directoryURL
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        do {
            try url.setResourceValues(values)
            try applyFileProtection(to: settings.directoryURL)
        } catch {
            throw GraphQLCacheError.storeFailure("persistent cache directory attributes failed")
        }
        #endif
    }

    private func applyFileProtection(to url: URL) throws {
        #if canImport(Darwin)
        let protection: FileProtectionType
        switch settings.fileProtection {
        case .none:
            protection = .none
        case .complete:
            protection = .complete
        case .completeUnlessOpen:
            protection = .completeUnlessOpen
        case .completeUntilFirstUserAuthentication:
            protection = .completeUntilFirstUserAuthentication
        }
        try fileManager.setAttributes([.protectionKey: protection], ofItemAtPath: url.path)
        #else
        _ = url
        #endif
    }
}

private enum GraphQLCacheEnvelope {
    static let magic = Data("NHOSTGQL".utf8)
    static let version: UInt16 = 1
    static let headerSize = GraphQLCacheEntryValidation.envelopeHeaderBytes

    private struct Metadata: Codable {
        let key: String
        let status: Int
        let contentType: String?
        let createdAt: Double
        let lastSuccessfulWriteAt: Double
        let lastAccessedAt: Double
        let endpoint: String
        let authorizationScope: String
        let userIdentity: String?
        let operationName: String?
        let namespace: String?
        let tags: [String]

        init(_ entry: GraphQLCacheEntry) {
            key = entry.key.rawValue
            status = entry.status
            contentType = entry.contentType
            createdAt = entry.createdAt.timeIntervalSinceReferenceDate
            lastSuccessfulWriteAt = entry.lastSuccessfulWriteAt.timeIntervalSinceReferenceDate
            lastAccessedAt = entry.lastAccessedAt.timeIntervalSinceReferenceDate
            endpoint = entry.facets.endpoint.rawValue
            authorizationScope = entry.facets.authorizationScope.rawValue
            userIdentity = entry.facets.userIdentity?.rawValue
            operationName = entry.facets.operationName?.rawValue
            namespace = entry.facets.namespace?.rawValue
            tags = entry.facets.tags.map(\.rawValue).sorted()
        }

        var entry: GraphQLCacheEntry {
            GraphQLCacheEntry(
                key: GraphQLCacheKey(rawValue: key),
                body: Data(),
                status: status,
                contentType: contentType,
                createdAt: Date(timeIntervalSinceReferenceDate: createdAt),
                lastSuccessfulWriteAt: Date(timeIntervalSinceReferenceDate: lastSuccessfulWriteAt),
                lastAccessedAt: Date(timeIntervalSinceReferenceDate: lastAccessedAt),
                facets: GraphQLCacheEntryFacets(
                    endpoint: GraphQLCacheDigest(rawValue: endpoint),
                    authorizationScope: GraphQLCacheDigest(rawValue: authorizationScope),
                    userIdentity: userIdentity.map(GraphQLCacheDigest.init(rawValue:)),
                    operationName: operationName.map(GraphQLCacheDigest.init(rawValue:)),
                    namespace: namespace.map(GraphQLCacheDigest.init(rawValue:)),
                    tags: Set(tags.map(GraphQLCacheDigest.init(rawValue:)))
                )
            )
        }
    }

    static func encode(_ entry: GraphQLCacheEntry) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let metadata = try encoder.encode(Metadata(entry))
        guard metadata.count <= GraphQLCacheEntryValidation.maximumMetadataBytes else {
            throw GraphQLCacheError.storeFailure("cache envelope metadata is too large")
        }
        var data = Data()
        data.append(magic)
        append(version, to: &data)
        append(UInt32(metadata.count), to: &data)
        append(UInt64(entry.body.count), to: &data)
        data.append(metadata)
        data.append(entry.body)
        return data
    }

    static func decode(
        _ data: Data,
        requestedKey: GraphQLCacheKey,
        maximumEntryBytes: Int
    ) throws -> GraphQLCacheEntry {
        var cursor = GraphQLCacheDataCursor(data: data)
        guard try cursor.read(count: magic.count) == magic else {
            throw GraphQLCacheError.storeFailure("cache envelope magic validation failed")
        }
        let storedVersion: UInt16 = try cursor.readInteger()
        guard storedVersion == version else {
            throw GraphQLCacheError.storeFailure("cache envelope version is unsupported")
        }
        let metadataLength = Int(try cursor.readInteger() as UInt32)
        let bodyLength64: UInt64 = try cursor.readInteger()
        guard metadataLength <= GraphQLCacheEntryValidation.maximumMetadataBytes,
              bodyLength64 <= UInt64(maximumEntryBytes),
              bodyLength64 <= UInt64(Int.max)
        else {
            throw GraphQLCacheError.storeFailure("cache envelope length validation failed")
        }
        let bodyLength = Int(bodyLength64)
        guard data.count == headerSize + metadataLength + bodyLength else {
            throw GraphQLCacheError.storeFailure("cache envelope length validation failed")
        }
        let metadataData = try cursor.read(count: metadataLength)
        let body = try cursor.read(count: bodyLength)
        let metadata = try JSONDecoder().decode(Metadata.self, from: metadataData)
        let partial = metadata.entry
        let entry = GraphQLCacheEntry(
            key: partial.key,
            body: body,
            status: partial.status,
            contentType: partial.contentType,
            createdAt: partial.createdAt,
            lastSuccessfulWriteAt: partial.lastSuccessfulWriteAt,
            lastAccessedAt: partial.lastAccessedAt,
            facets: partial.facets
        )
        return try GraphQLCacheEntryValidation.validatedCustomRead(
            entry,
            requestedKey: requestedKey,
            maximumEntryBytes: maximumEntryBytes
        )
    }

    private static func append<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
        var bigEndian = value.bigEndian
        withUnsafeBytes(of: &bigEndian) { data.append(contentsOf: $0) }
    }
}

private struct GraphQLCacheDataCursor {
    let data: Data
    var offset = 0

    mutating func read(count: Int) throws -> Data {
        guard count >= 0, offset <= data.count, count <= data.count - offset else {
            throw GraphQLCacheError.storeFailure("cache envelope is truncated")
        }
        defer { offset += count }
        return data.subdata(in: offset ..< offset + count)
    }

    mutating func readInteger<T: FixedWidthInteger>() throws -> T {
        let bytes = try read(count: MemoryLayout<T>.size)
        return bytes.reduce(T.zero) { result, byte in
            (result << 8) | T(byte)
        }
    }
}

private struct GraphQLCacheIndex: Codable {
    struct Record: Codable {
        let key: String
        let size: Int
        let createdAt: Double
        let lastSuccessfulWriteAt: Double
        let lastAccessedAt: Double

        init(_ entry: GraphQLCacheEntry) {
            key = entry.key.rawValue
            size = entry.body.count
            createdAt = entry.createdAt.timeIntervalSinceReferenceDate
            lastSuccessfulWriteAt = entry.lastSuccessfulWriteAt.timeIntervalSinceReferenceDate
            lastAccessedAt = entry.lastAccessedAt.timeIntervalSinceReferenceDate
        }
    }

    let version: Int
    let entries: [Record]
}

