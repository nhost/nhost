package ansi

import (
	"strconv"
	"strings"
)

const (
	// ResizeWindowWinOp is a window operation that resizes the terminal
	// window.
	ResizeWindowWinOp = 4

	// ReportWindowSizeWinOp is a window operation that reports the size of the
	// terminal window in pixels.
	ReportWindowSizeWinOp = 14
)

// WindowOp (XTWINOPS) is a sequence that manipulates the terminal window.
//
//	CSI Ps ; Ps ; Ps t
//
// Ps is a semicolon-separated list of parameters.
// See https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h4-Functions-using-CSI-_-ordered-by-the-final-character-lparen-s-rparen:CSI-Ps;Ps;Ps-t.1EB0
func WindowOp(p int, ps ...int) string {
	if p <= 0 {
		return ""
	}

	if len(ps) == 0 {
		return "\x1b[" + strconv.Itoa(p) + "t"
	}

	params := make([]string, 0, len(ps)+1)
	params = append(params, strconv.Itoa(p))
	for _, p := range ps {
		if p >= 0 {
			params = append(params, strconv.Itoa(p))
		}
	}

	return "\x1b[" + strings.Join(params, ";") + "t"
}

// XTWINOPS is an alias for [WindowOp].
func XTWINOPS(p int, ps ...int) string {
	return WindowOp(p, ps...)
}
