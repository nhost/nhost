package getter

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	safetemp "github.com/hashicorp/go-safetemp"
)

// HttpGetter is a Getter implementation that will download from an HTTP
// endpoint.
//
// For file downloads, HTTP is used directly.
//
// The protocol for downloading a directory from an HTTP endpoint is as follows:
//
// An HTTP GET request is made to the URL with the additional GET parameter
// "terraform-get=1". This lets you handle that scenario specially if you
// wish. The response must be a 2xx.
//
// First, a header is looked for "X-Terraform-Get" which should contain
// a source URL to download. This source must use one of the configured
// protocols and getters for the client, or "http"/"https" if using
// the HttpGetter directly.
//
// If the header is not present, then a meta tag is searched for named
// "terraform-get" and the content should be a source URL.
//
// The source URL, whether from the header or meta tag, must be a fully
// formed URL. The shorthand syntax of "github.com/foo/bar" or relative
// paths are not allowed.
type HttpGetter struct {

	// Netrc, if true, will lookup and use auth information found
	// in the user's netrc file if available.
	Netrc bool

	// Client is the http.Client to use for Get requests.
	// This defaults to a cleanhttp.DefaultClient if left unset.
	Client *http.Client

	// Header contains optional request header fields that should be included
	// with every HTTP request. Note that the zero value of this field is nil,
	// and as such it needs to be initialized before use, via something like
	// make(http.Header).
	Header http.Header
	// DoNotCheckHeadFirst configures the client to NOT check if the server
	// supports HEAD requests.
	DoNotCheckHeadFirst bool

	// HeadFirstTimeout configures the client to enforce a timeout when
	// the server supports HEAD requests.
	//
	// The zero value means no timeout.
	HeadFirstTimeout time.Duration

	// ReadTimeout configures the client to enforce a timeout when
	// making a request to an HTTP server and reading its response body.
	//
	// The zero value means no timeout.
	ReadTimeout time.Duration

	// MaxBytes limits the number of bytes that will be ready from an HTTP
	// response body returned from a server. The zero value means no limit.
	MaxBytes int64

	// XTerraformGetLimit configures how many times the client with follow
	// the " X-Terraform-Get" header value.
	//
	// The zero value means no limit.
	XTerraformGetLimit int

	// XTerraformGetDisabled disables the client's usage of the "X-Terraform-Get"
	// header value.
	XTerraformGetDisabled bool
}

func (g *HttpGetter) Mode(ctx context.Context, u *url.URL) (Mode, error) {
	if strings.HasSuffix(u.Path, "/") {
		return ModeDir, nil
	}
	return ModeFile, nil
}

type contextKey int

const (
	xTerraformGetDisable           contextKey = 0
	xTerraformGetLimit             contextKey = 1
	xTerraformGetLimitCurrentValue contextKey = 2
	httpClientValue                contextKey = 3
	httpMaxBytesValue              contextKey = 4
)

func xTerraformGetDisabled(ctx context.Context) bool {
	value, ok := ctx.Value(xTerraformGetDisable).(bool)
	if !ok {
		return false
	}
	return value
}

func xTerraformGetLimitCurrentValueFromContext(ctx context.Context) int {
	value, ok := ctx.Value(xTerraformGetLimitCurrentValue).(int)
	if !ok {
		return 1
	}
	return value
}

func xTerraformGetLimiConfiguredtFromContext(ctx context.Context) int {
	value, ok := ctx.Value(xTerraformGetLimit).(int)
	if !ok {
		return 0
	}
	return value
}

func httpClientFromContext(ctx context.Context) *http.Client {
	value, ok := ctx.Value(httpClientValue).(*http.Client)
	if !ok {
		return nil
	}
	return value
}

func httpMaxBytesFromContext(ctx context.Context) int64 {
	value, ok := ctx.Value(httpMaxBytesValue).(int64)
	if !ok {
		return 0 // no limit
	}
	return value
}

type limitedWrappedReaderCloser struct {
	underlying io.Reader
	closeFn    func() error
}

func (l *limitedWrappedReaderCloser) Read(p []byte) (n int, err error) {
	return l.underlying.Read(p)
}

func (l *limitedWrappedReaderCloser) Close() (err error) {
	return l.closeFn()
}

func newLimitedWrappedReaderCloser(r io.ReadCloser, limit int64) io.ReadCloser {
	return &limitedWrappedReaderCloser{
		underlying: io.LimitReader(r, limit),
		closeFn:    r.Close,
	}
}

