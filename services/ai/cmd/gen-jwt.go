package cmd

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/urfave/cli/v2"
)

const (
	flagJWTSecret = "jwt-secret"
)

func CommandJWTGen() *cli.Command {
	return &cli.Command{ //nolint: exhaustruct
		Name:   "jwt-gen",
		Hidden: true,
		Usage:  "Generate JWT token for dev purposes",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint: exhaustruct
				Name:    flagJWTSecret,
				Usage:   "JWT Secret",
				Value:   "",
				EnvVars: []string{"JWT_SECRET"},
			},
		},
		Action: jwtGenAction,
	}
}

type jwtSecret struct {
	Key    string `json:"key"`
	Method string `json:"method"`
}

func jwtGenAction(c *cli.Context) error {
	jwtSecret := jwtSecret{
		Key:    c.String(flagJWTSecret),
		Method: "HS256",
	}

	// output of
	mySigningKey := []byte(jwtSecret.Key)

	now := time.Now()
	iat := now.Unix()
	exp := now.Add(24 * 365 * 10 * time.Hour).Unix()

	// Create the Claims
	claims := &jwt.MapClaims{
		"sub": "ab5ba58e-932a-40dc-87e8-733998794ec2",
		"iss": "hasura-auth",
		"iat": iat,
		"exp": exp,
		"https://hasura.io/jwt/claims": map[string]any{
			"x-hasura-allowed-roles": []string{
				"admin",
				"user",
				"project_manager",
				"anonymous",
			},
			"x-hasura-default-role":     "user",
			"x-hasura-user-id":          "ab5ba58e-932a-40dc-87e8-733998794ec2",
			"x-hasura-user-isAnonymous": "false",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	ss, err := token.SignedString(mySigningKey)
	if err != nil {
		panic(err)
	}

	fmt.Print(ss) //nolint:forbidigo

	return nil
}
