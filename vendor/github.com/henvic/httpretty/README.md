# httpretty
[![GoDoc](https://godoc.org/github.com/henvic/httpretty?status.svg)](https://godoc.org/github.com/henvic/httpretty) [![Build Status](https://travis-ci.org/henvic/httpretty.svg?branch=master)](https://travis-ci.org/henvic/httpretty) [![Coverage Status](https://coveralls.io/repos/henvic/httpretty/badge.svg)](https://coveralls.io/r/henvic/httpretty) [![Go Report Card](https://goreportcard.com/badge/github.com/henvic/httpretty)](https://goreportcard.com/report/github.com/henvic/httpretty) [![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/3669/badge)](https://bestpractices.coreinfrastructure.org/projects/3669)

Package httpretty prints the HTTP requests of your Go programs pretty on your terminal screen. It is mostly inspired in [curl](https://curl.haxx.se)'s `--verbose` mode, and also on the [httputil.DumpRequest](https://golang.org/pkg/net/http/httputil/) and similar functions.

[![asciicast](https://asciinema.org/a/297429.svg)](https://asciinema.org/a/297429)

## Setting up a logger
You can define a logger with something like

```go
logger := &httpretty.Logger{
	Time:           true,
	TLS:            true,
	RequestHeader:  true,
	RequestBody:    true,
	ResponseHeader: true,
	ResponseBody:   true,
	Colors:         true, // erase line if you don't like colors
	Formatters:     []httpretty.Formatter{&httpretty.JSONFormatter{}},
}
```

This code will set up a logger with sane settings. By default the logger prints nothing but the request line (and the remote address, when using it on the server-side).

### Using on the client-side
You can set the transport for the [*net/http.Client](https://golang.org/pkg/net/http/#Client) you are using like this:

```go
client := &http.Client{
	Transport: logger.RoundTripper(http.DefaultTransport),
}

// from now on, you can use client.Do, client.Get, etc. to create requests.
```

If you don't care about setting a new client, you can safely replace your existing http.DefaultClient with this:

```go
http.DefaultClient.Transport = logger.RoundTripper(http.DefaultClient.Transport)
```

Then httpretty is going to print information about regular requests to your terminal when code such as this is called:
```go
if _, err := http.Get("https://www.google.com/"); err != nil {
        fmt.Fprintf(os.Stderr, "%+v\n", err)
        os.Exit(1)
}
```

However, have in mind you usually want to use a custom *http.Client to control things such as timeout.

## Logging on the server-side
You can use the logger quickly to log requests on your server. For example:

```go
logger.Middleware(mux)
```

The handler should by a http.Handler. Usually, you want this to be your `http.ServeMux` HTTP entrypoint.

For working examples, please see the example directory.

## Filtering
You have two ways to filter a request so it isn't printed by the logger.

### httpretty.WithHide
You can filter any request by setting a request context before the request reaches `httpretty.RoundTripper`:

```go
req = req.WithContext(httpretty.WithHide(ctx))
```

### Filter function
A second option is to implement

```go
type Filter func(req *http.Request) (skip bool, err error)
```

and set it as the filter for your logger. For example:

```go
logger.SetFilter(func filteredURIs(req *http.Request) (bool, error) {
	if req.Method != http.MethodGet {
		return true, nil
	}

	if path := req.URL.Path; path == "/debug" | strings.HasPrefix(path, "/debug/") {
		return true, nil
	}

	return false
})
```

## Formatters
You can define a formatter for any media type by implementing the Formatter interface.

We provide a JSONFormatter for convenience (it is not enabled by default).
