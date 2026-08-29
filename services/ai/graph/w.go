package graph

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	"github.com/gin-gonic/gin"
)

const (
	deleteEvent = "DELETE"
	insertEvent = "INSERT"
	updateEvent = "UPDATE"
)

// Files have a size limit of 512 MB.
const fileSizeLimit = 512 * 1024 * 1024

type FileMetadata interface {
	GetSize() *int64
	GetMimeType() *string
}

func isFileSupported(fm FileMetadata) bool {
	if *fm.GetSize() > int64(fileSizeLimit) {
		return false
	}

	switch *fm.GetMimeType() {
	case "text/x-c",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/json",
		"text/markdown",
		"application/pdf",
		"text/plain",
		"text/html":
		return true
	default:
		return false
	}
}

func webhookFail(
	c *gin.Context,
	status int,
	err error,
) {
	_ = c.Error(err)
	c.JSON(status, gin.H{"error": err.Error()})
}

func getUserID(headers http.Header) (*string, error) {
	authHeader, ok := headers["Authorization"]
	if ok && strings.HasPrefix(authHeader[0], "Bearer ") {
		p := jwt.NewParser()
		claims := jwt.MapClaims{}

		_, _, err := p.ParseUnverified(authHeader[0][7:], claims)
		if err != nil {
			return nil, fmt.Errorf("error parsing jwt: %w", err)
		}

		claims, ok := claims["https://hasura.io/jwt/claims"].(map[string]any)
		if !ok {
			return nil, errors.New("error parsing jwt claims") //nolint:err113
		}

		userID, ok := claims["x-hasura-user-id"].(string)
		if !ok {
			return nil, errors.New("wrong user id type") //nolint:err113
		}

		return &userID, nil
	}

	if headers.Get("X-Hasura-User-Id") != "" {
		return new(headers.Get("X-Hasura-User-Id")), nil
	}

	return nil, nil //nolint:nilnil
}
