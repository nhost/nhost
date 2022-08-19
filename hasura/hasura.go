package hasura

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/hashicorp/go-version"
	"github.com/nhost/cli/nhost/compose"
	"github.com/sirupsen/logrus"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"gopkg.in/yaml.v2"

	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

//  initialize the binary path
var status = &util.Writer
var log = &logger.Log

func getBinary() string {
	switch runtime.GOOS {
	case "windows":
		return filepath.Join(nhost.ROOT, "hasura.exe")
	default:
		return filepath.Join(nhost.ROOT, "hasura")
	}
}

func cliIsOutdated(existingCliPath, expectedVersion string) (bool, error) {
	expected, err := version.NewVersion(expectedVersion)
	if err != nil {
		return false, err
	}

	type hasuraVersion struct {
		Version string `json:"version"`
	}

	// get a version of the existing CLI
	cmd := exec.Command(existingCliPath, "version", "--skip-update-check")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return false, err
	}

	var hv hasuraVersion
	if err = json.Unmarshal(out, &hv); err != nil {
		return false, err
	}

	existing, err := version.NewVersion(hv.Version)
	if err != nil {
		return false, err
	}

	return existing.LessThan(expected), nil
}

//  if the required binary exists in $HOME/.nhost
//  this function returns it's exact path
//  and if the binary doesn't exist,
//  it downloads it from specifically supplied URL
//  based on user's OS and ARCH
func Binary() (string, error) {
	cliVersion, err := compose.HasuraCliVersion()
	if err != nil {
		return "", err
	}

	binaryPath := getBinary()

	//  search for installed binary
	if pathExists(binaryPath) {
		outdated, err := cliIsOutdated(binaryPath, cliVersion)
		if err != nil {
			return "", err
		}

		if !outdated {
			return binaryPath, nil
		}
	}

	var url string

	binary := "hasura"

	log.WithFields(logrus.Fields{
		"type":    binary,
		"version": cliVersion,
	}).Debug("Fetching binary")

	//	Use AMD architecture instead of ARM
	architecture := runtime.GOARCH
	if strings.Contains(architecture, "arm") {
		architecture = strings.ReplaceAll(architecture, "arm", "amd")
	}

	url = fmt.Sprintf("https://github.com/hasura/graphql-engine/releases/download/%v/cli-hasura-%v-%v", cliVersion, runtime.GOOS, architecture)

	//  create the binary path
	if err := os.MkdirAll(nhost.ROOT, os.ModePerm); err != nil {
		return "", err
	}

	out, err := os.Create(binaryPath)
	if err != nil {
		return "", err
	}

	defer out.Close()

	//  update binary download URL depending upon the OS
	if runtime.GOOS == "windows" {
		url += ".exe"
	}

	status.Executing(fmt.Sprintf("Downloading %s binary for %s-%s", binary, runtime.GOOS, runtime.GOARCH))

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

	//  Change permissions so that the download file
	//  can become accessible and executable
	err = os.Chmod(binaryPath, 0777)

	if err != nil {
		return "", err
	}

	//return the path at which binary has been
	//  downloaded and saved
	return binaryPath, nil
}

//  validates whether a given folder/file path exists or not
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

	resp, err := c.Request(body, "/v2/query")
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

	//  Remove the first row/head and filter schemas from following rows
	//  Following is a sample result:
	//  From the list: [schema_name] [pg_toast] [pg_temp_1] [pg_toast_temp_1] [pg_catalog] [public] [information_schema] [hdb_catalog] [hdb_views] [auth]
	//  Only output: [public]
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

func (c *Client) GetMetadata() (*MetadataV3, error) {

	log.Debug("Fetching metadata")

	reqBody := RequestBody{
		Type:    "export_metadata",
		Version: 2,
	}
	body, err := reqBody.Marshal()
	if err != nil {
		return nil, err
	}

	resp, err := c.Request(body, "/v1/metadata")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var responseData struct {
		Metadata MetadataV3 `json:"metadata"`
	}
	if err = json.Unmarshal(body, &responseData); err != nil {
		return nil, err
	}

	return &responseData.Metadata, nil
}

