package fastly

/*
To create a key for your service suitable for storage:

curl -D - -X POST --location "https://api.fastly.com/tokens" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name":"storage-purge-key","username":"me@example.com",\
        "password":"superDuperSecret","scope":"purge_select","services":["SERVICE_ID"]}'
*/

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const (
	headerToRemoveCacheControl = "X-Remove-Cache-Control-If-Not-Modified"
	fileChangedContextKey      = "middleware.cdn.file_changed"
)

type fastly struct {
	serviceID string
	apiKey    string
}

func FileChangedToContext(ctx context.Context, id string) {
	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		return
	}

	ginCtx.Set(fileChangedContextKey, id)
}

func (fst *fastly) purge(ctx context.Context, key string) error {
	client := &http.Client{} //nolint:exhaustruct

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("https://api.fastly.com/service/%s/purge/%s", fst.serviceID, key),
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to create purge request: %w", err)
	}

	req.Header.Set("Fastly-Key", fst.apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to purge: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to purge: %s", resp.Status) //nolint: err113
	}

	return nil
}

func New(serviceID string, apiKey string, logger *logrus.Logger) gin.HandlerFunc {
	fst := &fastly{serviceID, apiKey}

	return func(ctx *gin.Context) {
		// before request
		ctx.Next()

		// after request
		if ctx.Writer.Status() == http.StatusNotModified &&
			ctx.Request.Header.Get(headerToRemoveCacheControl) == "true" {
			// cache control should be sent in a 304 but
			// due to a series of unfortunate events at Fastly we need to hide it:
			// 1. fastly ignores no-cache
			// 2. you can emulate behavior by setting ttl=0 in vcl_fetch
			// 3. when Fastly does a revalidation it doesn;t run vcl_fetch if it succeeds but
			//    it does set ttl to max-age breaking the emulated no-cache behavior :facepalm:
			ctx.Writer.Header().Del("Cache-Control")
			ctx.Writer.Header().Del("Surrogate-Control")
		}

		if id := ctx.GetString(fileChangedContextKey); id != "" {
			logger.WithField("key", id).Debug("purging file from cdn")

			if err := fst.purge(ctx, id); err != nil {
				logger.WithField("key", id).WithError(err).Error("failed to purge file from cdn")
			}
		}
	}
}
