package protocol

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/go-webauthn/webauthn/metadata"
)

func ValidateMetadata(ctx context.Context, aaguid uuid.UUID, mds metadata.Provider) (err error) {
	if mds == nil {
		return nil
	}

	var (
		entry *metadata.Entry
	)

	if entry, err = mds.GetEntry(ctx, aaguid); err != nil {
		return err
	}

	if entry == nil {
		if aaguid == uuid.Nil && mds.GetValidateEntryPermitZeroAAGUID(ctx) {
			return nil
		}

		if mds.GetValidateEntry(ctx) {
			return fmt.Errorf("error occurred performing authenticator entry validation: AAGUID entry has not been registered with the metadata service")
		}

		return nil
	}

	if mds.GetValidateStatus(ctx) {
		if err = mds.ValidateStatusReports(ctx, entry.StatusReports); err != nil {
			return fmt.Errorf("error occurred performing authenticator status validation: %w", err)
		}
	}

	return nil
}
