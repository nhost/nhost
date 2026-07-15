import Foundation

/// Retry and error classification for rotating refresh requests.
enum SessionRefreshPolicy {
    static let maximumRetryAfter: TimeInterval = 1

    static func retryDelay(
        for error: any Error,
        now: @escaping @Sendable () -> Date
    ) -> TimeInterval? {
        if let fetchError = error as? FetchError {
            switch fetchError {
            case .transport:
                return 0
            case let .http(httpError):
                if httpError.status == 408 || (500...599).contains(httpError.status) {
                    return 0
                }
                if httpError.status == 429,
                   let value = NhostHeaderLookup.value(in: httpError.headers, named: "Retry-After"),
                   let delay = parseRetryAfter(value, now: now()),
                   delay <= maximumRetryAfter {
                    return delay
                }
            case .invalidResponse, .encoding, .decoding:
                break
            }
            return nil
        }

        if let urlError = error as? URLError, urlError.code != .cancelled {
            return 0
        }
        return nil
    }

    static func isTransient(_ error: any Error) -> Bool {
        if let fetchError = error as? FetchError {
            switch fetchError {
            case .transport:
                return true
            case let .http(httpError):
                return httpError.status == 408
                    || httpError.status == 429
                    || (500...599).contains(httpError.status)
            case .invalidResponse, .encoding, .decoding:
                return false
            }
        }
        return error is URLError && !isCancellation(error)
    }

    static func isInvalidRefreshToken(_ error: any Error) -> Bool {
        guard let fetchError = error as? FetchError,
              let response = fetchError.decodedBody(AuthErrorResponse.self)
        else {
            return false
        }
        return response.error == .invalidRefreshToken
    }

    static func isCancellation(_ error: any Error) -> Bool {
        if error is CancellationError {
            return true
        }
        return (error as? URLError)?.code == .cancelled
    }

    static func defaultSleep(_ interval: TimeInterval) async throws {
        let nanoseconds = UInt64(min(max(interval, 0) * 1_000_000_000, Double(UInt64.max)))
        try await Task.sleep(nanoseconds: nanoseconds)
    }

    private static func parseRetryAfter(_ value: String, now: Date) -> TimeInterval? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if let seconds = TimeInterval(trimmed), seconds.isFinite, seconds >= 0 {
            return seconds
        }

        for format in [
            "EEE',' dd MMM yyyy HH':'mm':'ss z",
            "EEEE',' dd-MMM-yy HH':'mm':'ss z",
            "EEE MMM d HH':'mm':'ss yyyy"
        ] {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            formatter.dateFormat = format
            if let date = formatter.date(from: trimmed) {
                return max(date.timeIntervalSince(now), 0)
            }
        }
        return nil
    }
}