func (g *HttpGetter) Get(ctx context.Context, req *Request) error {
	// Optionally disable any X-Terraform-Get redirects. This is recommended for usage of
	// this client outside of Terraform's. This feature is likely not required if the
	// source server can provider normal HTTP redirects.
	if g.XTerraformGetDisabled {
		ctx = context.WithValue(ctx, xTerraformGetDisable, g.XTerraformGetDisabled)
	}

	// Optionally enforce a limit on X-Terraform-Get redirects. We check this for every
	// invocation of this function, because the value is not passed down to subsequent
	// client Get function invocations.
	if g.XTerraformGetLimit > 0 {
		ctx = context.WithValue(ctx, xTerraformGetLimit, g.XTerraformGetLimit)
	}

	// If there was a limit on X-Terraform-Get redirects, check what the current count value.
	//
	// If the value is greater than the limit, return an error. Otherwise, increment the value,
	// and include it in the the context to be passed along in all the subsequent client
	// Get function invocations.
	if limit := xTerraformGetLimiConfiguredtFromContext(ctx); limit > 0 {
		currentValue := xTerraformGetLimitCurrentValueFromContext(ctx)

		if currentValue > limit {
			return fmt.Errorf("too many X-Terraform-Get redirects: %d", currentValue)
		}

		currentValue++

		ctx = context.WithValue(ctx, xTerraformGetLimitCurrentValue, currentValue)
	}

	// Optionally enforce a maxiumum HTTP response body size.
	if g.MaxBytes > 0 {
		ctx = context.WithValue(ctx, httpMaxBytesValue, g.MaxBytes)
	}
	// Copy the URL so we can modify it
	var newU url.URL = *req.u
	req.u = &newU

	if g.Netrc {
		// Add auth from netrc if we can
		if err := addAuthFromNetrc(req.u); err != nil {
			return err
		}
	}

	// If the HTTP client is nil, check if there is one available in the context,
	// otherwise create one using cleanhttp's default transport.
	if g.Client == nil {
		if client := httpClientFromContext(ctx); client != nil {
			g.Client = client
		} else {
			g.Client = httpClient
		}
	}

	// Pass along the configured HTTP client in the context for usage with the X-Terraform-Get feature.
	ctx = context.WithValue(ctx, httpClientValue, g.Client)

	// Add terraform-get to the parameter.
	q := req.u.Query()
	q.Add("terraform-get", "1")
	req.u.RawQuery = q.Encode()

	readCtx := ctx
	if g.ReadTimeout > 0 {
		var cancel context.CancelFunc
		readCtx, cancel = context.WithTimeout(ctx, g.ReadTimeout)
		defer cancel()
	}

	// Get the URL
	httpReq, err := http.NewRequestWithContext(readCtx, "GET", req.u.String(), nil)
	if err != nil {
		return err
	}

	if g.Header != nil {
		httpReq.Header = g.Header.Clone()
	}
	resp, err := g.Client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body := resp.Body
	if maxBytes := httpMaxBytesFromContext(ctx); maxBytes > 0 {
		body = newLimitedWrappedReaderCloser(body, maxBytes)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("bad response code: %d", resp.StatusCode)
	}

	if disabled := xTerraformGetDisabled(ctx); disabled {
		return nil
	}

	// Get client with configured Getters from the context
	// If the client is nil, we know we're using the HttpGetter directly. In this case,
	// we don't know exactly which protocols are configured, but we can make a good guess.
	//
	// This prevents all default getters from being allowed when only using the
	// HttpGetter directly. To enable protocol switching, a client "wrapper" must
	// be used.
	var getterClient *Client
	if v := ClientFromContext(ctx); v != nil {
		getterClient = v
	} else {
		getterClient = &Client{
			Getters: []Getter{g},
		}
	}

	// Extract the source URL
	var source string
	if v := resp.Header.Get("X-Terraform-Get"); v != "" {
		source = v
	} else {
		source, err = g.parseMeta(readCtx, body)
		if err != nil {
			return err
		}
	}

	if source == "" {
		return fmt.Errorf("no source URL was returned")
	}

	return g.getXTerraformSource(ctx, req, source, getterClient)
}

