package main

import (
	"io"
	"os"

	"github.com/mattn/go-localereader"
)

func main() {
	io.Copy(os.Stdout, localereader.NewReader(os.Stdin))
}
