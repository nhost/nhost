package util

import (
	"fmt"

	"github.com/nhost/cli/logger"
)

type (
	Status struct {
		Value int
		Total int
		Text  string
		Icon  string
	}
)

type Colour string

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

func (s *Status) Init() {}

func (s *Status) Set(text string) {
	s.Text = text
	s.Print()
}

func (s *Status) Increment(value int) {
	s.Value += value
	s.Print()
}

func (s *Status) Update(value int) {
	s.Total += value
	s.Print()
}

func (s *Status) Reset() {
	s.Total = 0
	s.Print()
}

func (s *Status) Print() {
	if !logger.DEBUG {
		if s.Total > 0 {
			fmt.Printf("\r%s %s (%d%s)", s.Icon, s.Text, int((float64(s.Value)/float64(s.Total))*100), "%")
		} else {
			fmt.Printf("\r%s %s", s.Icon, s.Text)
		}
	}
}
