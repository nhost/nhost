package s3client

import (
	"context"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
)

type bucketCreator struct {
	c s3iface.S3API
}

func NewBucketCreator(client s3iface.S3API) *bucketCreator {
	return &bucketCreator{c: client}
}

func (b bucketCreator) EnsureBucketExists(ctx context.Context, bucket string) error {
	if _, err := b.c.CreateBucketWithContext(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(bucket),
	}); err != nil {
		if aerr, ok := err.(awserr.Error); ok {
			switch aerr.Code() {
			case s3.ErrCodeBucketAlreadyExists:
				return nil
			case s3.ErrCodeBucketAlreadyOwnedByYou:
				return nil
			default:
				return err
			}
		} else {
			return err
		}
	}

	return nil
}
