package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"

	"golang.org/x/sys/windows"

	"github.com/erikgeiser/coninput"
)

func run() (err error) {
	con, err := windows.GetStdHandle(windows.STD_INPUT_HANDLE)
	if err != nil {
		return fmt.Errorf("get stdin handle: %w", err)
	}

	var originalConsoleMode uint32

	err = windows.GetConsoleMode(con, &originalConsoleMode)
	if err != nil {
		return fmt.Errorf("get console mode: %w", err)
	}

	fmt.Println("Input mode:", coninput.DescribeInputMode(originalConsoleMode))

	newConsoleMode := coninput.AddInputModes(
		windows.ENABLE_MOUSE_INPUT,
		windows.ENABLE_WINDOW_INPUT,
		windows.ENABLE_PROCESSED_INPUT,
		windows.ENABLE_EXTENDED_FLAGS,
	)

	fmt.Println("Setting mode to:", coninput.DescribeInputMode(newConsoleMode))

	err = windows.SetConsoleMode(con, newConsoleMode)
	if err != nil {
		return fmt.Errorf("set console mode: %w", err)
	}

	defer func() {
		fmt.Println("Resetting input mode to:", coninput.DescribeInputMode(originalConsoleMode))

		resetErr := windows.SetConsoleMode(con, originalConsoleMode)
		if err == nil && resetErr != nil {
			err = fmt.Errorf("reset console mode: %w", resetErr)
		}
	}()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	for {
		if ctx.Err() != nil {
			break
		}

		events, err := coninput.ReadNConsoleInputs(con, 16)
		if err != nil {
			return fmt.Errorf("read input events: %w", err)
		}

		fmt.Printf("Read %d events:\n", len(events))
		for _, event := range events {
			fmt.Println("  ", event)
		}
	}

	return nil
}

func main() {
	err := run()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v", err)

		os.Exit(1)
	}
}
