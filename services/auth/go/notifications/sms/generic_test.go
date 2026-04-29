package sms

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestGenericSMS_SendSMS_JSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		assert.Equal(t, "secret-value", r.Header.Get("X-Custom-Header"))

		body, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		assert.JSONEq(t, `{"to": "+123456789", "message": "Your code is 123456"}`, string(body))

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	headers := map[string]string{
		"X-Custom-Header": "secret-value",
	}

	template := `{"to": "${ to }", "message": "Your code is ${body}"}`
	provider := NewGenericSMS(server.URL, "application/json", template, headers, 5*time.Second)

	err := provider.SendSMS("+123456789", "123456")
	assert.NoError(t, err)
}

func TestGenericSMS_SendSMS_Form(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "application/x-www-form-urlencoded", r.Header.Get("Content-Type"))

		err := r.ParseForm()
		assert.NoError(t, err)
		assert.Equal(t, "123456", r.Form.Get("otp"))
		assert.Equal(t, "+919999999999", r.Form.Get("number"))

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// In Form mode, the user provides a template like: {"otp":"${body}", "number":"${to}"}
	// which we convert to form values.
	template := `{"otp":"${body}", "number":"${to}"}`
	provider := NewGenericSMS(server.URL, "application/x-www-form-urlencoded", template, nil, 5*time.Second)

	err := provider.SendSMS("+919999999999", "123456")
	assert.NoError(t, err)
}

func TestGenericSMS_SendSMS_Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	provider := NewGenericSMS(server.URL, "application/json", "{}", nil, 5*time.Second)

	err := provider.SendSMS("+123456789", "123456")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "generic sms provider returned status: 500")
}

func TestGenericSMS_TwilioCompatibility(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "application/x-www-form-urlencoded", r.Header.Get("Content-Type"))
		assert.Contains(t, r.Header.Get("Authorization"), "Basic")

		err := r.ParseForm()
		assert.NoError(t, err)
		assert.Equal(t, "+919999999999", r.Form.Get("To"))
		assert.Contains(t, r.Form.Get("Body"), "123456")
		assert.Equal(t, "+12345", r.Form.Get("From"))

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	headers := map[string]string{
		"Authorization": "Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==",
	}

	// Use a JSON template to verify that our auto-encoding logic
	// correctly handles special characters like '+' in phone numbers
	// when sending as application/x-www-form-urlencoded
	template := `{"To":"${to}", "Body":"Your code is ${ body }", "From":"+12345"}`
	provider := NewGenericSMS(server.URL, "application/x-www-form-urlencoded", template, headers, 5*time.Second)

	err := provider.SendSMS("+919999999999", "123456")
	assert.NoError(t, err)
}

func TestGenericSMS_ModicaCompatibility(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		body, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		assert.JSONEq(t, `{"destination": "+123456789", "content": "123456"}`, string(body))

		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()

	// Modica uses "destination" and "content"
	template := `{"destination": "${to}", "content": "${body}"}`
	provider := NewGenericSMS(server.URL, "application/json", template, nil, 5*time.Second)

	err := provider.SendSMS("+123456789", "123456")
	assert.NoError(t, err)
}
