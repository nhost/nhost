package tools

import (
	"encoding/base64"
	"io"
	"mime"
	"mime/multipart"
	"strings"
	"testing"
)

func TestStorageMultipartLengthAndEncoding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		data  string
		want  string
		batch bool
	}{
		{"padding", "eA==", "x", false},
		{"line break between padding", "eA=\r\n=\n", "x", false},
		{"embedded line breaks", "eH\r\nh4\n", "xxx", true},
		{"trailing line breaks", "eA==\r\n", "x", true},
		{"empty file", "", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			body, err := newStorageMultipart(
				[]storageFile{{Name: "quote\";image.png", Data: tt.data}},
				nil,
				nil,
				tt.batch,
			)
			if err != nil {
				t.Fatal(err)
			}

			data, err := io.ReadAll(body)
			if err != nil {
				t.Fatal(err)
			}

			if int64(len(data)) != body.contentLength {
				t.Errorf("multipart size=%d, declared=%d", len(data), body.contentLength)
			}

			_, parameters, err := mime.ParseMediaType(body.contentType)
			if err != nil {
				t.Fatal(err)
			}

			reader := multipart.NewReader(strings.NewReader(string(data)), parameters["boundary"])

			part, err := reader.NextPart()
			if err != nil {
				t.Fatal(err)
			}

			content, err := io.ReadAll(part)
			if err != nil {
				t.Fatal(err)
			}

			if string(content) != tt.want || part.FileName() != "quote\";image.png" {
				t.Errorf("unexpected multipart content=%q filename=%q", content, part.FileName())
			}
		})
	}
}

func TestStorageMultipartMetadataValidation(t *testing.T) {
	t.Parallel()

	_, err := newStorageMultipart(
		[]storageFile{{Name: "image.png", Data: "eA=="}},
		[]any{make(chan int)},
		nil,
		true,
	)
	if err == nil {
		t.Error("unencodable metadata must be rejected before making a request")
	}
}

func BenchmarkStorageMultipart(b *testing.B) {
	for _, size := range []int{1 << 20, 16 << 20} {
		b.Run(benchmarkStorageSizeName(size), func(b *testing.B) {
			encoded := base64.StdEncoding.EncodeToString([]byte(strings.Repeat("x", size)))
			files := []storageFile{{Name: "large.png", Data: encoded}}

			b.SetBytes(int64(size))
			b.ReportAllocs()
			b.ResetTimer()

			for b.Loop() {
				body, err := newStorageMultipart(files, nil, nil, true)
				if err != nil {
					b.Fatal(err)
				}

				if _, err := io.Copy(io.Discard, body); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func benchmarkStorageSizeName(size int) string {
	if size == 1<<20 {
		return "1MiB"
	}

	return "16MiB"
}
