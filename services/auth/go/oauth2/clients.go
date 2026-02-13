package oauth2

import "github.com/google/uuid"

func GenerateClientID() string {
	return "nhoa_" + HashToken(uuid.NewString())[:16]
}
