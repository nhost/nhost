import Foundation
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

#if canImport(Darwin) || canImport(Glibc)
@_silgen_name("flock")
private func nhostGraphQLCacheSystemFlock(_ descriptor: Int32, _ operation: Int32) -> Int32
#endif

/// Persistent actor-isolated GraphQL response store. Files are created lazily
/// on the first operation. Stores using the same canonical directory share one
/// process-wide backend; incompatible storage limits fail closed.
public actor FileGraphQLCacheStore: GraphQLCacheStore {
    private let configuration: GraphQLCacheConfiguration
    private let didSynchronizeTemporaryFile: (@Sendable (URL) -> Void)?
    private let didReadEntryBody: (@Sendable (URL) -> Void)?
    private var acquiredBackend: GraphQLFileCacheBackend?

    public init(configuration: GraphQLCacheConfiguration = GraphQLCacheConfiguration()) {
        self.configuration = configuration
        didSynchronizeTemporaryFile = nil
        didReadEntryBody = nil
    }

    init(
        configuration: GraphQLCacheConfiguration,
        didSynchronizeTemporaryFile: @escaping @Sendable (URL) -> Void
    ) {
        self.configuration = configuration
        self.didSynchronizeTemporaryFile = didSynchronizeTemporaryFile
        didReadEntryBody = nil
    }

    init(
        configuration: GraphQLCacheConfiguration,
        didReadEntryBody: @escaping @Sendable (URL) -> Void
    ) {
        self.configuration = configuration
        didSynchronizeTemporaryFile = nil
        self.didReadEntryBody = didReadEntryBody
    }

    public func entry(for key: GraphQLCacheKey) async throws -> GraphQLCacheEntry? {
        try await backend().entry(for: key, didReadEntryBody: didReadEntryBody)
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
        let resolved = url.standardizedFileURL.resolvingSymlinksInPath()
        // `resolvingSymlinksInPath` changes its trailing-slash representation
        // after a directory is created. Rebuild it as a directory URL so the
        // process registry identity is stable across lazy initialization.
        return URL(fileURLWithPath: resolved.path, isDirectory: true)
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

/// Metadata-only index record. Entry bodies remain on disk, and the entry file's
/// modification date is the persisted source of truth for `lastAccessedAt`.
private struct GraphQLFileCacheEntry: Sendable {
    let key: GraphQLCacheKey
    let bodyLength: Int
    let status: Int
    let contentType: String?
    let createdAt: Date
    let lastSuccessfulWriteAt: Date
    let lastAccessedAt: Date
    let facets: GraphQLCacheEntryFacets

    init(_ entry: GraphQLCacheEntry, lastAccessedAt: Date? = nil) {
        key = entry.key
        bodyLength = entry.body.count
        status = entry.status
        contentType = entry.contentType
        createdAt = entry.createdAt
        lastSuccessfulWriteAt = entry.lastSuccessfulWriteAt
        self.lastAccessedAt = lastAccessedAt ?? entry.lastAccessedAt
        facets = entry.facets
    }

    init(metadata: GraphQLCacheEntry, bodyLength: Int, lastAccessedAt: Date) {
        key = metadata.key
        self.bodyLength = bodyLength
        status = metadata.status
        contentType = metadata.contentType
        createdAt = metadata.createdAt
        lastSuccessfulWriteAt = metadata.lastSuccessfulWriteAt
        self.lastAccessedAt = lastAccessedAt
        facets = metadata.facets
    }

    var metadataEntry: GraphQLCacheEntry {
        entry(body: Data())
    }

    func entry(body: Data) -> GraphQLCacheEntry {
        GraphQLCacheEntry(
            key: key,
            body: body,
            status: status,
            contentType: contentType,
            createdAt: createdAt,
            lastSuccessfulWriteAt: lastSuccessfulWriteAt,
            lastAccessedAt: lastAccessedAt,
            facets: facets
        )
    }

    func accessed(at date: Date) -> GraphQLFileCacheEntry {
        GraphQLFileCacheEntry(metadata: metadataEntry, bodyLength: bodyLength, lastAccessedAt: date)
    }
}

/// Lifetime ownership for a canonical cache directory. The lock file is opened
/// in place and is never replaced or unlinked, so a file left after a crash is
/// harmless: ownership is represented only by the kernel advisory lock.
private final class GraphQLFileCacheDirectoryOwnership: @unchecked Sendable {
    static let lockFileName = ".nhost-graphql-cache.lock"

    private let descriptor: Int32

    init(directoryURL: URL) throws {
        #if canImport(Darwin) || canImport(Glibc)
        let lockURL = directoryURL.appendingPathComponent(Self.lockFileName, isDirectory: false)
        let flags = O_CREAT | O_RDWR | O_CLOEXEC
        let descriptor: Int32
        #if canImport(Darwin)
        descriptor = Darwin.open(lockURL.path, flags, 0o600)
        #else
        descriptor = Glibc.open(lockURL.path, flags, 0o600)
        #endif
        guard descriptor >= 0 else {
            throw GraphQLCacheError.storeFailure(
                "persistent cache directory ownership could not be established"
            )
        }

        guard Self.changeMode(descriptor, mode: 0o600) == 0 else {
            Self.close(descriptor)
            throw GraphQLCacheError.storeFailure(
                "persistent cache directory ownership could not be established"
            )
        }

        while nhostGraphQLCacheSystemFlock(descriptor, LOCK_EX | LOCK_NB) != 0 {
            let code = errno
            if code == EINTR { continue }
            Self.close(descriptor)
            if code == EWOULDBLOCK || code == EAGAIN {
                throw GraphQLCacheError.directoryOwnedByAnotherProcess
            }
            throw GraphQLCacheError.storeFailure(
                "persistent cache directory ownership could not be established"
            )
        }
        self.descriptor = descriptor
        #else
        throw GraphQLCacheError.storeFailure(
            "persistent cache directory ownership is unavailable on this platform"
        )
        #endif
    }

    deinit {
        #if canImport(Darwin) || canImport(Glibc)
        _ = nhostGraphQLCacheSystemFlock(descriptor, LOCK_UN)
        Self.close(descriptor)
        #endif
    }

    #if canImport(Darwin) || canImport(Glibc)
    private static func changeMode(_ descriptor: Int32, mode: mode_t) -> Int32 {
        #if canImport(Darwin)
        Darwin.fchmod(descriptor, mode)
        #else
        Glibc.fchmod(descriptor, mode)
        #endif
    }

    private static func close(_ descriptor: Int32) {
        #if canImport(Darwin)
        _ = Darwin.close(descriptor)
        #else
        _ = Glibc.close(descriptor)
        #endif
    }
    #endif
}

private actor GraphQLFileCacheBackend {
    private static let entryExtension = "entry"

    private let settings: GraphQLFileCacheSettings
    private let fileManager = FileManager.default
    private var ownership: GraphQLFileCacheDirectoryOwnership?
    private var initialized = false
    private var entries: [GraphQLCacheKey: GraphQLFileCacheEntry] = [:]

    init(settings: GraphQLFileCacheSettings) {
        self.settings = settings
    }

    func entry(
        for key: GraphQLCacheKey,
        didReadEntryBody: (@Sendable (URL) -> Void)?
    ) throws -> GraphQLCacheEntry? {
        try ensureInitialized()
        guard GraphQLCacheEntryValidation.isDigest(key.rawValue) else {
            throw GraphQLCacheError.storeFailure("cache key validation failed")
        }
        guard entries[key] != nil else { return nil }
        let url = entryURL(for: key)
        do {
            let values = try url.resourceValues(forKeys: [.contentModificationDateKey])
            guard let lastAccessedAt = values.contentModificationDate else {
                throw GraphQLCacheError.storeFailure("cache access timestamp is unavailable")
            }
            didReadEntryBody?(url)
            let data = try Data(contentsOf: url, options: [.mappedIfSafe])
            let decoded = try GraphQLCacheEnvelope.decode(
                data,
                requestedKey: key,
                maximumEntryBytes: settings.maximumEntryBytes
            )
            let value = GraphQLFileCacheEntry(
                decoded,
                lastAccessedAt: lastAccessedAt
            ).entry(body: decoded.body)
            let validated = try GraphQLCacheEntryValidation.validatedCustomRead(
                value,
                requestedKey: key,
                maximumEntryBytes: settings.maximumEntryBytes
            )
            entries[key] = GraphQLFileCacheEntry(validated)
            return validated
        } catch {
            try? fileManager.removeItem(at: url)
            entries.removeValue(forKey: key)
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
            modificationDate: value.lastAccessedAt,
            didSynchronizeTemporaryFile: didSynchronizeTemporaryFile
        )
        entries[key] = GraphQLFileCacheEntry(value)
        try pruneEntries()
    }

    func removeEntry(for key: GraphQLCacheKey) throws {
        try ensureInitialized()
        guard GraphQLCacheEntryValidation.isDigest(key.rawValue) else {
            throw GraphQLCacheError.storeFailure("cache key validation failed")
        }
        if entries.removeValue(forKey: key) != nil {
            try removeIfPresent(entryURL(for: key))
        }
    }

    func touchEntry(for key: GraphQLCacheKey, at date: Date) throws {
        try ensureInitialized()
        try Task.checkCancellation()
        guard date.timeIntervalSinceReferenceDate.isFinite else {
            throw GraphQLCacheError.storeFailure("cache touch timestamp validation failed")
        }
        guard let old = entries[key] else { return }
        do {
            try fileManager.setAttributes(
                [.modificationDate: date],
                ofItemAtPath: entryURL(for: key).path
            )
        } catch {
            throw GraphQLCacheError.storeFailure("persistent cache touch failed")
        }
        entries[key] = old.accessed(at: date)
    }

    func invalidate(_ filter: GraphQLCacheStoreFilter) throws -> Int {
        try ensureInitialized()
        let keys = entries.compactMap { key, entry in
            GraphQLCacheEntryValidation.matches(entry.metadataEntry, filter: filter) ? key : nil
        }
        for key in keys {
            try removeIfPresent(entryURL(for: key))
            entries.removeValue(forKey: key)
        }
        return keys.count
    }

    func prune() throws {
        try ensureInitialized()
        try pruneEntries()
    }

    private func ensureInitialized() throws {
        guard !initialized else { return }
        do {
            try fileManager.createDirectory(
                at: settings.directoryURL,
                withIntermediateDirectories: true
            )
            try acquireOwnershipIfNeeded()
            try applyDirectoryAttributes()
            try recoverEntries()
            try pruneEntries()
            initialized = true
        } catch let error as GraphQLCacheError {
            throw error
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw GraphQLCacheError.storeFailure("persistent cache initialization failed")
        }
    }

    private func acquireOwnershipIfNeeded() throws {
        guard ownership == nil else { return }
        ownership = try GraphQLFileCacheDirectoryOwnership(directoryURL: settings.directoryURL)
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
            includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey],
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
                let values = try url.resourceValues(
                    forKeys: [.fileSizeKey, .contentModificationDateKey]
                )
                guard let fileSize = values.fileSize,
                      fileSize <= maximumFileSize,
                      let lastAccessedAt = values.contentModificationDate
                else {
                    throw GraphQLCacheError.storeFailure("cache envelope length validation failed")
                }
                entries[key] = try GraphQLCacheEnvelope.index(
                    at: url,
                    fileSize: fileSize,
                    lastAccessedAt: lastAccessedAt,
                    requestedKey: key,
                    maximumEntryBytes: settings.maximumEntryBytes
                )
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

    private func pruneEntries() throws {
        var totalBytes = entries.values.reduce(0) { $0 + $1.bodyLength }
        while entries.count > settings.maximumEntries || totalBytes > settings.maximumTotalBytes {
            guard let oldest = entries.values.min(by: lruPrecedes) else { break }
            try removeIfPresent(entryURL(for: oldest.key))
            entries.removeValue(forKey: oldest.key)
            totalBytes -= oldest.bodyLength
        }
    }

    private func lruPrecedes(
        _ lhs: GraphQLFileCacheEntry,
        _ rhs: GraphQLFileCacheEntry
    ) -> Bool {
        if lhs.lastAccessedAt != rhs.lastAccessedAt {
            return lhs.lastAccessedAt < rhs.lastAccessedAt
        }
        return lhs.key.rawValue < rhs.key.rawValue
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
        modificationDate: Date,
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
            try fileManager.setAttributes(
                [.modificationDate: modificationDate],
                ofItemAtPath: temporary.path
            )
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

    static func index(
        at url: URL,
        fileSize: Int,
        lastAccessedAt: Date,
        requestedKey: GraphQLCacheKey,
        maximumEntryBytes: Int
    ) throws -> GraphQLFileCacheEntry {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        let header = try readExactly(from: handle, count: headerSize)
        var cursor = GraphQLCacheDataCursor(data: header)
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
        guard fileSize == headerSize + metadataLength + bodyLength else {
            throw GraphQLCacheError.storeFailure("cache envelope length validation failed")
        }

        let metadataData = try readExactly(from: handle, count: metadataLength)
        let partial = try JSONDecoder().decode(Metadata.self, from: metadataData).entry
        let metadataEntry = GraphQLCacheEntry(
            key: partial.key,
            body: Data(),
            status: partial.status,
            contentType: partial.contentType,
            createdAt: partial.createdAt,
            lastSuccessfulWriteAt: partial.lastSuccessfulWriteAt,
            lastAccessedAt: lastAccessedAt,
            facets: partial.facets
        )
        let validated = try GraphQLCacheEntryValidation.validatedCustomRead(
            metadataEntry,
            requestedKey: requestedKey,
            maximumEntryBytes: maximumEntryBytes
        )
        return GraphQLFileCacheEntry(
            metadata: validated,
            bodyLength: bodyLength,
            lastAccessedAt: lastAccessedAt
        )
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

    private static func readExactly(from handle: FileHandle, count: Int) throws -> Data {
        var data = Data()
        data.reserveCapacity(count)
        while data.count < count {
            guard let chunk = try handle.read(upToCount: count - data.count), !chunk.isEmpty else {
                throw GraphQLCacheError.storeFailure("cache envelope is truncated")
            }
            data.append(chunk)
        }
        return data
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
