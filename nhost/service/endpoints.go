package service

import (
	"fmt"
	"io"
)

type Endpoints struct {
	db        string
	graphql   string
	auth      string
	storage   string
	functions string
	console   string
	mailhog   string
}

func newEndpoints(db, graphql, auth, storage, functions, console, mailhog string) *Endpoints {
	return &Endpoints{
		db:        db,
		graphql:   graphql,
		auth:      auth,
		storage:   storage,
		functions: functions,
		console:   console,
		mailhog:   mailhog,
	}
}

func (e Endpoints) Dump(out io.Writer) {
	fmt.Fprintf(out, `

URLs:
- Postgres:		%s
- GraphQL:		%s
- Auth:			%s
- Storage:		%s
- Functions:		%s

- Hasura console:	%s
- Mailhog:		%s

- subdomain:		%s
- region:		(empty)

`, e.db, e.graphql, e.auth, e.storage, e.functions, e.console, e.mailhog, "localhost")
}
