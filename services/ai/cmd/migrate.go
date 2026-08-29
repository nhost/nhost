package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/nhost/nhost/services/ai/openai"
)

func migrateAssistantsToNewFormat(
	ctx context.Context, hc *hasura.Client, oai *openai.Client, logger *slog.Logger,
) error {
	assistants, err := hc.GetAssistants(
		ctx,
		//nolint:exhaustruct
		&hasura.GraphiteAssistantsBoolExp{
			Data: &hasura.JsonbComparisonExp{
				IsNull: new(true),
			},
		},
	)
	if err != nil {
		return fmt.Errorf("error querying assistant: %w", err)
	}

	if len(assistants.GetGraphiteAssistants()) == 0 {
		logger.InfoContext(ctx, "no assistants to migrate")
	}

	for _, a := range assistants.GetGraphiteAssistants() {
		if a.GetAssistantID() == nil {
			logger.WarnContext(ctx, "assistant has no openAI ID", slog.String("id", a.ID))
			continue
		}

		logger.InfoContext(
			ctx,
			"migrating assistant",
			slog.String("assistant_id", *a.GetAssistantID()),
		)

		oldAss, err := oai.AssistantsGetOld(ctx, *a.GetAssistantID())
		if err != nil {
			return fmt.Errorf("error getting old assistant: %w", err)
		}

		b, err := json.Marshal(oldAss)
		if err != nil {
			return fmt.Errorf("error marshalling assistant: %w", err)
		}

		if _, err = hc.UpdateAssistants(
			ctx,
			//nolint:exhaustruct
			hasura.GraphiteAssistantsBoolExp{
				AssistantID: &hasura.StringComparisonExp{
					Eq: a.GetAssistantID(),
				},
			},
			//nolint:exhaustruct
			hasura.GraphiteAssistantsSetInput{
				Data: b,
			},
		); err != nil {
			return fmt.Errorf("error updating assistant: %w", err)
		}
	}

	return nil
}
