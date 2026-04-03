package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type PickerItem struct {
	Label    string
	Desc     string
	Value    any
	Selected bool
}

type pickerModel struct {
	title    string
	items    []PickerItem
	cursor   int
	chosen   int
	quitted  bool
	spinner  spinner.Model
}

func newPickerModel(title string, items []PickerItem) pickerModel {
	return pickerModel{
		title:   title,
		items:   items,
		cursor:  0,
		chosen:  -1,
		quitted: false,
		spinner: spinner.New(
			spinner.WithSpinner(spinner.Dot),
			spinner.WithStyle(lipgloss.NewStyle().Foreground(colorCyan)),
		),
	}
}

func (m pickerModel) Init() tea.Cmd {
	return nil
}

func (m pickerModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	km, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}

	return m.handlePickerKey(km)
}

func (m pickerModel) handlePickerKey( //nolint:ireturn
	msg tea.KeyMsg,
) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}
	case "down", "j":
		if m.cursor < len(m.items)-1 {
			m.cursor++
		}
	case "enter":
		m.chosen = m.cursor

		return m, tea.Quit
	case "q", "esc", "ctrl+c":
		m.quitted = true

		return m, tea.Quit
	}

	return m, nil
}

func (m pickerModel) View() string {
	var b strings.Builder

	b.WriteString("\n")
	b.WriteString(sectionTitle.Render("  "+m.title) + "\n\n")

	for i, item := range m.items {
		b.WriteString(renderPickerItem(item, i == m.cursor))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(helpStyle.Render(
		"  "+helpKey.Render("\u2191\u2193")+" navigate "+
			helpKey.Render("enter")+" select "+
			helpKey.Render("q")+" cancel",
	))
	b.WriteString("\n")

	return b.String()
}

func renderPickerItem(item PickerItem, active bool) string {
	if active {
		return renderPickerItemActive(item)
	}

	return renderPickerItemInactive(item)
}

func renderPickerItemActive(item PickerItem) string {
	row := lipgloss.NewStyle().Bold(true)
	cursor := lipgloss.NewStyle().Foreground(colorCyan).Render("\u25b8 ")
	line := cursor + row.Render(item.Label)

	if item.Desc != "" {
		line += "  " + row.Foreground(colorGray).Render(item.Desc)
	}

	return "  " + line
}

func renderPickerItemInactive(item PickerItem) string {
	line := "    " + item.Label

	if item.Desc != "" {
		line += "  " + lipgloss.NewStyle().Foreground(colorGray).Render(item.Desc)
	}

	return "  " + line
}

var ErrPickerCancelled = fmt.Errorf("selection cancelled") //nolint:err113,gochecknoglobals

func RunPicker(title string, items []PickerItem) (int, error) {
	m := newPickerModel(title, items)
	p := tea.NewProgram(m)

	finalModel, err := p.Run()
	if err != nil {
		return -1, fmt.Errorf("picker error: %w", err)
	}

	fm, ok := finalModel.(pickerModel)
	if !ok || fm.quitted || fm.chosen < 0 {
		return -1, ErrPickerCancelled
	}

	return fm.chosen, nil
}
