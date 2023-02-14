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
	console   string
	dashboard string
	mailhog   string
}

func NewEndpoints(db, graphql, hasura, auth, storage, functions, console, dashboard, mailhog string) *Endpoints {
	return &Endpoints{
		db:        db,
		graphql:   graphql,
		hasura:    hasura,
		auth:      auth,
		storage:   storage,
		functions: functions,
		console:   console,
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
- Hasura Console:	%s
- Mailhog:		%s

- subdomain:		%s
- region:		(empty)

`, e.db, e.hasura, e.graphql, e.auth, e.storage, e.functions, e.dashboard, e.console, e.mailhog, "local")
}
