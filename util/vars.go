package util

import (
	"fmt"
)

var (

	//  Initiaze JWT key for Hasura Authentication
	//	JWT_KEY = generateRandomKey(32)
	JWT_KEY = []byte("0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db")

	//	Map of environment specific variables generated dynamically on runtime.
	RUNTIME_VARS = map[string]interface{}{
		"HASURA_GRAPHQL_JWT_SECRET":   fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, JWT_KEY),
		"NHOST_JWT_SECRET":            fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, JWT_KEY),
		"HASURA_GRAPHQL_ADMIN_SECRET": ADMIN_SECRET,
		"NHOST_ADMIN_SECRET":          ADMIN_SECRET,
		"NHOST_WEBHOOK_SECRET":        WEBHOOK_SECRET,
	}
)

const (
	API_VERSION = "v1"

	//  initiaze webhook-secret for Hasura Authentication
	WEBHOOK_SECRET = "nhost-webhook-secret"

	//  initiaze admin-secret for Hasura Authentication
	ADMIN_SECRET = "nhost-admin-secret"
)
