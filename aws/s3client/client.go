package s3client

import (
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/nhost/cli/nhost/compose"
)

func NewForMinio(user, password string, port uint32) (*s3.S3, error) {
	conf := &aws.Config{
		Credentials:      credentials.NewStaticCredentials(user, password, ""),
		Endpoint:         aws.String(compose.MinioHostname(port)),
		Region:           aws.String("us-east-1"),
		DisableSSL:       aws.Bool(true),
		S3ForcePathStyle: aws.Bool(true),
	}

	newSession, err := session.NewSession(conf)
	if err != nil {
		return nil, err
	}

	return s3.New(newSession), nil
}
