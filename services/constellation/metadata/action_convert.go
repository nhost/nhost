package metadata

import "github.com/nhost/nhost/services/constellation/metadata/internal/hasura"

func convertAction(h hasura.ActionMetadata) ActionMetadata {
	permissions := make([]ActionPermission, len(h.Permissions))
	for i, permission := range h.Permissions {
		permissions[i] = ActionPermission{Role: permission.Role}
	}

	return ActionMetadata{
		Name: h.Name,
		Definition: ActionDefinition{
			Kind:                 h.Definition.Kind,
			Handler:              EnvString(h.Definition.Handler),
			ForwardClientHeaders: h.Definition.ForwardClientHeaders,
			Headers:              convertActionHeaders(h.Definition.Headers),
			Timeout:              h.Definition.Timeout,
			Type:                 h.Definition.Type,
			Arguments:            convertActionArguments(h.Definition.Arguments),
			OutputType:           h.Definition.OutputType,
			RequestTransform:     normalizePermissionMap(h.Definition.RequestTransform),
			ResponseTransform:    normalizePermissionMap(h.Definition.ResponseTransform),
		},
		Permissions: permissions,
		Comment:     h.Comment,
	}
}

// convertActionHeaders maps each hasura.ActionHeader into the native
// ActionHeader, splitting the env value into (value, value_from_env) via
// convertHeaderValue (an env reference wins over a literal).
func convertActionHeaders(headers []hasura.ActionHeader) []ActionHeader {
	result := make([]ActionHeader, len(headers))
	for i, header := range headers {
		value, valueFromEnv := convertHeaderValue(header.Value)
		result[i] = ActionHeader{
			Name:         header.Name,
			Value:        value,
			ValueFromEnv: valueFromEnv,
		}
	}

	return result
}

func convertActionArguments(args []hasura.ActionArgument) []ActionArgument {
	result := make([]ActionArgument, len(args))
	for i, arg := range args {
		result[i] = ActionArgument{
			Name:        arg.Name,
			Type:        arg.Type,
			Description: arg.Description,
		}
	}

	return result
}
