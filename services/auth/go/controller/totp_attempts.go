package controller

import (
	"context"
	"errors"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (wf *Workflows) applyTOTPAttemptPolicy(
	ctx context.Context,
	userID uuid.UUID,
	valid bool,
	logger *slog.Logger,
) *APIError {
	if valid {
		rowsAffected, err := wf.db.ResetTOTPAttempts(ctx, userID)
		if err != nil {
			logger.ErrorContext(ctx, "failed to reset totp attempts", logError(err))
			return ErrInternalServerError
		}

		if rowsAffected == 0 {
			logger.WarnContext(ctx, "totp verification locked after too many attempts")
			return ErrTooManyOTPAttempts
		}

		return nil
	}

	exhausted, err := wf.db.RecordFailedTOTPAttempt(
		ctx,
		sql.RecordFailedTOTPAttemptParams{
			MaxAttempts: pgtype.Int4{
				Int32: maxOTPVerificationAttempts,
				Valid: true,
			},
			LockoutDuration: pgtype.Interval{
				Microseconds: totpAttemptLockoutDuration.Microseconds(),
				Days:         0,
				Months:       0,
				Valid:        true,
			},
			ID: pgtype.UUID{Bytes: userID, Valid: true},
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "totp verification locked after too many attempts")
		return ErrTooManyOTPAttempts
	}

	if err != nil {
		logger.ErrorContext(ctx, "failed to record totp attempt", logError(err))
		return ErrInternalServerError
	}

	if exhausted {
		logger.WarnContext(ctx, "totp verification locked after too many attempts")
		return ErrTooManyOTPAttempts
	}

	logger.WarnContext(ctx, "invalid totp")

	return ErrInvalidTotp
}
