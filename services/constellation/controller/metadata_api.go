package controller

import (
	"context"
	"crypto/subtle"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/nhost/nhost/services/constellation/metadata"
)

var (
	errMetadataAPIUnavailable      = errors.New("metadata API is not enabled for a writable source")
	errMetadataAPIOperation        = errors.New("unsupported metadata API operation")
	errMetadataAPIActionExists     = errors.New("action already exists")
	errMetadataAPIActionNotFound   = errors.New("action not found")
	errMetadataAPIRoleExists       = errors.New("action permission already exists")
	errMetadataAPIRoleNotFound     = errors.New("action permission not found")
	errMetadataAPIAdminOnly        = errors.New("metadata API requires admin secret")
	errMetadataAPIInvalidArgument  = errors.New("invalid metadata API arguments")
	errMetadataAPIStateUnavailable = errors.New("metadata state is unavailable")
)

const (
	metadataOperationCreateAction           = "create_action"
	metadataOperationUpdateAction           = "update_action"
	metadataOperationDropAction             = "drop_action"
	metadataOperationCreateActionPermission = "create_action_permission"
	metadataOperationDropActionPermission   = "drop_action_permission"
	metadataOperationSetCustomTypes         = "set_custom_types"
)

type writableMetadataSource interface {
	ReplaceMetadata(ctx context.Context, meta *metadata.Metadata) error
}

type metadataAPIRequest struct {
	Type string `json:"type"`
	Args any    `json:"args,omitempty"`
}

type metadataAPIResponse struct {
	Message string `json:"message,omitempty"`
}

// HandlerMetadataAPI returns an admin-secret-protected Hasura-compatible
// metadata API subset for action/custom-type operations. The route is mounted
// only when explicitly enabled by cmd/serve.go; this handler still checks the
// admin-secret header directly so X-Hasura-Role overrides cannot grant access.
func (c *Controller) HandlerMetadataAPI(adminSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeMetadataAPIError(w, http.StatusMethodNotAllowed, "method not allowed")

			return
		}

		if !metadataAPIAdminAuthorized(adminSecret, r.Header) {
			writeMetadataAPIError(w, http.StatusUnauthorized, errMetadataAPIAdminOnly.Error())

			return
		}

		if _, ok := c.source.(writableMetadataSource); !ok {
			writeMetadataAPIError(
				w,
				http.StatusServiceUnavailable,
				errMetadataAPIUnavailable.Error(),
			)

			return
		}

		var req metadataAPIRequest
		if err := json.UnmarshalRead(r.Body, &req); err != nil {
			writeMetadataAPIError(w, http.StatusBadRequest, "invalid JSON body")

			return
		}

		result, err := c.applyMetadataAPIRequest(r.Context(), req)
		if err != nil {
			writeMetadataAPIError(w, metadataAPIStatus(err), err.Error())

			return
		}

		writeMetadataAPIJSON(w, http.StatusOK, result)
	}
}

func metadataAPIAdminAuthorized(adminSecret string, headers http.Header) bool {
	if adminSecret == "" {
		return false
	}

	return subtle.ConstantTimeCompare(
		[]byte(headers.Get("X-Hasura-Admin-Secret")),
		[]byte(adminSecret),
	) == 1
}

func (c *Controller) applyMetadataAPIRequest(
	ctx context.Context,
	req metadataAPIRequest,
) (any, error) {
	switch req.Type {
	case "bulk":
		var items []metadataAPIRequest
		if err := decodeMetadataAPIArgs(req, &items); err != nil {
			return nil, err
		}

		return c.applyMetadataAPIBulk(ctx, items)
	case "export_metadata":
		return c.currentMetadataClone(), nil
	case "reload_metadata":
		meta, err := c.source.InitialLoad(ctx)
		if err != nil {
			return nil, fmt.Errorf("reloading metadata from source: %w", err)
		}

		if err := c.ReloadMetadata(ctx, meta); err != nil {
			return nil, err
		}

		return metadataAPIResponse{Message: "success"}, nil
	case metadataOperationCreateAction, metadataOperationUpdateAction,
		metadataOperationDropAction, metadataOperationCreateActionPermission,
		metadataOperationDropActionPermission, metadataOperationSetCustomTypes:
		return c.applyMetadataWriteRequest(ctx, req)
	default:
		return nil, fmt.Errorf("%w %q", errMetadataAPIOperation, req.Type)
	}
}

func (c *Controller) applyMetadataAPIBulk(
	ctx context.Context,
	items []metadataAPIRequest,
) ([]any, error) {
	c.metadataAPIMu.Lock()
	defer c.metadataAPIMu.Unlock()

	meta := c.currentMetadataClone()
	if meta == nil {
		return nil, errMetadataAPIStateUnavailable
	}

	responses := make([]any, 0, len(items))

	dirty := false
	for _, item := range items {
		if item.Type == "bulk" {
			return nil, fmt.Errorf(
				"%w: nested bulk is not supported",
				errMetadataAPIInvalidArgument,
			)
		}

		if isMetadataAPIWriteOperation(item.Type) {
			if err := applyMetadataWriteMutation(meta, item); err != nil {
				return nil, err
			}

			dirty = true

			responses = append(responses, metadataAPIResponse{Message: "success"})

			continue
		}

		if dirty {
			if err := c.persistMetadataAPIWrite(ctx, meta); err != nil {
				return nil, err
			}

			dirty = false
		}

		response, err := c.applyMetadataAPIRequest(ctx, item)
		if err != nil {
			return nil, err
		}

		responses = append(responses, response)
	}

	if dirty {
		if err := c.persistMetadataAPIWrite(ctx, meta); err != nil {
			return nil, err
		}
	}

	return responses, nil
}

