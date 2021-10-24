package hasura

type (
	//  Hasura response
	Response struct {
		Path  string `json:"path"`
		Error string `json:"error"`
		Code  string `json:"code"`
	}
)