// GetFile fetches the file from src and stores it at dst.
// If the server supports Accept-Range, HttpGetter will attempt a range
// request. This means it is the caller's responsibility to ensure that an
// older version of the destination file does not exist, else it will be either
// falsely identified as being replaced, or corrupted with extra bytes
// appended.
func (g *HttpGetter) GetFile(ctx context.Context, req *Request) error {
	// Optionally enforce a maxiumum HTTP response body size.
	if g.MaxBytes > 0 {
		ctx = context.WithValue(ctx, httpMaxBytesValue, g.MaxBytes)
	}

	if g.Netrc {
		// Add auth from netrc if we can
		if err := addAuthFromNetrc(req.u); err != nil {
			return err
		}
	}
	// Create all the parent directories if needed
	if err := os.MkdirAll(filepath.Dir(req.Dst), req.Mode(0755)); err != nil {
		return err
	}

	f, err := os.OpenFile(req.Dst, os.O_RDWR|os.O_CREATE, req.Mode(0666))
	if err != nil {
		return err
	}
	defer f.Close()

	if g.Client == nil {
		g.Client = httpClient
	}

	var currentFileSize int64
	var httpReq *http.Request

	if g.DoNotCheckHeadFirst == false {
		headCtx := ctx

		if g.HeadFirstTimeout > 0 {
			var cancel context.CancelFunc

			headCtx, cancel = context.WithTimeout(ctx, g.HeadFirstTimeout)
			defer cancel()
		}

		// We first make a HEAD request so we can check
		// if the server supports range queries. If the server/URL doesn't
		// support HEAD requests, we just fall back to GET.
		httpReq, err = http.NewRequestWithContext(headCtx, "HEAD", req.u.String(), nil)
		if err != nil {
			return err
		}
		if g.Header != nil {
			httpReq.Header = g.Header.Clone()
		}
		headResp, err := g.Client.Do(httpReq)
		if err == nil {
			headResp.Body.Close()
			if headResp.StatusCode == 200 {
				// If the HEAD request succeeded, then attempt to set the range
				// query if we can.
				if headResp.Header.Get("Accept-Ranges") == "bytes" && headResp.ContentLength >= 0 {
					if fi, err := f.Stat(); err == nil {
						if _, err = f.Seek(0, io.SeekEnd); err == nil {
							currentFileSize = fi.Size()
							httpReq.Header.Set("Range", fmt.Sprintf("bytes=%d-", currentFileSize))
							if currentFileSize >= headResp.ContentLength {
								// file already present
								return nil
							}
						}
					}
				}
			}
		}
	}

	readCtx := ctx
	if g.ReadTimeout > 0 {
		var cancel context.CancelFunc
		readCtx, cancel = context.WithTimeout(ctx, g.ReadTimeout)
		defer cancel()
	}

	httpReq, err = http.NewRequestWithContext(readCtx, "GET", req.u.String(), nil)
	if err != nil {
		return err
	}
	if g.Header != nil {
		httpReq.Header = g.Header.Clone()
	}
	if currentFileSize > 0 {
		httpReq.Header.Set("Range", fmt.Sprintf("bytes=%d-", currentFileSize))
	}

	resp, err := g.Client.Do(httpReq)
	if err != nil {
		return err
	}
	switch resp.StatusCode {
	case http.StatusOK, http.StatusPartialContent:
		// all good
	default:
		resp.Body.Close()
		return fmt.Errorf("bad response code: %d", resp.StatusCode)
	}

	body := resp.Body

	if maxBytes := httpMaxBytesFromContext(readCtx); maxBytes > 0 {
		body = newLimitedWrappedReaderCloser(body, maxBytes)
	}

	if req.ProgressListener != nil {
		// track download
		fn := filepath.Base(req.u.EscapedPath())
		body = req.ProgressListener.TrackProgress(fn, currentFileSize, currentFileSize+resp.ContentLength, resp.Body)
	}
	defer body.Close()

	n, err := Copy(readCtx, f, body)
	if err == nil && n < resp.ContentLength {
		err = io.ErrShortWrite
	}
	return err
}

// getXTerraformSource downloads the source into the destination
// using a protocol switching capable client.
func (g *HttpGetter) getXTerraformSource(ctx context.Context, req *Request, source string, client *Client) error {

	// If there is a subdir component, then we download the root separately
	// into a temporary directory, then copy over the proper subdir.
	source, subDir := SourceDirSubdir(source)
	req = &Request{
		GetMode:         ModeDir,
		Src:             source,
		Dst:             req.Dst,
		DisableSymlinks: req.DisableSymlinks,
	}

	if subDir == "" {
		// We have a X-Terraform-Get source lets check for supported Getters
		var allowed bool
		for _, getter := range client.Getters {
			shouldDownload, err := Detect(req, getter)
			if err != nil {
				return fmt.Errorf("failed to detect the proper Getter to handle %s: %w", source, err)
			}
			if !shouldDownload {
				// the request should not be processed by that getter
				continue
			}
			allowed = true
		}

		if !allowed {
			protocol := strings.Split(source, ":")[0]
			return fmt.Errorf("no getter available for X-Terraform-Get source protocol: %q", protocol)
		}

		_, err := client.Get(ctx, req)
		return err
	}

	// We have a subdir, time to jump some hoops
	return g.getSubdir(ctx, req, source, subDir, client)

}