func (c *Client) GetInconsistentMetadata() (InconsistentMetadataResponse, error) {

	log.Debug("Fetching inconsistent metadata")

	var response InconsistentMetadataResponse

	reqBody := RequestBody{
		Type: "get_inconsistent_metadata",
	}

	body, err := reqBody.Marshal()
	if err != nil {
		return response, err
	}

	resp, err := c.Request(body, "/v1/metadata")
	if err != nil {
		return response, err
	}
	defer resp.Body.Close()

	body, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return response, err
	}

	err = json.Unmarshal(body, &response)
	return response, err
}

func (c *Client) Seed(payload string) error {

	reqBody := RequestBody{
		Type: "run_sql",
		Args: map[string]string{
			"source": nhost.DATABASE,
			"sql":    payload,
		},
	}

	body, err := reqBody.Marshal()
	if err != nil {
		return err
	}

	resp, err := c.Request(body, "/v2/query")
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	response, _ := ioutil.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return errors.New(string(response))
	}

	return nil
}

func (c *Client) ClearMigration(source string) error {

	log.Debug("Clearing migration")

	args := []string{c.CLI,
		"migrate",
		"delete",
		"--all",
		"--server",
		"--endpoint",
		c.Endpoint,
		"--admin-secret",
		c.AdminSecret,
		"--database-name",
		source,
		"--skip-update-check",
		"--force",
	}

	execute := exec.Cmd{
		Path: c.CLI,
		Args: args,
		Dir:  nhost.NHOST_DIR,
	}
	output, err := execute.CombinedOutput()
	if err != nil {
		log.Debug(string(output))
		return err
	}

	/* 	reqBody := RequestBody{
	   		Type: "run_sql",
	   		Args: map[string]string{
	   			"source": source,
	   			"sql":    "TRUNCATE hdb_catalog.schema_migrations;",
	   		},
	   	}

	   	body, err := reqBody.Marshal()
	   	if err != nil {
	   		return err
	   	}

	   	resp, err := c.Request(body, "/v2/query")
	   	if err != nil {
	   		return err
	   	}

	   	if resp.StatusCode != http.StatusOK {
	   		return errors.New("failed to clear migration")
	   	}
	*/
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

	resp, err := c.Request(body, "/v1/query")
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

	//  Remove the first row/head and filter extensions from following rows
	//  Following is a sample result:
	//  [plpgsql pgcrypto citext]
	result := responseData["result"].([]interface{})[1:]

	//  convert from []interface{} to []string before returning
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

func (c *Client) Track(table TableEntry) error {

	log.WithFields(logrus.Fields{
		"component": table.Table.Name,
		"value":     table.Table.Schema,
	}).Debug("Tracking table")

	//Encode the data
	args := map[string]interface{}{
		"schema": table.Table.Schema,
		"name":   table.Table.Name,
	}

	if table.IsEnum != nil {
		args["is_enum"] = true
	}

	//Encode the data
	reqBody := RequestBody{
		Type: "track_table",
		Args: args,
	}
	marshalledBody, err := reqBody.Marshal()
	if err != nil {
		return err
	}

	resp, err := c.Request(marshalledBody, "/v1/query")
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var response Response
	json.Unmarshal(body, &response)

	if response.Code == "already-tracked" {
		log.WithField("component", table.Table.Name).Debug("Table is already tracked")
		return nil
	}

	return errors.New(response.Error)
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

	log.Debug("Performing migration")

	pgDumpOpts := []string{"-x", "-O", "--schema-only"}
	pgDumpOpts = append(pgDumpOpts, options...)

	return c.PGDump(pgDumpOpts)
}

func (c *Client) ApplySeeds(tables []TableEntry) ([]byte, error) {

	log.Debug("Applying seeds")

	pgDumpOpts := []string{"--no-owner", "--no-acl", "--data-only", "--column-inserts"}
	for _, table := range tables {
		pgDumpOpts = append(pgDumpOpts, "--table", table.Table.Schema+"."+table.Table.Name)
	}

	return c.PGDump(pgDumpOpts)
}

func GetTablesFromLocalMetadata() ([]TableEntry, error) {

	log.Debug("Fetching tables from local metadata")

	var response []TableEntry

	data, err := os.ReadFile(filepath.Join(nhost.METADATA_DIR, "tables.yaml"))
	if err != nil {
		return response, err
	}

	if err = yaml.Unmarshal(data, &response); err != nil {
		return response, err
	}

	return response, nil
}

//  check whether source array contains value or not
func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}
