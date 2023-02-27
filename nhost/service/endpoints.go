package service

import (
	"fmt"
	"io"
)

type Endpoints struct {
	db        string
	graphql   string
	hasura    string
	auth      string
	storage   string
	functions string
	dashboard string
	mailhog   string
}

func NewEndpoints(db, graphql, hasura, auth, storage, functions, dashboard, mailhog string) *Endpoints {
	return &Endpoints{
		db:        db,
		graphql:   graphql,
		hasura:    hasura,
		auth:      auth,
		storage:   storage,
		functions: functions,
		dashboard: dashboard,
		mailhog:   mailhog,
	}
}

func (e Endpoints) Dump(out io.Writer) {
	fmt.Fprintf(out, `

URLs:
- Postgres:		%s
- Hasura:		%s
- GraphQL:		%s
- Auth:			%s
- Storage:		%s
- Functions:		%s

- Dashboard:		%s
- Mailhog:		%s

- subdomain:		%s
- region:		(empty)

`, e.db, e.hasura, e.graphql, e.auth, e.storage, e.functions, e.dashboard, e.mailhog, "local")
}