func (c *Controller) applyMetadataWriteRequest(
	ctx context.Context,
	req metadataAPIRequest,
) (any, error) {
	c.metadataAPIMu.Lock()
	defer c.metadataAPIMu.Unlock()

	meta := c.currentMetadataClone()
	if meta == nil {
		return nil, errMetadataAPIStateUnavailable
	}

	if err := applyMetadataWriteMutation(meta, req); err != nil {
		return nil, err
	}

	if err := c.persistMetadataAPIWrite(ctx, meta); err != nil {
		return nil, err
	}

	return metadataAPIResponse{Message: "success"}, nil
}

func applyMetadataWriteMutation(meta *metadata.Metadata, req metadataAPIRequest) error {
	switch req.Type {
	case metadataOperationCreateAction:
		return metadataAPICreateAction(meta, req)
	case metadataOperationUpdateAction:
		return metadataAPIUpdateAction(meta, req)
	case metadataOperationDropAction:
		return metadataAPIDropAction(meta, req)
	case metadataOperationCreateActionPermission:
		return metadataAPICreateActionPermission(meta, req)
	case metadataOperationDropActionPermission:
		return metadataAPIDropActionPermission(meta, req)
	case metadataOperationSetCustomTypes:
		return metadataAPISetCustomTypes(meta, req)
	default:
		return fmt.Errorf("%w %q", errMetadataAPIOperation, req.Type)
	}
}

func (c *Controller) persistMetadataAPIWrite(
	ctx context.Context,
	meta *metadata.Metadata,
) error {
	writer, ok := c.source.(writableMetadataSource)
	if !ok {
		return errMetadataAPIUnavailable
	}

	if err := writer.ReplaceMetadata(ctx, meta); err != nil {
		return fmt.Errorf("writing metadata: %w", err)
	}

	if err := c.ReloadMetadata(ctx, meta); err != nil {
		return err
	}

	return nil
}

func isMetadataAPIWriteOperation(operation string) bool {
	switch operation {
	case metadataOperationCreateAction, metadataOperationUpdateAction,
		metadataOperationDropAction, metadataOperationCreateActionPermission,
		metadataOperationDropActionPermission, metadataOperationSetCustomTypes:
		return true
	default:
		return false
	}
}

// ReloadMetadata rebuilds controller state from meta and swaps it atomically.
func (c *Controller) ReloadMetadata(ctx context.Context, meta *metadata.Metadata) error {
	newState, err := buildState(
		ctx,
		meta,
		c.pollingInterval,
		c.logger,
		c.connectorOptions,
	)
	if err != nil {
		return fmt.Errorf("rebuilding metadata API state: %w", err)
	}

	logInconsistencySummary(ctx, c.logger, newState.inconsistencies)
	c.swapState(ctx, newState, c.logger)

	return nil
}

func (c *Controller) currentMetadataClone() *metadata.Metadata {
	state := c.state.Load()
	if state == nil || state.metadata == nil {
		return nil
	}

	data, err := json.Marshal(state.metadata)
	if err != nil {
		return nil
	}

	var clone metadata.Metadata
	if err := json.Unmarshal(data, &clone); err != nil {
		return nil
	}

	return &clone
}

func metadataAPICreateAction(meta *metadata.Metadata, req metadataAPIRequest) error {
	var actionMeta metadata.ActionMetadata
	if err := decodeMetadataAPIAction(req, &actionMeta); err != nil {
		return err
	}

	if actionMeta.Name == "" {
		return fmt.Errorf("%w: action name is required", errMetadataAPIInvalidArgument)
	}

	if _, ok := findAction(meta.Actions, actionMeta.Name); ok {
		return fmt.Errorf("%w %q", errMetadataAPIActionExists, actionMeta.Name)
	}

	meta.Actions = append(meta.Actions, actionMeta)

	return nil
}

func metadataAPIUpdateAction(meta *metadata.Metadata, req metadataAPIRequest) error {
	var actionMeta metadata.ActionMetadata
	if err := decodeMetadataAPIAction(req, &actionMeta); err != nil {
		return err
	}

	idx, ok := findAction(meta.Actions, actionMeta.Name)
	if !ok {
		return fmt.Errorf("%w %q", errMetadataAPIActionNotFound, actionMeta.Name)
	}

	if len(actionMeta.Permissions) == 0 {
		actionMeta.Permissions = meta.Actions[idx].Permissions
	}

	meta.Actions[idx] = actionMeta

	return nil
}

