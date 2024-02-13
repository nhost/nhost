package nhcontext

import "errors"

var ErrWrongTypeHTTPHeader = errors.New("wrong type for http header, must be a map[string]string")
