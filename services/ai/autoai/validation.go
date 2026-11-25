package autoai

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/ai/hasura"
)

// ErrInvalidConfiguration identifies a rejected deployment, suitable for a 4xx response.
var ErrInvalidConfiguration = errors.New("invalid auto-embeddings configuration")

func invalidConfiguration(message string) error {
	return fmt.Errorf("deploy: %w: %s", ErrInvalidConfiguration, message)
}

// inspectionError reports that the catalog could not be read, as opposed to a
// validation verdict. It is not ErrInvalidConfiguration, so the webhook answers
// 500 and Hasura retries; the deploy path still records it as a deploy: status
// because the functions were not replaced. The worker recognizes InspectionFailure
// and retries on its next tick without writing status.
type inspectionError struct{ subject string }

func (e *inspectionError) Error() string { return "deploy: could not inspect " + e.subject }

// InspectionFailure marks the error for consumers that must not treat it as a verdict.
func (e *inspectionError) InspectionFailure() {}

// maxNameBytes keeps "ai_similar_<name>" within PostgreSQL's 63-byte identifier limit;
// longer names are silently truncated, so deployed functions would not match.
const maxNameBytes = 63 - len("ai_similar_")

// ValidateConfiguration checks provider identity and the current database target.
// Its messages contain no database or provider error text. Unsized vectors are accepted.
func (ai *AutoAI) ValidateConfiguration(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
) error {
	_, err := ai.validateConfiguration(ctx, config)
	return err
}

func (ai *AutoAI) validateConfiguration(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
) ([]hasura.PKInformation, error) {
	if len(config.Name) > maxNameBytes {
		return nil, invalidConfiguration(
			fmt.Sprintf("name must be at most %d bytes", maxNameBytes),
		)
	}

	if _, ok := ai.providers[config.Provider]; !ok {
		return nil, invalidConfiguration("provider is not declared")
	}

	pk, err := ai.catalog.PrimaryKey(ctx, config.SchemaName, config.TableName)
	if err != nil {
		return nil, &inspectionError{subject: "primary key"}
	}

	if len(pk) != 1 {
		return nil, invalidConfiguration("target table must have exactly one primary key column")
	}

	typ, dimensions, err := ai.catalog.VectorColumn(
		ctx,
		config.SchemaName,
		config.TableName,
		config.ColumnName,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, invalidConfiguration("target column does not exist")
	}

	if err != nil {
		return nil, &inspectionError{subject: "target column"}
	}

	if typ != "vector" {
		return nil, invalidConfiguration("target column must have type vector")
	}

	if dimensions > 0 && int64(dimensions) != config.Dimensions {
		return nil, invalidConfiguration(
			"target vector dimensions do not match configuration dimensions",
		)
	}

	if dimensions <= 0 {
		slog.WarnContext(
			ctx,
			"auto-embeddings target vector column is unsized",
			slog.String("configuration_id", config.ID),
		)
	}

	return pk, nil
}
