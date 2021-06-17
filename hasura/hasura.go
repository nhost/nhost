package hasura

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"runtime"
	"strings"

	log "github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"

	"github.com/mrinalwahal/cli/nhost"
)

// initialize the binary path
var binaryPath = path.Join(nhost.ROOT, "hasura")

// if the required binary exists in $HOME/.nhost
// this function returns it's exact path
// and if the binary doesn't exist,
// it downloads it from specifically supplied URL
// based on user's OS and ARCH
func Binary() (string, error) {

	var url string

	binary := "hasura"

	nhostConfig, err := nhost.Config()
	if err != nil {
		return url, err
	}

	version := nhostConfig.Environment["hasura_cli_version"]

	url = fmt.Sprintf("https://github.com/hasura/graphql-engine/releases/download/%v/cli-hasura-%v-%v", version, runtime.GOOS, runtime.GOARCH)

	// search for installed binary
	if pathExists(binaryPath) {
		return binaryPath, nil
	}

	// create the binary path
	out, err := os.Create(binaryPath)
	if err != nil {
		return "", err
	}

	defer out.Close()

	// update binary download URL depending upon the OS
	if runtime.GOOS == "windows" {
		url += ".exe"
	}

	log.WithField("component", fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH)).Infof("Downloading %s binary", binary)

	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	log.WithField("component", fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH)).Debugf("Writing %s binary", binary)

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return "", err
	}

	// Change permissions so that the download file
	// can become accessible and executable
	err = os.Chmod(binaryPath, 0777)

	if err != nil {
		return "", err
	}

	//return the path at which binary has been
	// downloaded and saved
	return binaryPath, nil
}

// validates whether a given folder/file path exists or not
func pathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

func (c *Client) GetSchemas() ([]string, error) {

	log.Debug("Fetching schema list")

	var response []string

	//Encode the data
	reqBody := RequestBody{
		Type: "run_sql",
		Args: map[string]string{
			"sql": "SELECT schema_name FROM information_schema.schemata;",
		},
	}
	body, err := reqBody.Marshal()
	if err != nil {
		return response, err
	}

	resp, err := c.Request(body)
	if err != nil {
		return response, err
	}

	defer resp.Body.Close()

	body, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return response, err
	}

	var responseData map[string]interface{}
	json.Unmarshal(body, &responseData)

	// Remove the first row/head and filter schemas from following rows
	// Following is a sample result:
	// From the list: [schema_name] [pg_toast] [pg_temp_1] [pg_toast_temp_1] [pg_catalog] [public] [information_schema] [hdb_catalog] [hdb_views] [auth]
	// Only output: [public]
	result := responseData["result"].([]interface{})[1:]

	schemasToBeExcluded := []string{"information_schema", "auth", "storage"}

	for _, value := range result {

		parsedValue := value.([]interface{})[0].(string)

		if !strings.Contains(parsedValue, "pg_") &&
			!strings.Contains(parsedValue, "hdb_") &&
			!contains(schemasToBeExcluded, parsedValue) {
			response = append(response, value.([]interface{})[0].(string))
		}
	}

	return response, nil
}

func (c *Client) GetMetadata() (HasuraMetadataV2, error) {

	log.Debug("Fetching metadata")

	var response HasuraMetadataV2

	reqBody := RequestBody{
		Type: "export_metadata",
		Args: map[string]string{},
	}
	body, err := reqBody.Marshal()
	if err != nil {
		return response, err
	}

	resp, err := c.Request(body)
	if err != nil {
		return response, err
	}
	defer resp.Body.Close()

	body, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return response, err
	}

	return UnmarshalHasuraMetadataV2(body)
}

func (c *Client) ClearMigration() error {

	log.Debug("Clearing Migration")

	reqBody := RequestBody{
		Type: "run_sql",
		Args: map[string]string{
			"sql": "TRUNCATE hdb_catalog.schema_migrations;",
		},
	}
	body, err := reqBody.Marshal()
	if err != nil {
		return err
	}

	resp, err := c.Request(body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return errors.New("failed to clear migration")
	}

	return nil
}

