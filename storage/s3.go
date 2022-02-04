package storage

import (
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/nhost/hasura-storage/controller"
	"github.com/sirupsen/logrus"
)

func parseS3Error(err error) *controller.APIError {
	return controller.InternalServerError(err)
}

type S3 struct {
	session    *s3.S3
	bucket     *string
	rootFolder string
	logger     *logrus.Logger
}

func NewS3(config *aws.Config, bucket string, rootFolder string, logger *logrus.Logger) (*S3, *controller.APIError) {
	session, err := session.NewSession(config)
	if err != nil {
		return nil, parseS3Error(fmt.Errorf("problem creating S3 session: %w", err))
	}

	return &S3{
		session:    s3.New(session),
		bucket:     aws.String(bucket),
		rootFolder: rootFolder,
		logger:     logger,
	}, nil
}

func (s *S3) PutFile(content io.ReadSeeker, filepath string, contentType string) (string, *controller.APIError) {
	// let's make sure we are in the beginning of the content
	if _, err := content.Seek(0, 0); err != nil {
		return "", parseS3Error(fmt.Errorf("problem going to the beginning of the content: %w", err))
	}

	object, err := s.session.PutObject(
		&s3.PutObjectInput{
			Body:        content,
			Bucket:      s.bucket,
			Key:         aws.String(s.rootFolder + "/" + filepath),
			ContentType: aws.String(contentType),
		},
	)
	if err != nil {
		return "", parseS3Error(fmt.Errorf("problem putting object: %w", err))
	}

	return *object.ETag, nil
}

func (s *S3) GetFile(filepath string) (io.ReadCloser, *controller.APIError) {
	object, err := s.session.GetObject(
		&s3.GetObjectInput{
			Bucket: s.bucket,
			Key:    aws.String(s.rootFolder + "/" + filepath),
			// IfMatch:           new(string),
			// IfModifiedSince:   &time.Time{},
			// IfNoneMatch:       new(string),
			// IfUnmodifiedSince: &time.Time{},
			// Range:             new(string),
		},
	)
	if err != nil {
		return nil, parseS3Error(fmt.Errorf("problem getting object: %w", err))
	}
	return object.Body, nil
}

func (s *S3) CreatePresignedURL(filepath string, expire time.Duration) (string, *controller.APIError) {
	request, _ := s.session.GetObjectRequest(
		&s3.GetObjectInput{ // nolint:exhaustivestruct
			Bucket: s.bucket,
			Key:    aws.String(s.rootFolder + "/" + filepath),
		},
	)
	url, err := request.Presign(expire)
	if err != nil {
		return "", parseS3Error(fmt.Errorf("problem generating pre-signed URL: %w", err))
	}

	return url, nil
}

func (s *S3) DeleteFile(filepath string) *controller.APIError {
	_, err := s.session.DeleteObject(
		&s3.DeleteObjectInput{
			Bucket: s.bucket,
			Key:    aws.String(s.rootFolder + "/" + filepath),
		})
	if err != nil {
		return parseS3Error(fmt.Errorf("problem deleting file in s3: %w", err))
	}

	return nil
}

func (s *S3) ListFiles() ([]string, *controller.APIError) {
	objects, err := s.session.ListObjects(&s3.ListObjectsInput{
		Bucket: s.bucket,
	})
	if err != nil {
		return nil, parseS3Error(fmt.Errorf("problem listing objects in s3: %w", err))
	}

	res := make([]string, len(objects.Contents))
	for i, c := range objects.Contents {
		res[i] = *c.Key
	}

	return res, nil
}
