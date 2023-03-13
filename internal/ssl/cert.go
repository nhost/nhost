package ssl

import _ "embed"

//go:embed .ssl/fullchain.pem
var CertFile []byte

//go:embed .ssl/privkey.pem
var KeyFile []byte

type SSLCert struct {
	CertFile []byte
	KeyFile  []byte
}

func NewNhostSSLCert() *SSLCert {
	return &SSLCert{
		CertFile: CertFile,
		KeyFile:  KeyFile,
	}
}