func (c *Client) GetExtensions() ([]string, error) {

	log.Debug("Fetching extensions")

	var response []string

	//Encode the data
	reqBody := RequestBody{
		Type: "run_sql",
		Args: map[string]string{
			"sql": "SELECT * FROM pg_extension;",
		},
	}
	body, err := reqBody.Marshal()
	if err != nil {
		return response, err
	}

	resp, err := c.Request(body)
	if err != nil {
		return response, err
	}
	defer resp.Body.Close()

	body, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return response, err
	}

	var responseData map[string]interface{}
	json.Unmarshal(body, &responseData)

	// Remove the first row/head and filter extensions from following rows
	// Following is a sample result:
	// [plpgsql pgcrypto citext]
	result := responseData["result"].([]interface{})[1:]

	// convert from []interface{} to []string before returning
	for _, value := range result {
		enumerable_value := value.([]interface{})
		for index, ext := range enumerable_value {
			if index == 1 {
				response = append(response, fmt.Sprint(ext))
			}
		}
	}

	return response, nil
}

/*
func (c *ClientCommonMetadataOps) ClearMetadata() (io.Reader, error) {
	request := hasura.RequestBody{
		Type: "clear_metadata",
		Args: map[string]string{},
	}
	responseBody := new(bytes.Buffer)
	response, err := c.send(request, responseBody)
	if err != nil {
		return nil, err
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s", responseBody.String())
	}
	return responseBody, nil
}

func (c *ClientCommonMetadataOps) ReloadMetadata() (metadata io.Reader, err error) {
	request := hasura.RequestBody{
		Type: "reload_metadata",
		Args: map[string]string{},
	}
	responseBody := new(bytes.Buffer)
	response, err := c.send(request, responseBody)
	if err != nil {
		return nil, err
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s", responseBody.String())
	}
	return responseBody, nil
}

func (c *ClientCommonMetadataOps) DropInconsistentMetadata() (metadata io.Reader, err error) {
	request := hasura.RequestBody{
		Type: "drop_inconsistent_metadata",
		Args: map[string]string{},
	}
	responseBody := new(bytes.Buffer)
	response, err := c.send(request, responseBody)
	if err != nil {
		return nil, err
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s", responseBody.String())
	}
	return responseBody, nil
}

func (c *ClientCommonMetadataOps) ReplaceMetadata(metadata io.Reader) (io.Reader, error) {
	var body interface{}
	if err := json.NewDecoder(metadata).Decode(&body); err != nil {
		return nil, fmt.Errorf("decoding json: %w", err)
	}
	request := hasura.RequestBody{
		Type: "replace_metadata",
		Args: body,
	}
	responseBody := new(bytes.Buffer)
	response, err := c.send(request, responseBody)
	if err != nil {
		return nil, err
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s", responseBody.String())
	}
	return responseBody, nil
}

func (c *ClientCommonMetadataOps) GetInconsistentMetadata() (*hasura.GetInconsistentMetadataResponse, error) {
	request := hasura.RequestBody{
		Type: "get_inconsistent_metadata",
		Args: map[string]string{},
	}
	responseBody := new(bytes.Buffer)
	response, err := c.send(request, responseBody)
	if err != nil {
		return nil, err
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s", responseBody.String())
	}
	inconsistentMetadata := new(hasura.GetInconsistentMetadataResponse)
	if err := json.NewDecoder(responseBody).Decode(inconsistentMetadata); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}
	return inconsistentMetadata, nil
}

func (c *ClientCommonMetadataOps) GetInconsistentMetadataReader() (io.Reader, error) {
	request := hasura.RequestBody{
		Type: "get_inconsistent_metadata",
		Args: map[string]string{},
	}
	responseBody := new(bytes.Buffer)
	response, err := c.send(request, responseBody)
	if err != nil {
		return nil, err
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s", responseBody.String())
	}
	return responseBody, nil
}
*/

func (c *Client) Migration(options []string) ([]byte, error) {

	pgDumpOpts := []string{"-x", "-O", "--inserts"}
	pgDumpOpts = append(pgDumpOpts, options...)

	return c.PGDump(pgDumpOpts)
}

func (c *Client) Seeds(tables []TableEntry) ([]byte, error) {

	pgDumpOpts := []string{"--no-owner", "--no-acl", "--data-only", "--column-inserts"}
	for _, table := range tables {
		pgDumpOpts = append(pgDumpOpts, "--table", table.Table.Schema+"."+table.Table.Name)
	}

	return c.PGDump(pgDumpOpts)
}

func GetTablesFromLocalMetadata() ([]TableEntry, error) {

	var response []TableEntry

	data, err := os.ReadFile(path.Join(nhost.METADATA_DIR, "tables.yaml"))
	if err != nil {
		return response, err
	}

	if err = yaml.Unmarshal(data, &response); err != nil {
		return response, err
	}

	return response, nil
}

// check whether source array contains value or not
func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}
