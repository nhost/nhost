package service

import (
	"fmt"
	"github.com/nhost/cli/nhost/compose"
	"io"
)

type Endpoints struct {
	db        string
	graphql   string
	auth      string
	storage   string
	functions string
	console   string
	dashboard string
	mailhog   string
}

func newEndpoints(db, graphql, auth, storage, functions, console, dashboard, mailhog string) *Endpoints {
	return &Endpoints{
		db:        db,
		graphql:   graphql,
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
- GraphQL:		%s
- Auth:			%s
- Storage:		%s
- Functions:		%s

- Nhost Dashboard:	%s
- Hasura Console:	%s
- Mailhog:		%s

- subdomain:		%s
- region:		(empty)

`, e.db, e.graphql, e.auth, e.storage, e.functions, e.dashboard, e.console, e.mailhog, compose.HostLocalDashboardNhostRun)
}
