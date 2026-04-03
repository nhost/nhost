package progress

import (
	"strings"
	"testing"

	"github.com/muesli/termenv"
)

const (
	AnsiReset = "\x1b[0m"
)

func TestGradient(t *testing.T) {

	colA := "#FF0000"
	colB := "#00FF00"

	var p Model
	var descr string

	for _, scale := range []bool{false, true} {
		opts := []Option{
			WithColorProfile(termenv.TrueColor), WithoutPercentage(),
		}
		if scale {
			descr = "progress bar with scaled gradient"
			opts = append(opts, WithScaledGradient(colA, colB))
		} else {
			descr = "progress bar with gradient"
			opts = append(opts, WithGradient(colA, colB))
		}

		t.Run(descr, func(t *testing.T) {
			p = New(opts...)

			// build the expected colors by colorizing an empty string and then cutting off the following reset sequence
			sb := strings.Builder{}
			sb.WriteString(termenv.String("").Foreground(p.color(colA)).String())
			expFirst := strings.Split(sb.String(), AnsiReset)[0]
			sb.Reset()
			sb.WriteString(termenv.String("").Foreground(p.color(colB)).String())
			expLast := strings.Split(sb.String(), AnsiReset)[0]

			for _, width := range []int{3, 5, 50} {
				p.Width = width
				res := p.ViewAs(1.0)

				// extract colors from the progrss bar by splitting at p.Full+AnsiReset, leaving us with just the color sequences
				colors := strings.Split(res, string(p.Full)+AnsiReset)

				// discard the last color, because it is empty (no new color comes after the last char of the bar)
				colors = colors[0 : len(colors)-1]

				if expFirst != colors[0] {
					t.Errorf("expected first color of bar to be first gradient color %q, instead got %q", expFirst, colors[0])
				}

				if expLast != colors[len(colors)-1] {
					t.Errorf("expected last color of bar to be second gradient color %q, instead got %q", expLast, colors[len(colors)-1])
				}
			}
		})
	}

}
