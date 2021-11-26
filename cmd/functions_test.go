/*
MIT License

Copyright (c) Nhost

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

package cmd

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

var tempFunctionFile *os.File

const js = "module.exports = (req, res) => { res.status(200).send(`Nhost, from Javascript, pays it's respects to ${req.query.name}!`); };"
const golang = `
package main

import (
	"fmt"
	"net/http"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	fmt.Fprintf(w, "Nhost pays it's respects to %s!", name)
}
`

var jsFunctionTest = test{
	name:      "basic javascript function",
	wantErr:   false,
	prerun:    func() error { return saveJSFunction("javascript") },
	operation: ServeFuncs,
	validator: func() error {
		return callFunction(fmt.Sprintf("http://localhost:%s/javascript", funcPort), "Nhost, from Javascript, pays it's respects to Nhost!")
	},
	postrun: func() error {
		tempFunctionFile.Close()
		util.DeleteAllPaths(tempFunctionFile.Name())
		functionServer.Shutdown(context.Background())
		return nil
	},
}

var goFunctionTest = test{
	name:      "basic golang function",
	wantErr:   false,
	prerun:    func() error { return saveGoFunction("golang") },
	operation: ServeFuncs,
	validator: func() error {
		return callFunction(fmt.Sprintf("http://localhost:%s/golang", funcPort), "Nhost pays it's respects to Nhost!")
	},
	postrun: func() error {
		tempFunctionFile.Close()
		util.DeleteAllPaths(tempFunctionFile.Name())
		functionServer.Shutdown(context.Background())
		return nil
	},
}

var unavailableStaticRouteTest = test{
	name:      "unavailable static function routes",
	wantErr:   false,
	operation: ServeFuncs,
	validator: func() error {

		if code := check200(fmt.Sprintf("http://localhost:%s/golang", funcPort)); code != http.StatusNotFound {
			return fmt.Errorf("expected %d, got: %d", http.StatusNotFound, code)
		}

		return nil
	},
	postrun: func() error {
		return functionServer.Shutdown(context.Background())
	},
}

var indexRouteTest = test{
	name:      "index function route",
	wantErr:   false,
	prerun:    func() error { return saveGoFunction("index") },
	operation: ServeFuncs,
	validator: func() error {

		if resp, err := call(fmt.Sprintf("http://localhost:%s", funcPort)); err != nil {
			fmt.Errorf("recevied: %s", resp)
			return err
		}

		return nil
	},
	postrun: func() error {
		return functionServer.Shutdown(context.Background())
	},
}

func TestFunctions(t *testing.T) {

	InitTests(t)

	nhost.API_DIR = filepath.Join(util.WORKING_DIR, "functions")
	buildDir = nhost.API_DIR

	//	Initialize a temporary directory to store test function files
	if err := os.MkdirAll(nhost.API_DIR, os.ModePerm); err != nil {
		t.Fatal(err)
	}

	tests := []test{
		goFunctionTest,
		jsFunctionTest,
		unavailableStaticRouteTest,
		indexRouteTest,
	}

	//	Run tests
	for _, tt := range tests {
		tt.run(t)
	}
}

func saveJSFunction(name string) error {

	var err error

	// Run `npm init`
	npm, err := exec.LookPath("npm")
	if err != nil {
		return err
	}

	cmd := exec.Cmd{
		Path: npm,
		Args: []string{npm, "init", "--yes"},
		Dir:  nhost.API_DIR,
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Println(string(output))
		return err
	}

	// Run `npm install`
	cmd = exec.Cmd{
		Path: npm,
		Args: []string{npm, "i"},
		Dir:  nhost.API_DIR,
	}

	output, err = cmd.CombinedOutput()
	if err != nil {
		fmt.Println(string(output))
		return err
	}

	// Run `npm install`express
	cmd = exec.Cmd{
		Path: npm,
		Args: []string{npm, "i", "express"},
		Dir:  nhost.API_DIR,
	}

	output, err = cmd.CombinedOutput()
	if err != nil {
		fmt.Println(string(output))
		return err
	}

	//	Create a test function file
	tempFunctionFile, err = os.Create(filepath.Join(nhost.API_DIR, name+".js"))
	if err != nil {
		return err
	}

	//	Write the test function file
	tempFunctionFile.WriteString(js)

	//	save the file
	return tempFunctionFile.Sync()
}

func saveGoFunction(name string) error {

	var err error

	//	Create a test function file
	tempFunctionFile, err = os.Create(filepath.Join(nhost.API_DIR, name+".go"))
	if err != nil {
		return err
	}

	//	Write the test function file
	tempFunctionFile.WriteString(golang)

	//	save the file
	return tempFunctionFile.Sync()
}

func callFunction(url, response string) error {

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	q := req.URL.Query()
	q.Add("name", "Nhost")
	req.URL.RawQuery = q.Encode()

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if !reflect.DeepEqual(body, []byte(response)) {
		return errors.New("response body does not match")
	}

	return nil
}
