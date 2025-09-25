package ssl

import _ "embed"

//go:embed .ssl/local-fullchain.pem
var LocalCertFile []byte

//go:embed .ssl/local-privkey.pem
var LocalKeyFile []byte

//go:embed .ssl/sub-fullchain.pem
var SubCertFile []byte

//go:embed .ssl/sub-privkey.pem
var SubKeyFile []byte
