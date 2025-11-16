package migrations

import (
	"context"
	"fmt"
	"log/slog"

	crypto "github.com/nhost/nhost/services/auth/go/cryto"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func EncryptTOTPSecrets(
	ctx context.Context, db *sql.Queries, encrypter *crypto.Encrypter, logger *slog.Logger,
) error {
	users, err := db.GetUsersWithUnencryptedTOTPSecret(ctx)
	if err != nil {
		return fmt.Errorf("failed to get users with unencrypted TOTP secret: %w", err)
	}

	if len(users) == 0 {
		logger.InfoContext(ctx, "No users with unencrypted TOTP secret found")
		return nil
	}

	logger.InfoContext(ctx, "Encrypting TOTP secrets for users", slog.Int("count", len(users)))

	for _, user := range users {
		encryptedTOTPSecret, err := encrypter.Encrypt([]byte(user.TotpSecret.String))
		if err != nil {
			return fmt.Errorf("failed to encrypt TOTP secret for user %s: %w", user.ID, err)
		}

		if err := db.UpdateUserTotpSecret(ctx, sql.UpdateUserTotpSecretParams{
			ID:         user.ID,
			TotpSecret: sql.Text(string(encryptedTOTPSecret)),
		}); err != nil {
			return fmt.Errorf("failed to update TOTP secret for user %s: %w", user.ID, err)
		}
	}

	logger.InfoContext(ctx, "Successfully encrypted TOTP secrets for all users")

	return nil
}
