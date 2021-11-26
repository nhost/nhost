package proxy

import (
	"context"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProxy(t *testing.T) {

	//  Initialize a mock proxy server
	server := New(&ServerConfig{
		Port: ":5000",
	})

	//  Initialize a mock multiplexer
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	//  Initialize a mock http server
	port := "5001"
	ts := http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go ts.ListenAndServe()

	//  Register fake services
	destination := "/v1/test/"

	server.AddService(&Service{
		Name:    "test",
		Address: "http://localhost:" + port,
		Routes:  []Route{{Name: "test", Source: "/", Destination: destination}},
		Port:    port,
	})

	//  Issue Proxy
	if err := server.IssueAll(context.Background()); err != nil {
		t.Error(err)
	}

	//	Initialize fake HTTP recorder
	recorder := httptest.NewRecorder()

	//	Initialize fake HTTP request
	request, _ := http.NewRequest(http.MethodGet, "http://localhost:5000/v1/test/healthz", nil)

	//	Execute request
	server.Handler.ServeHTTP(recorder, request)

	res := recorder.Result()
	defer res.Body.Close()

	//	Check response
	if res.StatusCode != 200 {
		t.Error("Expected 200, got ", recorder.Code)
	}

	//	Check response body
	body, _ := ioutil.ReadAll(res.Body)
	if string(body) != "OK" {
		t.Error("Expected OK, got ", body)
	}

	//  Stop mock server
	ts.Shutdown(context.Background())
}
