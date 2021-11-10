package util

import "fmt"

const (
	GEAR      = "⚙"
	CHECK     = "✔"
	CANCEL    = "✘"
	INFO      = "ℹ"
	WARN      = "⚠"
	ERROR     = "✖"
	HOURGLASS = "⌛"
)

//	Returns the icon formatted in the specified color.
func GetIcon(unicode, colour string) string {
	return fmt.Sprintf("%s%s%s", colour, unicode, Reset)
}
