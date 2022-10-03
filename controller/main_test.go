package controller_test

import (
	"fmt"
	"io"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/hasura-storage/controller"
	"github.com/sirupsen/logrus"
)

type readerMatcher struct {
	v string
}

func (m readerMatcher) Matches(x interface{}) bool {
	reader, ok := x.(io.ReadSeeker)
	if !ok {
		return false
	}

	if _, err := reader.Seek(0, 0); err != nil {
		panic(err)
	}

	b, err := io.ReadAll(reader)
	if err != nil {
		panic(err)
	}

	return string(b) == m.v
}

func (m readerMatcher) String() string {
	return m.v
}

func ReaderMatcher(v string) gomock.Matcher {
	return readerMatcher{v}
}

type fileMetadataMatcher struct {
	v controller.FileMetadata
}

func (m fileMetadataMatcher) Matches(x interface{}) bool {
	return cmp.Equal(m.v, x, cmpopts.IgnoreFields(controller.FileMetadata{}, "CreatedAt", "UpdatedAt"))
}

func (m fileMetadataMatcher) String() string {
	return fmt.Sprintf("%v", m.v)
}

func FileMetadataMatcher(v controller.FileMetadata) gomock.Matcher {
	return fileMetadataMatcher{v}
}

func ginLogger(logger *logrus.Logger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()

		ctx.Next()

		endTime := time.Now()

		latencyTime := endTime.Sub(startTime)
		reqMethod := ctx.Request.Method
		reqURL := ctx.Request.RequestURI
		statusCode := ctx.Writer.Status()
		clientIP := ctx.ClientIP()

		fields := logrus.Fields{
			"status_code":  statusCode,
			"latency_time": latencyTime,
			"client_ip":    clientIP,
			"method":       reqMethod,
			"url":          reqURL,
			"errors":       ctx.Errors.Errors(),
		}

		if len(ctx.Errors.Errors()) > 0 {
			logger.WithFields(fields).Error("call completed with some errors")
		} else {
			logger.WithFields(fields).Info()
		}
	}
}

func assert(t *testing.T, got, wanted interface{}, opts ...cmp.Option) {
	t.Helper()

	if !cmp.Equal(got, wanted, opts...) {
		t.Error(cmp.Diff(got, wanted, opts...))
	}
}