// getSubdir downloads the source into the destination, but with
// the proper subdir.
func (g *HttpGetter) getSubdir(ctx context.Context, req *Request, source, subDir string, client *Client) error {
	// Create a temporary directory to store the full source. This has to be
	// a non-existent directory.
	td, tdcloser, err := safetemp.Dir("", "getter")
	if err != nil {
		return err
	}
	defer tdcloser.Close()

	tdReq := &Request{
		Src:             source,
		Dst:             td,
		GetMode:         ModeDir,
		DisableSymlinks: req.DisableSymlinks,
	}
	if _, err := client.Get(ctx, tdReq); err != nil {
		return err
	}

	// Process any globbing
	sourcePath, err := SubdirGlob(td, subDir)
	if err != nil {
		return err
	}

	// Make sure the subdir path actually exists
	if _, err := os.Stat(sourcePath); err != nil {
		return fmt.Errorf(
			"Error downloading %s: %s", source, err)
	}

	// Copy the subdirectory into our actual destination.
	if err := os.RemoveAll(req.Dst); err != nil {
		return err
	}

	// Make the final destination
	if err := os.MkdirAll(req.Dst, req.Mode(0755)); err != nil {
		return err
	}

	return copyDir(ctx, req.Dst, sourcePath, false, req.DisableSymlinks, req.umask())
}

// parseMeta looks for the first meta tag in the given reader that
// will give us the source URL.
func (g *HttpGetter) parseMeta(ctx context.Context, r io.Reader) (string, error) {
	d := xml.NewDecoder(r)
	d.CharsetReader = charsetReader
	d.Strict = false
	var err error
	var t xml.Token
	for {
		if ctx.Err() != nil {
			return "", fmt.Errorf("context error while parsing meta tag: %w", ctx.Err())
		}

		t, err = d.Token()
		if err != nil {
			if err == io.EOF {
				err = nil
			}
			return "", err
		}
		if e, ok := t.(xml.StartElement); ok && strings.EqualFold(e.Name.Local, "body") {
			return "", nil
		}
		if e, ok := t.(xml.EndElement); ok && strings.EqualFold(e.Name.Local, "head") {
			return "", nil
		}
		e, ok := t.(xml.StartElement)
		if !ok || !strings.EqualFold(e.Name.Local, "meta") {
			continue
		}
		if attrValue(e.Attr, "name") != "terraform-get" {
			continue
		}
		if f := attrValue(e.Attr, "content"); f != "" {
			return f, nil
		}
	}
}

// attrValue returns the attribute value for the case-insensitive key
// `name', or the empty string if nothing is found.
func attrValue(attrs []xml.Attr, name string) string {
	for _, a := range attrs {
		if strings.EqualFold(a.Name.Local, name) {
			return a.Value
		}
	}
	return ""
}

// charsetReader returns a reader for the given charset. Currently
// it only supports UTF-8 and ASCII. Otherwise, it returns a meaningful
// error which is printed by go get, so the user can find why the package
// wasn't downloaded if the encoding is not supported. Note that, in
// order to reduce potential errors, ASCII is treated as UTF-8 (i.e. characters
// greater than 0x7f are not rejected).
func charsetReader(charset string, input io.Reader) (io.Reader, error) {
	switch strings.ToLower(charset) {
	case "ascii":
		return input, nil
	default:
		return nil, fmt.Errorf("can't decode XML document using charset %q", charset)
	}
}

func (g *HttpGetter) Detect(req *Request) (bool, error) {
	if len(req.Src) == 0 {
		return false, nil
	}

	if req.Forced != "" {
		// There's a getter being Forced
		if !g.validScheme(req.Forced) {
			// Current getter is not the Forced one
			// Don't use it to try to download the artifact
			return false, nil
		}
	}
	isForcedGetter := req.Forced != "" && g.validScheme(req.Forced)

	u, err := url.Parse(req.Src)
	if err == nil && u.Scheme != "" {
		if isForcedGetter {
			// Is the Forced getter and source is a valid url
			return true, nil
		}
		if g.validScheme(u.Scheme) {
			return true, nil
		}
		// Valid url with a scheme that is not valid for current getter
		return false, nil
	}

	return false, nil
}

func (g *HttpGetter) validScheme(scheme string) bool {
	return scheme == "http" || scheme == "https"
}
