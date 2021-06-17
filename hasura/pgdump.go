package hasura

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http"
)

type PGDumpRequest struct {
	Opts        []string `json:"opts"`
	CleanOutput bool     `json:"clean_output"`
	SourceName  string   `json:"source,omitempty"`
}

func (r *PGDumpRequest) Marshal() ([]byte, error) {
	return json.Marshal(r)
}

// fetches migrations from remote Hasura server to be applied manually
func (c *Client) PGDump(options []string) ([]byte, error) {

	var response []byte

	//Encode the data
	postBody := PGDumpRequest{
		Opts:        options,
		CleanOutput: true,
	}

	body, err := postBody.Marshal()
	if err != nil {
		return response, err
	}

	req, _ := http.NewRequest(
		http.MethodPost,
		c.Endpoint+"/v1alpha1/pg_dump",
		bytes.NewBuffer(body),
	)

	req.Header.Set("X-Hasura-Admin-Secret", c.AdminSecret)
	//req.Header.Set("X-Hasura-Role", "admin")

	client := http.Client{}

	//Leverage Go's HTTP Post function to make request
	resp, err := client.Do(req)
	if err != nil {
		return response, err
	}

	defer resp.Body.Close()

	response, err = ioutil.ReadAll(resp.Body)
	return response, err
}
