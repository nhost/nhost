package storage

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/nhost/nhost/services/storage/controller"
)

func deptr[T any](p *T) T { //nolint:ireturn
	if p == nil {
		return *new(T)
	}

	return *p
}

type S3Error struct {
	Code    string `xml:"Code"`
	Message string `xml:"Message"`
}

func parseS3Error(resp *http.Response) *controller.APIError {
	var s3Error S3Error
	if err := xml.NewDecoder(resp.Body).Decode(&s3Error); err != nil {
		b, err := io.ReadAll(resp.Body)
		if err != nil {
			return controller.InternalServerError(
				fmt.Errorf("problem reading S3 error, status code %d: %w", resp.StatusCode, err),
			)
		}

		return controller.InternalServerError(
			fmt.Errorf( //nolint: err113
				"problem parsing S3 error, status code %d: %s",
				resp.StatusCode,
				b,
			),
		)
	}

	return controller.NewAPIError(
		resp.StatusCode,
		s3Error.Message,
		errors.New(s3Error.Message), //nolint: err113
		nil,
	)
}

// ObjectAPI is the subset of *s3.Client used by S3. Defining it as an interface
// lets ListFiles be unit-tested with a generated mock, without a live S3.
//
//go:generate mockgen -package mock -destination mock/object_api.go . ObjectAPI
type ObjectAPI interface {
	ListObjectsV2(
		ctx context.Context, params *s3.ListObjectsV2Input, optFns ...func(*s3.Options),
	) (*s3.ListObjectsV2Output, error)
	PutObject(
		ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options),
	) (*s3.PutObjectOutput, error)
	GetObject(
		ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options),
	) (*s3.GetObjectOutput, error)
	DeleteObject(
		ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options),
	) (*s3.DeleteObjectOutput, error)
}

type S3 struct {
	client        ObjectAPI
	presignClient *s3.PresignClient
	bucket        *string
	rootFolder    string
	url           string
	logger        *slog.Logger
}

func NewS3(
	client *s3.Client,
	bucket string,
	rootFolder string,
	url string,
	logger *slog.Logger,
) *S3 {
	return &S3{
		client:        client,
		presignClient: s3.NewPresignClient(client),
		bucket:        aws.String(bucket),
		rootFolder:    rootFolder,
		url:           url,
		logger:        logger,
	}
}

func (s *S3) PutFile(
	ctx context.Context,
	content io.ReadSeeker,
	filepath string,
	contentType string,
) (string, *controller.APIError) {
	key, err := url.JoinPath(s.rootFolder, filepath)
	if err != nil {
		return "", controller.InternalServerError(fmt.Errorf("problem joining path: %w", err))
	}

	// let's make sure we are in the beginning of the content
	if _, err := content.Seek(0, 0); err != nil {
		return "", controller.InternalServerError(
			fmt.Errorf("problem going to the beginning of the content: %w", err),
		)
	}

	object, err := s.client.PutObject(
		ctx,
		&s3.PutObjectInput{ //nolint:exhaustruct
			Body:        content,
			Bucket:      s.bucket,
			Key:         aws.String(key),
			ContentType: aws.String(contentType),
		},
	)
	if err != nil {
		return "", controller.InternalServerError(fmt.Errorf("problem putting object: %w", err))
	}

	return *object.ETag, nil
}

func (s *S3) GetFile(
	ctx context.Context,
	filepath string,
	downloadRange *string,
) (*controller.File, *controller.APIError) {
	key, err := url.JoinPath(s.rootFolder, filepath)
	if err != nil {
		return nil, controller.InternalServerError(fmt.Errorf("problem joining path: %w", err))
	}

	object, err := s.client.GetObject(
		ctx,
		&s3.GetObjectInput{ //nolint:exhaustruct
			Bucket: s.bucket,
			Key:    aws.String(key),
			// IfMatch:           new(string),
			// IfModifiedSince:   &time.Time{},
			// IfNoneMatch:       new(string),
			// IfUnmodifiedSince: &time.Time{},
			Range: downloadRange,
		},
	)
	if err != nil {
		return nil, controller.InternalServerError(fmt.Errorf("problem getting object: %w", err))
	}

	status := http.StatusOK

	respHeaders := make(http.Header)
	if object.ContentRange != nil {
		respHeaders = http.Header{
			"Accept-Ranges": []string{"bytes"},
		}
		respHeaders["Content-Range"] = []string{*object.ContentRange}
		status = http.StatusPartialContent
	}

	return &controller.File{
		ContentType:   *object.ContentType,
		ContentLength: deptr(object.ContentLength),
		Etag:          *object.ETag,
		StatusCode:    status,
		Body:          object.Body,
		ExtraHeaders:  respHeaders,
	}, nil
}

