import Foundation

/// REST JSON coding helpers shared by generated Auth and Storage clients.
///
/// The REST date strategy emits RFC3339 timestamps with fractional seconds and decodes both
/// fractional and non-fractional RFC3339 strings, matching common Nhost REST payloads.
public enum NhostJSON {
    public static var restEncoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(format(date))
        }
        return encoder
    }

    public static var restDecoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)

            guard let date = parse(value) else {
                throw DecodingError.dataCorruptedError(
                    in: container,
                    debugDescription: "Expected RFC3339 date-time"
                )
            }

            return date
        }
        return decoder
    }

    public static func format(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    public static func parse(_ value: String) -> Date? {
        let withFractionalSeconds = ISO8601DateFormatter()
        withFractionalSeconds.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFractionalSeconds.date(from: value) {
            return date
        }

        let withoutFractionalSeconds = ISO8601DateFormatter()
        withoutFractionalSeconds.formatOptions = [.withInternetDateTime]
        return withoutFractionalSeconds.date(from: value)
    }
}
