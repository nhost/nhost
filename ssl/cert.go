package ssl

import _ "embed"

//go:embed .ssl/fullchain.pem
var CertFile []byte

//go:embed .ssl/privkey.pem
var KeyFile []byte
