package main

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/muesli/cancelreader"
)

func main() {
	r, err := cancelreader.NewReader(os.Stdin)
	if err != nil {
		panic(err)
	}

	// cancel after five seconds
	go func() {
		time.Sleep(5 * time.Second)
		r.Cancel()
	}()

	// keep reading
	for {
		var buf [1024]byte
		_, err := r.Read(buf[:])

		if errors.Is(err, cancelreader.ErrCanceled) {
			fmt.Println("canceled!")
			break
		}
		if err != nil {
			// handle other errors
			panic(err)
		}

		// handle data
		fmt.Println("read:", string(buf[:]))
	}
}
