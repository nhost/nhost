package storage

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/nhost/hasura-storage/controller"
	"github.com/sirupsen/logrus"
)

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
			fmt.Errorf("problem parsing S3 error, status code %d: %s", resp.StatusCode, b), //nolint: goerr113
		)
	}
	return controller.NewAPIError(resp.StatusCode, s3Error.Message, errors.New(s3Error.Message), nil) //nolint: goerr113
}

type S3 struct {
	client     *s3.Client
	bucket     *string
	rootFolder string
	url        string
	logger     *logrus.Logger
}

func NewS3(
	client *s3.Client, bucket string, rootFolder string, url string, disableHTTPS bool, logger *logrus.Logger,
) *S3 {
	return &S3{
		client:     client,
		bucket:     aws.String(bucket),
		rootFolder: rootFolder,
		url:        url,
		logger:     logger,
	}
}

func (s *S3) PutFile(ctx context.Context, content io.ReadSeeker, filepath string, contentType string) (string, *controller.APIError) {
	key, err := url.JoinPath(s.rootFolder, filepath)
	if err != nil {
		return "", controller.InternalServerError(fmt.Errorf("problem joining path: %w", err))
	}

	// let's make sure we are in the beginning of the content
	if _, err := content.Seek(0, 0); err != nil {
		return "", controller.InternalServerError(fmt.Errorf("problem going to the beginning of the content: %w", err))
	}

	object, err := s.client.PutObject(ctx,
		&s3.PutObjectInput{
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

func (s *S3) GetFile(ctx context.Context, filepath string, headers http.Header) (*controller.File, *controller.APIError) {
	key, err := url.JoinPath(s.rootFolder, filepath)
	if err != nil {
		return nil, controller.InternalServerError(fmt.Errorf("problem joining path: %w", err))
	}

	object, err := s.client.GetObject(ctx,
		&s3.GetObjectInput{
			Bucket: s.bucket,
			Key:    aws.String(key),
			// IfMatch:           new(string),
			// IfModifiedSince:   &time.Time{},
			// IfNoneMatch:       new(string),
			// IfUnmodifiedSince: &time.Time{},
			Range: aws.String(headers.Get("range")),
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
		ContentLength: object.ContentLength,
		Etag:          *object.ETag,
		StatusCode:    status,
		Body:          object.Body,
		ExtraHeaders:  respHeaders,
	}, nil
}

func (s *S3) CreatePresignedURL(ctx context.Context, filepath string, expire time.Duration) (string, *controller.APIError) {
	key, err := url.JoinPath(s.rootFolder, filepath)
	if err != nil {
		return "", controller.InternalServerError(fmt.Errorf("problem joining path: %w", err))
	}

	presignClient := s3.NewPresignClient(s.client)
	request, err := presignClient.PresignGetObject(ctx,
		&s3.GetObjectInput{ //nolint:exhaustivestruct
			Bucket: s.bucket,
			Key:    aws.String(key),
		},
		func(po *s3.PresignOptions) {
			po.Expires = expire
		},
	)
	if err != nil {
		return "", controller.InternalServerError(fmt.Errorf("problem generating pre-signed URL: %w", err))
	}

	parts := strings.Split(request.URL, "?")
	if len(parts) != 2 { //nolint: gomnd
		return "", controller.InternalServerError(fmt.Errorf("problem generating pre-signed URL: %w", err))
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
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, controller.InternalServerError(fmt.Errorf("problem creating request: %w", err))
	}
	req.Header = headers

	client := http.Client{}
	resp, err := client.Do(req) //nolint:bodyclose //we are actually returning the body
	if err != nil {
		return nil, controller.InternalServerError(fmt.Errorf("problem getting file: %w", err))
	}

	if !(resp.StatusCode == http.StatusOK ||
		resp.StatusCode == http.StatusPartialContent ||
		resp.StatusCode == http.StatusNotModified) {
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
			return nil, controller.InternalServerError(fmt.Errorf("problem parsing Content-Length: %w", err))
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
		&s3.DeleteObjectInput{
			Bucket: s.bucket,
			Key:    aws.String(key),
		}); err != nil {
		return controller.InternalServerError(fmt.Errorf("problem deleting file in s3: %w", err))
	}

	return nil
}

func (s *S3) ListFiles(ctx context.Context) ([]string, *controller.APIError) {
	objects, err := s.client.ListObjects(ctx,
		&s3.ListObjectsInput{
			Bucket: s.bucket,
			Prefix: aws.String(s.rootFolder + "/"),
		})
	if err != nil {
		return nil, controller.InternalServerError(fmt.Errorf("problem listing objects in s3: %w", err))
	}

	res := make([]string, len(objects.Contents))
	for i, c := range objects.Contents {
		res[i] = strings.TrimPrefix(*c.Key, s.rootFolder+"/")
	}

	return res, nil
}