func metadataAPIDropAction(meta *metadata.Metadata, req metadataAPIRequest) error {
	var args struct {
		Name      string `json:"name"`
		ClearData bool   `json:"clear_data,omitempty"`
	}
	if err := decodeMetadataAPIArgs(req, &args); err != nil {
		return err
	}

	idx, ok := findAction(meta.Actions, args.Name)
	if !ok {
		return fmt.Errorf("%w %q", errMetadataAPIActionNotFound, args.Name)
	}

	meta.Actions = slices.Delete(meta.Actions, idx, idx+1)

	return nil
}

func metadataAPICreateActionPermission(meta *metadata.Metadata, req metadataAPIRequest) error {
	var args actionPermissionArgs
	if err := decodeMetadataAPIArgs(req, &args); err != nil {
		return err
	}

	idx, ok := findAction(meta.Actions, args.Action)
	if !ok {
		return fmt.Errorf("%w %q", errMetadataAPIActionNotFound, args.Action)
	}

	role := args.role()
	if role == "" {
		return fmt.Errorf("%w: role is required", errMetadataAPIInvalidArgument)
	}

	for _, permission := range meta.Actions[idx].Permissions {
		if permission.Role == role {
			return fmt.Errorf("%w %q", errMetadataAPIRoleExists, role)
		}
	}

	meta.Actions[idx].Permissions = append(
		meta.Actions[idx].Permissions,
		metadata.ActionPermission{Role: role},
	)

	return nil
}

func metadataAPIDropActionPermission(meta *metadata.Metadata, req metadataAPIRequest) error {
	var args actionPermissionArgs
	if err := decodeMetadataAPIArgs(req, &args); err != nil {
		return err
	}

	idx, ok := findAction(meta.Actions, args.Action)
	if !ok {
		return fmt.Errorf("%w %q", errMetadataAPIActionNotFound, args.Action)
	}

	role := args.role()
	for i, permission := range meta.Actions[idx].Permissions {
		if permission.Role == role {
			meta.Actions[idx].Permissions = slices.Delete(
				meta.Actions[idx].Permissions,
				i,
				i+1,
			)

			return nil
		}
	}

	return fmt.Errorf("%w %q", errMetadataAPIRoleNotFound, role)
}

func metadataAPISetCustomTypes(meta *metadata.Metadata, req metadataAPIRequest) error {
	var args struct {
		CustomTypes metadata.CustomTypes `json:"custom_types"`
	}
	if err := decodeMetadataAPIArgs(req, &args); err != nil {
		return err
	}

	if args.CustomTypes.IsZero() {
		var direct metadata.CustomTypes
		if err := decodeMetadataAPIArgs(req, &direct); err != nil {
			return err
		}

		args.CustomTypes = direct
	}

	meta.CustomTypes = args.CustomTypes

	return nil
}

type actionPermissionArgs struct {
	Action     string                    `json:"action"`
	Role       string                    `json:"role,omitempty"`
	Permission metadata.ActionPermission `json:"permission"`
}

func (a actionPermissionArgs) role() string {
	if a.Role != "" {
		return a.Role
	}

	return a.Permission.Role
}

func decodeMetadataAPIAction(req metadataAPIRequest, out *metadata.ActionMetadata) error {
	if err := decodeMetadataAPIArgs(req, out); err != nil {
		return err
	}

	if out.Name != "" {
		return nil
	}

	var wrapped struct {
		Action metadata.ActionMetadata `json:"action"`
	}
	if err := decodeMetadataAPIArgs(req, &wrapped); err != nil {
		return err
	}

	if wrapped.Action.Name == "" {
		return fmt.Errorf("%w: action is required", errMetadataAPIInvalidArgument)
	}

	*out = wrapped.Action

	return nil
}

func decodeMetadataAPIArgs(req metadataAPIRequest, out any) error {
	data, err := json.Marshal(req.Args)
	if err != nil {
		return fmt.Errorf("encoding metadata API args: %w", err)
	}

	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("decoding metadata API args: %w", err)
	}

	return nil
}

func findAction(actions []metadata.ActionMetadata, name string) (int, bool) {
	for i, actionMeta := range actions {
		if actionMeta.Name == name {
			return i, true
		}
	}

	return 0, false
}

func metadataAPIStatus(err error) int {
	switch {
	case errors.Is(err, errMetadataAPIAdminOnly):
		return http.StatusUnauthorized
	case errors.Is(err, errMetadataAPIUnavailable):
		return http.StatusServiceUnavailable
	case errors.Is(err, errMetadataAPIOperation),
		errors.Is(err, errMetadataAPIInvalidArgument):
		return http.StatusBadRequest
	case errors.Is(err, errMetadataAPIActionNotFound),
		errors.Is(err, errMetadataAPIRoleNotFound):
		return http.StatusNotFound
	default:
		return http.StatusBadRequest
	}
}

func writeMetadataAPIError(w http.ResponseWriter, status int, message string) {
	writeMetadataAPIJSON(w, status, map[string]any{"error": message})
}

func writeMetadataAPIJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.MarshalWrite(w, value); err != nil {
		_, _ = w.Write([]byte(`{"error":"failed to encode response"}`))
	}
}
