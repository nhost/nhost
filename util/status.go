package util

import (
	"fmt"
	"os"

	"github.com/nhost/cli/logger"
)

type (

	// Status is an in-line output structure that holds the status text and icon
	Status struct {
		Value     int
		Total     int
		Text      string
		Icon      string
		color     string
		showIcons bool
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
	Writer Status
)

// Returns a new Status object
func New(showIcons bool) Status {
	return Status{
		showIcons: showIcons,
	}
}

//	Set the status text
func (s *Status) Set(text string) {
	s.Text = text
	s.Print()
}

//	Change the status icon to error, and set the text
func (s *Status) Error(text string) {
	s.Icon = CANCEL
	s.color = Red
	s.Set(text)
}

//	Print the status error in a new line
func (s *Status) Errorln(text string) {
	fmt.Println()
	s.Error(text)
	fmt.Println()
}

//	Set the status error and exit CLI
func (s *Status) Fatal(text string) {
	s.Error(text)
	fmt.Println()
	os.Exit(1)
}

//	Change the status icon to success, and set the text
func (s *Status) Success(text string) {
	s.Icon = CHECK
	s.color = Green
	s.Set(text)
}

//	Print the success status in a new line
func (s *Status) Successln(text string) {
	fmt.Println()
	s.Success(text)
	fmt.Println()
}

//	Change the status icon to info, and set the text
func (s *Status) Info(text string) {
	s.Icon = INFO
	s.color = Blue
	s.Set(text)
}

//	Print the info status in a new line
func (s *Status) Infoln(text string) {
	fmt.Println()
	s.Info(text)
	fmt.Println()
}

//	Change the status icon to warning, and set the text
func (s *Status) Warn(text string) {
	s.Icon = WARN
	s.color = Yellow
	s.Set(text)
}

//	Print the warning status in a new line
func (s *Status) Warnln(text string) {
	fmt.Println()
	s.Warn(text)
	fmt.Println()
}

//	Change the status icon to yellow coloured gear, and set the text
func (s *Status) Executing(text string) {
	s.Icon = GEAR
	s.color = Yellow
	s.Set(text)
}

//	Print the execution status in a new line
func (s *Status) Executingln(text string) {
	fmt.Println()
	s.Executing(text)
	fmt.Println()
}

//	Change the status icon to gray coloured gear, and set the text
func (s *Status) Suppressed(text string) {
	s.Icon = GEAR
	s.color = Gray
	s.Set(text)
}

//	Print the supressed status in a new line
func (s *Status) Suppressedln(text string) {
	fmt.Println()
	s.Suppressed(text)
	fmt.Println()
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
	s.Value = 0
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
		prefix := ""
		if s.showIcons {
			prefix = fmt.Sprintf("%s ", GetIcon(s.Icon, s.color))
		} else {
			prefix = fmt.Sprintf("%s ", GetIcon(">", s.color))
		}
		if s.Total > 0 {
			fmt.Printf(prefix+"%s (%d%s)", s.Text, int((float64(s.Value)/float64(s.Total))*100), "%")
		} else {
			fmt.Print(prefix + s.Text)
		}
	}
}
