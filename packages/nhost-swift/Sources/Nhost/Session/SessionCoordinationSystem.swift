#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

@_silgen_name("flock")
private func nhostSystemFlock(_ descriptor: Int32, _ operation: Int32) -> Int32

/// Injectable POSIX seam used to deterministically verify descriptor ownership
/// and cleanup while production coordinators use the live system calls.
struct SessionFileLockSystem: Sendable {
    let openFile: @Sendable (String, Int32, mode_t) -> Int32
    let changeMode: @Sendable (Int32, mode_t) -> Int32
    let flockFile: @Sendable (Int32, Int32) -> Int32
    let closeFile: @Sendable (Int32) -> Int32
    let errorCode: @Sendable () -> Int32

    static let live = SessionFileLockSystem(
        openFile: { path, flags, mode in
            #if canImport(Darwin)
            Darwin.open(path, flags, mode)
            #else
            Glibc.open(path, flags, mode)
            #endif
        },
        changeMode: { descriptor, mode in
            #if canImport(Darwin)
            Darwin.fchmod(descriptor, mode)
            #else
            Glibc.fchmod(descriptor, mode)
            #endif
        },
        flockFile: { descriptor, operation in
            nhostSystemFlock(descriptor, operation)
        },
        closeFile: { descriptor in
            #if canImport(Darwin)
            Darwin.close(descriptor)
            #else
            Glibc.close(descriptor)
            #endif
        },
        errorCode: {
            errno
        }
    )
}
