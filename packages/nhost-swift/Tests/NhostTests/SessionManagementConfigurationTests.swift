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

    func testSharedKeychainFactoryRejectsInvalidTimeoutAndMissingContainer() throws {
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

    #if os(macOS)
    func testPublicSharedKeychainFactoryRejectsAppGroupMissingFromProcessEntitlements() {
        let appGroup = "group.io.nhost.missing.\(UUID().uuidString)"

        XCTAssertThrowsError(
            try SessionManagementConfiguration.sharedKeychain(
                options: KeychainSessionStorageOptions(
                    accessGroup: "TEAMID.io.nhost.shared"
                ),
                appGroupIdentifier: appGroup,
                acquisitionTimeout: 0.5
            )
        ) { error in
            XCTAssertEqual(
                error as? SharedSessionConfigurationError,
                .appGroupEntitlementMissing(appGroup)
            )
        }
    }

    func testSharedKeychainFactoryChecksMacOSEntitlementBeforeResolvingContainer() {
        var resolvedContainer = false

        XCTAssertThrowsError(
            try configuration(
                appGroupEntitlementChecker: { _ in false },
                containerResolver: { _ in
                    resolvedContainer = true
                    return FileManager.default.temporaryDirectory
                }
            )
        ) { error in
            XCTAssertEqual(
                error as? SharedSessionConfigurationError,
                .appGroupEntitlementMissing("group.io.nhost.test")
            )
        }
        XCTAssertFalse(resolvedContainer)
    }
    #endif

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

    func testSharedKeychainFactoryDerivesLockFromCanonicalStorageIdentity() throws {
        let first = try configuration()
        let second = try configuration()
        let differentService = try configuration(
            options: KeychainSessionStorageOptions(
                service: "io.nhost.swift.other-session",
                accessGroup: "TEAMID.io.nhost.shared"
            )
        )
        let differentAccount = try configuration(
            options: KeychainSessionStorageOptions(
                accountPrefix: "other-account",
                accessGroup: "TEAMID.io.nhost.shared"
            )
        )
        let differentAccessGroup = try configuration(
            options: KeychainSessionStorageOptions(
                accessGroup: "TEAMID.io.nhost.other-shared"
            )
        )
        let differentAccessibility = try configuration(
            options: KeychainSessionStorageOptions(
                accessGroup: "TEAMID.io.nhost.shared",
                accessibility: .whenUnlocked
            )
        )
        let normalizedAccessGroup = try configuration(
            options: KeychainSessionStorageOptions(
                accessGroup: " \tTEAMID.io.nhost.shared\n "
            )
        )

        XCTAssertTrue(first.storage is KeychainSessionStorageBackend)
        XCTAssertEqual(first.acquisitionPolicy, .automaticRefresh)
        let firstPath = try coordinatorPath(first)
        XCTAssertEqual(firstPath, try coordinatorPath(second))
        XCTAssertNotEqual(firstPath, try coordinatorPath(differentService))
        XCTAssertNotEqual(firstPath, try coordinatorPath(differentAccount))
        XCTAssertNotEqual(firstPath, try coordinatorPath(differentAccessGroup))
        XCTAssertEqual(firstPath, try coordinatorPath(differentAccessibility))
        XCTAssertEqual(firstPath, try coordinatorPath(normalizedAccessGroup))

        #if os(macOS)
        let differentKeychainDomain = try configuration(
            options: KeychainSessionStorageOptions(
                accessGroup: "TEAMID.io.nhost.shared",
                useDataProtectionKeychain: false
            )
        )
        let sameLegacyKeychainItemWithIgnoredAccessGroup = try configuration(
            options: KeychainSessionStorageOptions(
                accessGroup: "TEAMID.io.nhost.other-shared",
                useDataProtectionKeychain: false
            )
        )
        let legacyPath = try coordinatorPath(differentKeychainDomain)
        XCTAssertNotEqual(firstPath, legacyPath)
        XCTAssertEqual(
            legacyPath,
            try coordinatorPath(sameLegacyKeychainItemWithIgnoredAccessGroup)
        )
        #endif
    }

    private func coordinatorPath(_ configuration: SessionManagementConfiguration) throws -> String {
        try XCTUnwrap(configuration.coordinator as? FileSessionCoordinator).canonicalPath
    }

    private func configuration(
        options: KeychainSessionStorageOptions = KeychainSessionStorageOptions(
            accessGroup: "TEAMID.io.nhost.shared"
        ),
        appGroupIdentifier: String = "group.io.nhost.test",
        acquisitionTimeout: TimeInterval = 0.5,
        appGroupEntitlementChecker: (String) -> Bool = { _ in true },
        containerResolver: (String) -> URL? = { _ in
            FileManager.default.temporaryDirectory
        }
    ) throws -> SessionManagementConfiguration {
        try SessionManagementConfiguration.sharedKeychain(
            options: options,
            appGroupIdentifier: appGroupIdentifier,
            acquisitionTimeout: acquisitionTimeout,
            appGroupEntitlementChecker: appGroupEntitlementChecker,
            containerResolver: containerResolver
        )
    }
}
#endif
