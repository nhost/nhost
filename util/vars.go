package util

//  Initiaze JWT key for Hasura Authentication
//	JWT_KEY = generateRandomKey(32)
var JWT_KEY = "0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db"

const (
	API_VERSION = "v1"

	//  initiaze webhook-secret for Hasura Authentication
	WEBHOOK_SECRET = "nhost-webhook-secret"

	//  initiaze admin-secret for Hasura Authentication
	ADMIN_SECRET = "nhost-admin-secret"
)