func (s *S3) CreatePresignedURL(
	ctx context.Context,
	filepath string,
	expire time.Duration,
) (string, *controller.APIError) {
	key, err := url.JoinPath(s.rootFolder, filepath)
	if err != nil {
		return "", controller.InternalServerError(fmt.Errorf("problem joining path: %w", err))
	}

	request, err := s.presignClient.PresignGetObject(
		ctx,
		&s3.GetObjectInput{ //nolint:exhaustruct
			Bucket: s.bucket,
			Key:    aws.String(key),
		},
		func(po *s3.PresignOptions) {
			po.Expires = expire
		},
	)
	if err != nil {
		return "", controller.InternalServerError(
			fmt.Errorf("problem generating pre-signed URL: %w", err),
		)
	}

	parts := strings.Split(request.URL, "?")
	if len(parts) != 2 { //nolint: mnd
		return "", controller.InternalServerError(
			fmt.Errorf("problem generating pre-signed URL: %w", err),
		)
	}

	return parts[1], nil
}

func (s *S3) GetFileWithPresignedURL(
	ctx context.Context, filepath, signature string, headers http.Header,
) (*controller.File, *controller.APIError) {
	if s.rootFolder != "" {
		filepath = s.rootFolder + "/" + filepath
	}

	url := fmt.Sprintf("%s/%s/%s?%s", s.url, *s.bucket, filepath, signature)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, controller.InternalServerError(fmt.Errorf("problem creating request: %w", err))
	}

	req.Header = headers

	client := http.Client{} //nolint:exhaustruct

	resp, err := client.Do(req) //nolint:bodyclose //we are actually returning the body
	if err != nil {
		return nil, controller.InternalServerError(fmt.Errorf("problem getting file: %w", err))
	}

	if resp.StatusCode != http.StatusOK &&
		resp.StatusCode != http.StatusPartialContent &&
		resp.StatusCode != http.StatusNotModified {
		return nil, parseS3Error(resp)
	}

	respHeaders := make(http.Header)

	var length int64

	switch resp.StatusCode {
	case http.StatusOK, http.StatusPartialContent:
		respHeaders = http.Header{
			"Accept-Ranges": []string{"bytes"},
		}
		if resp.StatusCode == http.StatusPartialContent {
			respHeaders["Content-Range"] = []string{resp.Header.Get("Content-Range")}
		}

		length, err = strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 32)
		if err != nil {
			return nil, controller.InternalServerError(
				fmt.Errorf("problem parsing Content-Length: %w", err),
			)
		}
	}

	return &controller.File{
		ContentType:   resp.Header.Get("Content-Type"),
		ContentLength: length,
		Etag:          resp.Header.Get("Etag"),
		StatusCode:    resp.StatusCode,
		Body:          resp.Body,
		ExtraHeaders:  respHeaders,
	}, nil
}

func (s *S3) DeleteFile(ctx context.Context, filepath string) *controller.APIError {
	key, err := url.JoinPath(s.rootFolder, filepath)
	if err != nil {
		return controller.InternalServerError(fmt.Errorf("problem joining path: %w", err))
	}

	if _, err := s.client.DeleteObject(ctx,
		&s3.DeleteObjectInput{ //nolint:exhaustruct
			Bucket: s.bucket,
			Key:    aws.String(key),
		}); err != nil {
		return controller.InternalServerError(fmt.Errorf("problem deleting file in s3: %w", err))
	}

	return nil
}

func (s *S3) ListFiles(ctx context.Context) ([]string, *controller.APIError) {
	// An empty rootFolder must not become a "/" prefix: objects are stored
	// without a leading slash, so a "/" prefix would match nothing.
	prefix := ""
	if s.rootFolder != "" {
		prefix = s.rootFolder + "/"
	}

	// ListObjectsV2 returns at most 1000 keys per call. Without pagination any
	// bucket with more than 1000 objects would be silently truncated, which
	// makes reconciliation (e.g. broken metadata detection) report files that
	// do exist as missing.
	paginator := s3.NewListObjectsV2Paginator(
		s.client,
		&s3.ListObjectsV2Input{ //nolint:exhaustruct
			Bucket: s.bucket,
			Prefix: aws.String(prefix),
		},
	)

	res := make([]string, 0)

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, controller.InternalServerError(
				fmt.Errorf("problem listing objects in s3: %w", err),
			)
		}

		for _, c := range page.Contents {
			res = append(res, strings.TrimPrefix(*c.Key, prefix))
		}
	}

	return res, nil
}
