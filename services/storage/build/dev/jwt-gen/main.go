package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"time"

	"github.com/dgrijalva/jwt-go/v4"
)

type jwtSecret struct {
	Key    string `json:"key"`
	Method string `json:"method"`
}

func main() {
	// docker-compose -f build/dev/docker/docker-compose.yaml exec graphql-engine bash -c 'echo "$HASURA_GRAPHQL_JWT_SECRET" | cut -d\" -f8'
	jwtSecretF := flag.String("jwt-secret", "", "JWT secret")
	flag.Parse()

	jSecret := jwtSecret{}
	if err := json.Unmarshal([]byte(*jwtSecretF), &jSecret); err != nil {
		panic(err)
	}

	// output of
	mySigningKey := []byte(jSecret.Key)

	now := time.Now()
	iat := now.Unix()
	exp := now.Add(24 * 365 * 10 * time.Hour).Unix()

	// Create the Claims
	claims := &jwt.MapClaims{
		"sub": "ab5ba58e-932a-40dc-87e8-733998794ec2",
		"iss": "hasura-auth",
		"iat": iat,
		"exp": exp,
		"https://hasura.io/jwt/claims": map[string]interface{}{
			"x-hasura-allowed-roles": []string{
				"admin",
			},
			"x-hasura-default-role":     "admin",
			"x-hasura-user-id":          "ab5ba58e-932a-40dc-87e8-733998794ec2",
			"x-hasura-user-isAnonymous": "false",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	ss, err := token.SignedString(mySigningKey)
	if err != nil {
		panic(err)
	}
	fmt.Print(ss)
}
