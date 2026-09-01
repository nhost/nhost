package hasura_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/nhost/nhost/services/ai/hasura"
)

func TestCreateRelationship(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		response   sequentialResponse
		wantErr    bool
		fk         any // value of foreign_key_constraint_on (string for object, struct for array)
		wantFKType string
	}{
		{
			name:       "object relationship — string foreign_key_constraint_on",
			response:   sequentialResponse{status: http.StatusOK, body: `{}`},
			fk:         "color_id",
			wantFKType: "string",
		},
		{
			name:     "array relationship — struct foreign_key_constraint_on",
			response: sequentialResponse{status: http.StatusOK, body: `{}`},
			fk: hasura.ArrayRelationshipForeignKey{
				Table: hasura.TrackTableRequestArgsTable{
					Schema: "public", Name: "child",
				},
				Column: "parent_id",
			},
			wantFKType: "object",
		},
		{
			name: "already-exists is swallowed",
			response: sequentialResponse{
				status: http.StatusBadRequest,
				body:   `{"code":"already-exists","error":"relationship already exists","path":"$"}`,
			},
			fk:         "color_id",
			wantFKType: "string",
		},
		{
			name: "other error propagates",
			response: sequentialResponse{
				status: http.StatusBadRequest,
				body:   `{"code":"some-other-code","error":"boom","path":"$"}`,
			},
			fk:         "color_id",
			wantFKType: "string",
			wantErr:    true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			handler, captured := newSequentialHandler(t, []sequentialResponse{tc.response})
			c := newMetadataTestClient(t, handler)

			req := &hasura.CreateRelationshipRequest{
				Type: "pg_create_object_relationship",
				Args: hasura.CreateRelationshipArgs{
					Source: "default",
					Name:   "color",
					Table: hasura.TrackTableRequestArgsTable{
						Schema: "public", Name: "items",
					},
					Using: hasura.RelationshipUsing{
						ForeignKeyConstraintOn: tc.fk,
					},
				},
			}

			err := c.CreateRelationship(context.Background(), req)
			if (err != nil) != tc.wantErr {
				t.Fatalf("CreateRelationship() err = %v, wantErr = %v", err, tc.wantErr)
			}

			if len(*captured) != 1 {
				t.Fatalf("expected 1 request, got %d", len(*captured))
			}

			var parsed map[string]any
			if err := json.Unmarshal((*captured)[0], &parsed); err != nil {
				t.Fatalf("failed to parse request: %v", err)
			}

			args, ok := parsed["args"].(map[string]any)
			if !ok {
				t.Fatalf("args missing or wrong type: %T", parsed["args"])
			}

			using, ok := args["using"].(map[string]any)
			if !ok {
				t.Fatalf("using missing or wrong type: %T", args["using"])
			}

			fkRaw := using["foreign_key_constraint_on"]
			switch tc.wantFKType {
			case "string":
				if _, ok := fkRaw.(string); !ok {
					t.Errorf(
						"foreign_key_constraint_on: expected string, got %T (%v)",
						fkRaw, fkRaw,
					)
				}
			case "object":
				if _, ok := fkRaw.(map[string]any); !ok {
					t.Errorf(
						"foreign_key_constraint_on: expected object, got %T (%v)",
						fkRaw, fkRaw,
					)
				}
			}
		})
	}
}
