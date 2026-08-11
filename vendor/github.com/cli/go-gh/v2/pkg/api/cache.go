package api

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type cache struct {
	dir string
	ttl time.Duration
}

type cacheRoundTripper struct {
	fs fileStorage
	rt http.RoundTripper
}

type fileStorage struct {
	dir string
	ttl time.Duration
	mu  *sync.RWMutex
}

type readCloser struct {
	io.Reader
	io.Closer
}

func isCacheableRequest(req *http.Request) bool {
	if strings.EqualFold(req.Method, "GET") || strings.EqualFold(req.Method, "HEAD") {
		return true
	}

	if strings.EqualFold(req.Method, "POST") && (req.URL.Path == "/graphql" || req.URL.Path == "/api/graphql") {
		return true
	}

	return false
}

func isCacheableResponse(res *http.Response) bool {
	return res.StatusCode < 500 && res.StatusCode != 403
}

func cacheKey(req *http.Request) (string, error) {
	h := sha256.New()
	fmt.Fprintf(h, "%s:", req.Method)
	fmt.Fprintf(h, "%s:", req.URL.String())
	fmt.Fprintf(h, "%s:", req.Header.Get("Accept"))
	fmt.Fprintf(h, "%s:", req.Header.Get("Authorization"))

	if req.Body != nil {
		var bodyCopy io.ReadCloser
		req.Body, bodyCopy = copyStream(req.Body)
		defer bodyCopy.Close()
		if _, err := io.Copy(h, bodyCopy); err != nil {
			return "", err
		}
	}

	digest := h.Sum(nil)
	return fmt.Sprintf("%x", digest), nil
}

func (c cache) RoundTripper(rt http.RoundTripper) http.RoundTripper {
	fs := fileStorage{
		dir: c.dir,
		ttl: c.ttl,
		mu:  &sync.RWMutex{},
	}
	return cacheRoundTripper{fs: fs, rt: rt}
}

func (crt cacheRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	reqDir, reqTTL := requestCacheOptions(req)

	if crt.fs.ttl == 0 && reqTTL == 0 {
		return crt.rt.RoundTrip(req)
	}

	if !isCacheableRequest(req) {
		return crt.rt.RoundTrip(req)
	}

	origDir := crt.fs.dir
	if reqDir != "" {
		crt.fs.dir = reqDir
	}
	origTTL := crt.fs.ttl
	if reqTTL != 0 {
		crt.fs.ttl = reqTTL
	}

	key, keyErr := cacheKey(req)
	if keyErr == nil {
		if res, err := crt.fs.read(key); err == nil {
			res.Request = req
			return res, nil
		}
	}

	res, err := crt.rt.RoundTrip(req)
	if err == nil && keyErr == nil && isCacheableResponse(res) {
		_ = crt.fs.store(key, res)
	}

	crt.fs.dir = origDir
	crt.fs.ttl = origTTL

	return res, err
}

// Allow an individual request to override cache options.
func requestCacheOptions(req *http.Request) (string, time.Duration) {
	var dur time.Duration
	dir := req.Header.Get("X-GH-CACHE-DIR")
	ttl := req.Header.Get("X-GH-CACHE-TTL")
	if ttl != "" {
		dur, _ = time.ParseDuration(ttl)
	}
	return dir, dur
}

func (fs *fileStorage) filePath(key string) string {
	if len(key) >= 6 {
		return filepath.Join(fs.dir, key[0:2], key[2:4], key[4:])
	}
	return filepath.Join(fs.dir, key)
}

func (fs *fileStorage) read(key string) (*http.Response, error) {
	cacheFile := fs.filePath(key)

	fs.mu.RLock()
	defer fs.mu.RUnlock()

	f, err := os.Open(cacheFile)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return nil, err
	}

	age := time.Since(stat.ModTime())
	if age > fs.ttl {
		return nil, errors.New("cache expired")
	}

	body := &bytes.Buffer{}
	_, err = io.Copy(body, f)
	if err != nil {
		return nil, err
	}

	res, err := http.ReadResponse(bufio.NewReader(body), nil)
	return res, err
}

func (fs *fileStorage) store(key string, res *http.Response) (storeErr error) {
	cacheFile := fs.filePath(key)

	fs.mu.Lock()
	defer fs.mu.Unlock()

	if storeErr = os.MkdirAll(filepath.Dir(cacheFile), 0755); storeErr != nil {
		return
	}

	var f *os.File
	if f, storeErr = os.OpenFile(cacheFile, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600); storeErr != nil {
		return
	}

	defer func() {
		if err := f.Close(); storeErr == nil && err != nil {
			storeErr = err
		}
	}()

	var origBody io.ReadCloser
	if res.Body != nil {
		origBody, res.Body = copyStream(res.Body)
		defer res.Body.Close()
	}

	storeErr = res.Write(f)
	if origBody != nil {
		res.Body = origBody
	}

	return
}

func copyStream(r io.ReadCloser) (io.ReadCloser, io.ReadCloser) {
	b := &bytes.Buffer{}
	nr := io.TeeReader(r, b)
	return io.NopCloser(b), &readCloser{
		Reader: nr,
		Closer: r,
	}
}
