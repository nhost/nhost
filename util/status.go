package util

import (
	"fmt"
	"os"

	"github.com/nhost/cli/logger"
)

type (

	// Status is an in-line output structure that holds the status text and icon
	Status struct {
		Value int
		Total int
		Text  string
		Icon  string
	}
)

//  Initialize console colours
const (
	Bold   = "\033[1m"
	Reset  = "\033[0m"
	Green  = "\033[32m"
	Blue   = "\033[34m"
	Yellow = "\033[33m"
	Cyan   = "\033[36m"
	Red    = "\033[31m"
	Gray   = "\033[37;2m"
	//  White = "\033[97m"
)

var (

	//  New base writer for all tasks
	Writer = New()
)

func Init() {}

// Returns a new Status object
func New() Status {
	return Status{}
}

//	Set the status text
func (s *Status) Set(text string) {
	s.Text = text
	s.Print()
}

//	Change the status icon to error, and set the text
func (s *Status) Error(text string) {
	s.Icon = GetIcon(CANCEL, Red)
	s.Set(text)
}

//	Print the status error in a new line
func (s *Status) Errorln(text string) {
	fmt.Println()
	s.Error(text)
}

//	Set the status error and exit CLI
func (s *Status) Fatal(text string) {
	s.Error(text)
	fmt.Println()
	os.Exit(0)
}

//	Change the status icon to success, and set the text
func (s *Status) Success(text string) {
	s.Icon = GetIcon(CHECK, Green)
	s.Set(text)
}

//	Print the success status in a new line
func (s *Status) Successln(text string) {
	fmt.Println()
	s.Success(text)
}

//	Change the status icon to info, and set the text
func (s *Status) Info(text string) {
	s.Icon = GetIcon(INFO, Blue)
	s.Set(text)
}

//	Print the info status in a new line
func (s *Status) Infoln(text string) {
	fmt.Println()
	s.Info(text)
}

//	Change the status icon to warning, and set the text
func (s *Status) Warn(text string) {
	s.Icon = GetIcon(WARN, Yellow)
	s.Set(text)
}

//	Print the warning status in a new line
func (s *Status) Warnln(text string) {
	fmt.Println()
	s.Warn(text)
}

//	Change the status icon to yellow coloured gear, and set the text
func (s *Status) Executing(text string) {
	s.Icon = GetIcon(GEAR, Yellow)
	s.Set(text)
}

//	Print the execution status in a new line
func (s *Status) Executingln(text string) {
	fmt.Println()
	s.Executing(text)
}

//	Change the status icon to gray coloured gear, and set the text
func (s *Status) Suppressed(text string) {
	s.Icon = GetIcon(GEAR, Gray)
	s.Set(text)
}

//	Print the supressed status in a new line
func (s *Status) Suppressedln(text string) {
	fmt.Println()
	s.Suppressed(text)
}

//	Increase the status value
func (s *Status) Increment(value int) {
	s.Value += value
	s.Print()
}

//	Update total status value
func (s *Status) Update(value int) {
	s.Total += value
	s.Print()
}

//	Reset total status value
func (s *Status) Reset() {
	s.Total = 0
	s.Print()
}

//	Delete all text from line, and shift cursor back to beginning of line
func (s *Status) Clean() {
	fmt.Printf("\033[2K\r")
}

//	Print the status text
func (s *Status) Print() {
	if !logger.DEBUG {
		s.Clean()
		log.Debug(s.Text)
		if s.Total > 0 {
			fmt.Printf("%s %s (%d%s)", s.Icon, s.Text, int((float64(s.Value)/float64(s.Total))*100), "%")
		} else {
			fmt.Printf("%s %s", s.Icon, s.Text)
		}
	}
}
