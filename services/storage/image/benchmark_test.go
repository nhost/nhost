package image_test

import (
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"testing"

	"github.com/davidbyttow/govips/v2/vips"
	"github.com/nhost/nhost/services/storage/image"
)

type testFile struct {
	path string
	size uint64
}

func collectTestFiles(t *testing.T) []testFile {
	t.Helper()

	patterns := []string{
		"testdata/large/*_baseline.jpg",
		"testdata/large/*_interlaced.jpg",
		"testdata/large/*.webp",
		"testdata/large/*.heic",
	}

	var files []testFile
	for _, p := range patterns {
		matches, err := filepath.Glob(p)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range matches {
			info, err := os.Stat(m)
			if err != nil {
				t.Fatal(err)
			}
			files = append(files, testFile{path: m, size: uint64(info.Size())})
		}
	}

	if len(files) == 0 {
		t.Skip("no test images found in testdata/large/")
	}

	return files
}

func getProcessRSSKB() int64 {
	var rusage syscall.Rusage
	if err := syscall.Getrusage(syscall.RUSAGE_SELF, &rusage); err != nil {
		return 0
	}
	// macOS: bytes, Linux: KB
	return rusage.Maxrss / 1024
}

func printMemLine(label string, goMem *runtime.MemStats, vipsMem *vips.MemoryStats) {
	fmt.Printf("%-12s Go Heap: %6d KB  |  vips Mem: %6d KB  vips High: %6d KB  vips Allocs: %4d  vips Files: %2d  |  RSS: %6d KB\n",
		label,
		goMem.HeapAlloc/1024,
		vipsMem.Mem/1024,
		vipsMem.MemHigh/1024,
		vipsMem.Allocs,
		vipsMem.Files,
		getProcessRSSKB(),
	)
}

func readMem(goMem *runtime.MemStats, vipsMem *vips.MemoryStats) {
	runtime.GC()
	runtime.ReadMemStats(goMem)
	vips.ReadVipsMemStats(vipsMem)
}

// TestMemoryStressGovips simulates one download round from stress_test.sh:
// iterate over all large test images, resize each to a random width (100-1000).
// Reports Go heap, libvips tracked memory, and process RSS at intervals.
func TestMemoryStressGovips(t *testing.T) {
	files := collectTestFiles(t)
	transformer := image.NewTransformer()

	formats := []image.ImageType{
		image.ImageTypeJPEG,
		image.ImageTypeWEBP,
	}

	rng := rand.New(rand.NewSource(42)) //nolint: gosec

	var goMem runtime.MemStats
	var vipsMem vips.MemoryStats

	readMem(&goMem, &vipsMem)
	fmt.Printf("\n=== GOVIPS MEMORY STRESS TEST (%d files) ===\n", len(files))
	printMemLine("BEFORE", &goMem, &vipsMem)

	total := 0
	for i, f := range files {
		width := rng.Intn(901) + 100
		format := formats[rng.Intn(len(formats))]

		orig, err := os.Open(f.path)
		if err != nil {
			t.Fatal(err)
		}

		opts := image.Options{
			Width:  width,
			Format: format,
		}

		err = transformer.Run(orig, f.size, io.Discard, opts)
		orig.Close()
		if err != nil {
			t.Logf("WARN: %s (w=%d): %v", f.path, width, err)
			continue
		}
		total++

		if (i+1)%10 == 0 {
			readMem(&goMem, &vipsMem)
			printMemLine(fmt.Sprintf("[%d/%d]", i+1, len(files)), &goMem, &vipsMem)
		}
	}

	readMem(&goMem, &vipsMem)
	fmt.Println()
	printMemLine("FINAL", &goMem, &vipsMem)
	fmt.Printf("Processed %d/%d files\n\n", total, len(files))
}
