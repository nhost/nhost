import Foundation
import XCTest
@testable import Nhost

#if canImport(Security) && canImport(Darwin)
final class SessionManagementConfigurationTests: XCTestCase {
    func testPublicSharedKeychainFactoryFailsClosedForUnexpandedAccessGroup() {
        XCTAssertThrowsError(
            try SessionManagementConfiguration.sharedKeychain(
                options: KeychainSessionStorageOptions(
                    accessGroup: "$(AppIdentifierPrefix)io.nhost.shared"
                ),
                appGroupIdentifier: "group.io.nhost.test",
                lockNamespace: "primary-session",
                acquisitionTimeout: 0.5
            )
        ) { error in
            XCTAssertEqual(
                error as? SharedSessionConfigurationError,
                .unexpandedAccessGroup("$(AppIdentifierPrefix)io.nhost.shared")
            )
        }
    }

    func testSharedKeychainFactoryRejectsMissingAndUnexpandedEntitlementValues() throws {
        XCTAssertThrowsError(
            try configuration(options: KeychainSessionStorageOptions(accessGroup: nil))
        ) { error in
            XCTAssertEqual(error as? SharedSessionConfigurationError, .emptyAccessGroup)
        }
        XCTAssertThrowsError(
            try configuration(options: KeychainSessionStorageOptions(accessGroup: "   "))
        ) { error in
            XCTAssertEqual(error as? SharedSessionConfigurationError, .emptyAccessGroup)
        }
        XCTAssertThrowsError(
            try configuration(
                options: KeychainSessionStorageOptions(
                    accessGroup: "$(AppIdentifierPrefix)io.nhost.shared"
                )
            )
        ) { error in
            XCTAssertEqual(
                error as? SharedSessionConfigurationError,
                .unexpandedAccessGroup("$(AppIdentifierPrefix)io.nhost.shared")
            )
        }
        XCTAssertThrowsError(try configuration(appGroupIdentifier: "")) { error in
            XCTAssertEqual(
                error as? SharedSessionConfigurationError,
                .emptyAppGroupIdentifier
            )
        }
        XCTAssertThrowsError(
            try configuration(appGroupIdentifier: "${NHOST_APP_GROUP}")
        ) { error in
            XCTAssertEqual(
                error as? SharedSessionConfigurationError,
                .unexpandedAppGroupIdentifier("${NHOST_APP_GROUP}")
            )
        }
    }

    func testSharedKeychainFactoryRejectsInvalidLockConfigurationAndMissingContainer() throws {
        XCTAssertThrowsError(try configuration(lockNamespace: "  ")) { error in
            XCTAssertEqual(error as? SharedSessionConfigurationError, .emptyLockNamespace)
        }
        XCTAssertThrowsError(try configuration(acquisitionTimeout: 0)) { error in
            XCTAssertEqual(
                error as? SharedSessionConfigurationError,
                .invalidAcquisitionTimeout
            )
        }
        XCTAssertThrowsError(try configuration(containerResolver: { _ in nil })) { error in
            XCTAssertEqual(
                error as? SharedSessionConfigurationError,
                .appGroupContainerUnavailable("group.io.nhost.test")
            )
        }
    }

    func testSharedKeychainFactoryUsesTrimmedAccessGroupWithoutChangingOtherOptions() throws {
        let originalOptions = KeychainSessionStorageOptions(
            service: "io.nhost.swift.custom-session",
            accountPrefix: "shared-account",
            accessGroup: " \tTEAMID.io.nhost.shared\n ",
            accessibility: .whenUnlocked,
            useDataProtectionKeychain: false
        )

        let configured = try configuration(options: originalOptions)
        let storage = try XCTUnwrap(configured.storage as? KeychainSessionStorageBackend)
        let usedOptions = storage.storageOptions

        XCTAssertEqual(usedOptions.accessGroup, "TEAMID.io.nhost.shared")
        XCTAssertEqual(usedOptions.service, originalOptions.service)
        XCTAssertEqual(usedOptions.account, originalOptions.account)
        XCTAssertEqual(usedOptions.accessibility.rawValue, originalOptions.accessibility.rawValue)
        XCTAssertEqual(
            usedOptions.useDataProtectionKeychain,
            originalOptions.useDataProtectionKeychain
        )
    }

    func testSharedKeychainFactoryCouplesStableLockIdentityAndAutomaticRefresh() throws {
        let first = try configuration()
        let second = try configuration()
        let distinct = try configuration(lockNamespace: "another-session")

        XCTAssertTrue(first.storage is KeychainSessionStorageBackend)
        XCTAssertEqual(first.acquisitionPolicy, .automaticRefresh)
        let firstCoordinator = try XCTUnwrap(first.coordinator as? FileSessionCoordinator)
        let secondCoordinator = try XCTUnwrap(second.coordinator as? FileSessionCoordinator)
        let distinctCoordinator = try XCTUnwrap(distinct.coordinator as? FileSessionCoordinator)
        XCTAssertEqual(firstCoordinator.canonicalPath, secondCoordinator.canonicalPath)
        XCTAssertNotEqual(firstCoordinator.canonicalPath, distinctCoordinator.canonicalPath)
    }

    private func configuration(
        options: KeychainSessionStorageOptions = KeychainSessionStorageOptions(
            accessGroup: "TEAMID.io.nhost.shared"
        ),
        appGroupIdentifier: String = "group.io.nhost.test",
        lockNamespace: String = "primary-session",
        acquisitionTimeout: TimeInterval = 0.5,
        containerResolver: (String) -> URL? = { _ in
            FileManager.default.temporaryDirectory
        }
    ) throws -> SessionManagementConfiguration {
        try SessionManagementConfiguration.sharedKeychain(
            options: options,
            appGroupIdentifier: appGroupIdentifier,
            lockNamespace: lockNamespace,
            acquisitionTimeout: acquisitionTimeout,
            containerResolver: containerResolver
        )
    }
}
#endif
