package sms

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

func jsonEqual(t *testing.T, expected, actual string) bool {
	t.Helper()
	var expObj, actObj any
	if err := json.Unmarshal([]byte(expected), &expObj); err != nil {
		t.Fatalf("failed to unmarshal expected JSON: %v", err)
	}
	if err := json.Unmarshal([]byte(actual), &actObj); err != nil {
		t.Fatalf("failed to unmarshal actual JSON: %v", err)
	}
	return reflect.DeepEqual(expObj, actObj)
}

func TestGenericSMS_SendSMS_JSON(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST method, got: %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected application/json, got: %s", r.Header.Get("Content-Type"))
		}
		if r.Header.Get("X-Custom-Header") != "secret-value" {
			t.Errorf("expected secret-value header, got: %s", r.Header.Get("X-Custom-Header"))
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("failed to read body: %v", err)
		}

		expectedBody := `{"to": "+123456789", "message": "Your code is 123456"}`
		if !jsonEqual(t, expectedBody, string(body)) {
			t.Errorf("JSON body mismatch.\nExpected: %s\nGot: %s", expectedBody, string(body))
		}

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	headers := map[string]string{
		"X-Custom-Header": "secret-value",
	}

	template := `{"to": "${ to }", "message": "Your code is ${body}"}`
	provider := NewGenericSMS(server.URL, "application/json", template, headers, 5*time.Second)

	err := provider.SendSMS("+123456789", "123456")
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}

func TestGenericSMS_SendSMS_Form(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
			t.Errorf("expected application/x-www-form-urlencoded, got: %s", r.Header.Get("Content-Type"))
		}

		err := r.ParseForm()
		if err != nil {
			t.Fatalf("failed to parse form: %v", err)
		}

		if r.Form.Get("otp") != "123456" {
			t.Errorf("expected otp=123456, got: %s", r.Form.Get("otp"))
		}
		if r.Form.Get("number") != "+919999999999" {
			t.Errorf("expected number=+919999999999, got: %s", r.Form.Get("number"))
		}

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	template := `{"otp":"${body}", "number":"${to}"}`
	provider := NewGenericSMS(server.URL, "application/x-www-form-urlencoded", template, nil, 5*time.Second)

	err := provider.SendSMS("+919999999999", "123456")
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}

func TestGenericSMS_SendSMS_Error(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	provider := NewGenericSMS(server.URL, "application/json", "{}", nil, 5*time.Second)

	err := provider.SendSMS("+123456789", "123456")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "generic sms provider returned status: 500") {
		t.Errorf("expected error to contain status 500, got: %v", err)
	}
}

func TestGenericSMS_TwilioCompatibility(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
			t.Errorf("expected application/x-www-form-urlencoded, got: %s", r.Header.Get("Content-Type"))
		}
		if !strings.Contains(r.Header.Get("Authorization"), "Basic") {
			t.Errorf("expected Authorization header to contain Basic, got: %s", r.Header.Get("Authorization"))
		}

		err := r.ParseForm()
		if err != nil {
			t.Fatalf("failed to parse form: %v", err)
		}

		if r.Form.Get("To") != "+919999999999" {
			t.Errorf("expected To=+919999999999, got: %s", r.Form.Get("To"))
		}
		if !strings.Contains(r.Form.Get("Body"), "123456") {
			t.Errorf("expected Body to contain 123456, got: %s", r.Form.Get("Body"))
		}
		if r.Form.Get("From") != "+12345" {
			t.Errorf("expected From=+12345, got: %s", r.Form.Get("From"))
		}

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	headers := map[string]string{
		"Authorization": "Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==",
	}

	template := `{"To":"${to}", "Body":"Your code is ${ body }", "From":"+12345"}`
	provider := NewGenericSMS(server.URL, "application/x-www-form-urlencoded", template, headers, 5*time.Second)

	err := provider.SendSMS("+919999999999", "123456")
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}

func TestGenericSMS_ModicaCompatibility(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected application/json, got: %s", r.Header.Get("Content-Type"))
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("failed to read body: %v", err)
		}

		expectedBody := `{"destination": "+123456789", "content": "123456"}`
		if !jsonEqual(t, expectedBody, string(body)) {
			t.Errorf("JSON body mismatch.\nExpected: %s\nGot: %s", expectedBody, string(body))
		}

		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()

	template := `{"destination": "${to}", "content": "${body}"}`
	provider := NewGenericSMS(server.URL, "application/json", template, nil, 5*time.Second)

	err := provider.SendSMS("+123456789", "123456")
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}
