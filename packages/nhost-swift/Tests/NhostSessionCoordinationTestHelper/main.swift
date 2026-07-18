import Foundation
import Nhost
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

@_silgen_name("flock")
private func systemFlock(_ descriptor: Int32, _ operation: Int32) -> Int32

private func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("\(message)\n".utf8))
    exit(2)
}

private func signalReady() {
    FileHandle.standardOutput.write(Data("READY\n".utf8))
}

private func waitForSignal() {
    _ = FileHandle.standardInput.readData(ofLength: 1)
}

guard CommandLine.arguments.count == 3 else {
    fail(
        "usage: NhostSessionCoordinationTestHelper "
            + "<lock-path-or-cache-directory> <close|crash|cache-close|cache-crash|cache-deinit>"
    )
}

let path = CommandLine.arguments[1]
let mode = CommandLine.arguments[2]

if mode.hasPrefix("cache-") {
    var store: FileGraphQLCacheStore? = FileGraphQLCacheStore(
        configuration: GraphQLCacheConfiguration(
            directoryURL: URL(fileURLWithPath: path, isDirectory: true),
            fileProtection: .none
        )
    )
    do {
        try await store?.prune()
    } catch {
        fail("cache acquisition failed: \(error.localizedDescription)")
    }

    signalReady()
    waitForSignal()

    switch mode {
    case "cache-close":
        store = nil
        exit(0)
    case "cache-crash":
        // Deliberately skip deinitialization. Kernel process teardown must
        // release the backend's lifetime ownership descriptor.
        _exit(99)
    case "cache-deinit":
        store = nil
        FileHandle.standardOutput.write(Data("RELEASED\n".utf8))
        waitForSignal()
        exit(0)
    default:
        fail("unknown mode: \(mode)")
    }
}

let descriptor = open(path, O_CREAT | O_RDWR | O_CLOEXEC, 0o600)
guard descriptor >= 0 else { fail("open failed: \(errno)") }
guard fchmod(descriptor, 0o600) == 0 else { fail("fchmod failed: \(errno)") }

while systemFlock(descriptor, LOCK_EX | LOCK_NB) != 0 {
    if errno == EINTR {
        continue
    }
    guard errno == EWOULDBLOCK || errno == EAGAIN else {
        fail("flock failed: \(errno)")
    }
    usleep(1_000)
}

signalReady()
waitForSignal()

switch mode {
case "close":
    // Deliberately rely on descriptor close to release ownership.
    _ = close(descriptor)
    exit(0)
case "crash":
    // Deliberately skip unlock/close. Kernel process teardown must release it.
    _exit(99)
default:
    fail("unknown mode: \(mode)")
}
