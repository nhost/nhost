package middleware_test

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/graph/middleware"
)

func TestIsAdminDirective(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		ctx         func() context.Context
		expectedErr error
	}{
		{
			name: "auth header, allowed admin, default user, role header admin",
			ctx: func() context.Context {
				headers := http.Header{}

				headers.Set(
					"Authorization",
					"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwMTg1MTI1MDUsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInVzZXIiLCJwcm9qZWN0X21hbmFnZXIiLCJhbm9ueW1vdXMiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiJhYjViYTU4ZS05MzJhLTQwZGMtODdlOC03MzM5OTg3OTRlYzIiLCJ4LWhhc3VyYS11c2VyLWlzQW5vbnltb3VzIjoiZmFsc2UifSwiaWF0IjoxNzAzMTUyNTA1LCJpc3MiOiJoYXN1cmEtYXV0aCIsInN1YiI6ImFiNWJhNThlLTkzMmEtNDBkYy04N2U4LTczMzk5ODc5NGVjMiJ9.yVPlgfBroRhs8Shuu_bMkC2TZa2Be3qrMwAALAvinRk",
				)
				headers.Set("X-Hasura-Role", "admin")

				ginCtx, _ := gin.CreateTestContext(nil)
				ginCtx.Request = &http.Request{
					Header: headers,
				}

				return middleware.GinToContext(
					t.Context(),
					ginCtx,
				)
			},
			expectedErr: nil,
		},
		{
			name: "auth header, allowed admin, default user, role header user",
			ctx: func() context.Context {
				headers := http.Header{}

				headers.Set(
					"Authorization",
					"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwMTg1MTI1MDUsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInVzZXIiLCJwcm9qZWN0X21hbmFnZXIiLCJhbm9ueW1vdXMiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiJhYjViYTU4ZS05MzJhLTQwZGMtODdlOC03MzM5OTg3OTRlYzIiLCJ4LWhhc3VyYS11c2VyLWlzQW5vbnltb3VzIjoiZmFsc2UifSwiaWF0IjoxNzAzMTUyNTA1LCJpc3MiOiJoYXN1cmEtYXV0aCIsInN1YiI6ImFiNWJhNThlLTkzMmEtNDBkYy04N2U4LTczMzk5ODc5NGVjMiJ9.yVPlgfBroRhs8Shuu_bMkC2TZa2Be3qrMwAALAvinRk",
				)
				headers.Set("X-Hasura-Role", "user")

				ginCtx, _ := gin.CreateTestContext(nil)
				ginCtx.Request = &http.Request{
					Header: headers,
				}

				return middleware.GinToContext(
					t.Context(),
					ginCtx,
				)
			},
			expectedErr: middleware.ErrNotAdmin,
		},
		{
			name: "auth header, allowed admin, default user, role header missing",
			ctx: func() context.Context {
				headers := http.Header{}

				headers.Set(
					"Authorization",
					"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwMTg1MTI1MDUsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInVzZXIiLCJwcm9qZWN0X21hbmFnZXIiLCJhbm9ueW1vdXMiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiJhYjViYTU4ZS05MzJhLTQwZGMtODdlOC03MzM5OTg3OTRlYzIiLCJ4LWhhc3VyYS11c2VyLWlzQW5vbnltb3VzIjoiZmFsc2UifSwiaWF0IjoxNzAzMTUyNTA1LCJpc3MiOiJoYXN1cmEtYXV0aCIsInN1YiI6ImFiNWJhNThlLTkzMmEtNDBkYy04N2U4LTczMzk5ODc5NGVjMiJ9.yVPlgfBroRhs8Shuu_bMkC2TZa2Be3qrMwAALAvinRk",
				)

				ginCtx, _ := gin.CreateTestContext(nil)
				ginCtx.Request = &http.Request{
					Header: headers,
				}

				return middleware.GinToContext(
					t.Context(),
					ginCtx,
				)
			},
			expectedErr: middleware.ErrNotAdmin,
		},
		{
			name: "auth header, not allowed admin, default user, role admin header",
			ctx: func() context.Context {
				headers := http.Header{}

				headers.Set(
					"Authorization",
					"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwMTg1MTI2NzEsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIiwicHJvamVjdF9tYW5hZ2VyIiwiYW5vbnltb3VzIl0sIngtaGFzdXJhLWRlZmF1bHQtcm9sZSI6InVzZXIiLCJ4LWhhc3VyYS11c2VyLWlkIjoiYWI1YmE1OGUtOTMyYS00MGRjLTg3ZTgtNzMzOTk4Nzk0ZWMyIiwieC1oYXN1cmEtdXNlci1pc0Fub255bW91cyI6ImZhbHNlIn0sImlhdCI6MTcwMzE1MjY3MSwiaXNzIjoiaGFzdXJhLWF1dGgiLCJzdWIiOiJhYjViYTU4ZS05MzJhLTQwZGMtODdlOC03MzM5OTg3OTRlYzIifQ.qbidvSGMczizpeiDpc_8ixQiDhv2ZkCsGujeXj5M4Bs",
				)
				headers.Set("X-Hasura-Role", "admin")

				ginCtx, _ := gin.CreateTestContext(nil)
				ginCtx.Request = &http.Request{
					Header: headers,
				}

				return middleware.GinToContext(
					t.Context(),
					ginCtx,
				)
			},
			expectedErr: middleware.ErrNotAdmin,
		},
		{
			name: "no auth header",
			ctx: func() context.Context {
				headers := http.Header{}
				ginCtx, _ := gin.CreateTestContext(nil)
				ginCtx.Request = &http.Request{
					Header: headers,
				}

				return middleware.GinToContext(
					t.Context(),
					ginCtx,
				)
			},
			expectedErr: nil,
		},
		{
			name: "no auth header, user role header",
			ctx: func() context.Context {
				headers := http.Header{}
				headers.Set("X-Hasura-Role", "user")

				ginCtx, _ := gin.CreateTestContext(nil)
				ginCtx.Request = &http.Request{
					Header: headers,
				}

				return middleware.GinToContext(
					t.Context(),
					ginCtx,
				)
			},
			expectedErr: middleware.ErrNotAdmin,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := middleware.IsAdminDirective(
				tc.ctx(),
				nil,
				func(_ context.Context) (any, error) { return nil, nil }, //nolint:nilnil
			)
			if !errors.Is(err, tc.expectedErr) {
				t.Errorf("expected error %v, got %v", tc.expectedErr, err)
			}
		})
	}
}
