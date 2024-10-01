package ansi

// This file define uses multiple sequences to set (SM), reset (RM), and request
// (DECRQM) different ANSI and DEC modes.
//
// See: https://vt100.net/docs/vt510-rm/SM.html
// See: https://vt100.net/docs/vt510-rm/RM.html
// See: https://vt100.net/docs/vt510-rm/DECRQM.html
//
// The terminal then responds to the request with a Report Mode function
// (DECRPM) in the format:
//
// ANSI format:
//
//  CSI Pa ; Ps ; $ y
//
// DEC format:
//
//  CSI ? Pa ; Ps $ y
//
// Where Pa is the mode number, and Ps is the mode value.
// See: https://vt100.net/docs/vt510-rm/DECRPM.html

// Application Cursor Keys (DECCKM) is a mode that determines whether the
// cursor keys send ANSI cursor sequences or application sequences.
//
// See: https://vt100.net/docs/vt510-rm/DECCKM.html
const (
	CursorKeysMode = "?1"

	EnableCursorKeys  = "\x1b[" + CursorKeysMode + "h"
	DisableCursorKeys = "\x1b[" + CursorKeysMode + "l"
	RequestCursorKeys = "\x1b[" + CursorKeysMode + "$p"
)

// Text Cursor Enable Mode (DECTCEM) is a mode that shows/hides the cursor.
//
// See: https://vt100.net/docs/vt510-rm/DECTCEM.html
const (
	CursorVisibilityMode = "?25"

	ShowCursor              = "\x1b[" + CursorVisibilityMode + "h"
	HideCursor              = "\x1b[" + CursorVisibilityMode + "l"
	RequestCursorVisibility = "\x1b[" + CursorVisibilityMode + "$p"
)

// VT Mouse Tracking is a mode that determines whether the mouse reports on
// button press and release.
//
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking
const (
	MouseMode = "?1000"

	EnableMouse  = "\x1b[" + MouseMode + "h"
	DisableMouse = "\x1b[" + MouseMode + "l"
	RequestMouse = "\x1b[" + MouseMode + "$p"
)

// VT Hilite Mouse Tracking is a mode that determines whether the mouse reports on
// button presses, releases, and highlighted cells.
//
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking
const (
	MouseHiliteMode = "?1001"

	EnableMouseHilite  = "\x1b[" + MouseHiliteMode + "h"
	DisableMouseHilite = "\x1b[" + MouseHiliteMode + "l"
	RequestMouseHilite = "\x1b[" + MouseHiliteMode + "$p"
)

// Cell Motion Mouse Tracking is a mode that determines whether the mouse
// reports on button press, release, and motion events.
//
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking
const (
	MouseCellMotionMode = "?1002"

	EnableMouseCellMotion  = "\x1b[" + MouseCellMotionMode + "h"
	DisableMouseCellMotion = "\x1b[" + MouseCellMotionMode + "l"
	RequestMouseCellMotion = "\x1b[" + MouseCellMotionMode + "$p"
)

// All Mouse Tracking is a mode that determines whether the mouse reports on
// button press, release, motion, and highlight events.
//
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking
const (
	MouseAllMotionMode = "?1003"

	EnableMouseAllMotion  = "\x1b[" + MouseAllMotionMode + "h"
	DisableMouseAllMotion = "\x1b[" + MouseAllMotionMode + "l"
	RequestMouseAllMotion = "\x1b[" + MouseAllMotionMode + "$p"
)

// Report Focus is a mode that makes the terminal report focus-in and focus-out events.
//
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-FocusIn_FocusOut
const (
	ReportFocusMode = "?1004"

	EnableReportFocus  = "\x1b[" + ReportFocusMode + "h"
	DisableReportFocus = "\x1b[" + ReportFocusMode + "l"
	RequestReportFocus = "\x1b[" + ReportFocusMode + "$p"
)

// SGR Mouse Extension is a mode that determines whether the mouse reports events
// formatted with SGR parameters.
//
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking
const (
	MouseSgrExtMode = "?1006"

	EnableMouseSgrExt  = "\x1b[" + MouseSgrExtMode + "h"
	DisableMouseSgrExt = "\x1b[" + MouseSgrExtMode + "l"
	RequestMouseSgrExt = "\x1b[" + MouseSgrExtMode + "$p"
)

// Alternate Screen Buffer is a mode that determines whether the alternate screen
// buffer is active.
//
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-The-Alternate-Screen-Buffer
const (
	AltScreenBufferMode = "?1049"

	EnableAltScreenBuffer  = "\x1b[" + AltScreenBufferMode + "h"
	DisableAltScreenBuffer = "\x1b[" + AltScreenBufferMode + "l"
	RequestAltScreenBuffer = "\x1b[" + AltScreenBufferMode + "$p"
)

// Bracketed Paste Mode is a mode that determines whether pasted text is
// bracketed with escape sequences.
//
// See: https://cirw.in/blog/bracketed-paste
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Bracketed-Paste-Mode
const (
	BracketedPasteMode = "?2004"

	EnableBracketedPaste  = "\x1b[" + BracketedPasteMode + "h"
	DisableBracketedPaste = "\x1b[" + BracketedPasteMode + "l"
	RequestBracketedPaste = "\x1b[" + BracketedPasteMode + "$p"
)

// Synchronized Output Mode is a mode that determines whether output is
// synchronized with the terminal.
//
// See: https://gist.github.com/christianparpart/d8a62cc1ab659194337d73e399004036
const (
	SyncdOutputMode = "?2026"

	EnableSyncdOutput  = "\x1b[" + SyncdOutputMode + "h"
	DisableSyncdOutput = "\x1b[" + SyncdOutputMode + "l"
	RequestSyncdOutput = "\x1b[" + SyncdOutputMode + "$p"
)

// Grapheme Clustering Mode is a mode that determines whether the terminal
// should look for grapheme clusters instead of single runes in the rendered
// text. This makes the terminal properly render combining characters such as
// emojis.
//
// See: https://github.com/contour-terminal/terminal-unicode-core
const (
	GraphemeClusteringMode = "?2027"

	EnableGraphemeClustering  = "\x1b[" + GraphemeClusteringMode + "h"
	DisableGraphemeClustering = "\x1b[" + GraphemeClusteringMode + "l"
	RequestGraphemeClustering = "\x1b[" + GraphemeClusteringMode + "$p"
)

// Win32Input is a mode that determines whether input is processed by the
// Win32 console and Conpty.
//
// See: https://github.com/microsoft/terminal/blob/main/doc/specs/%234999%20-%20Improved%20keyboard%20handling%20in%20Conpty.md
const (
	Win32InputMode = "?9001"

	EnableWin32Input  = "\x1b[" + Win32InputMode + "h"
	DisableWin32Input = "\x1b[" + Win32InputMode + "l"
	RequestWin32Input = "\x1b[" + Win32InputMode + "$p"
)
