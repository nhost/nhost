import Foundation

/// Source of binary content for uploads.
///
/// `.data` keeps the bytes in memory (the caller already holds them); `.fileURL`
/// is streamed from disk and never fully loaded into memory, like a browser
/// `File` in nhost-js.
public enum NhostFileSource: Sendable, Equatable {
    case data(Data)
    case fileURL(URL)
}
