package list

import (
	"fmt"
	"io"
	"reflect"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

type item string

func (i item) FilterValue() string { return string(i) }

type itemDelegate struct{}

func (d itemDelegate) Height() int                          { return 1 }
func (d itemDelegate) Spacing() int                         { return 0 }
func (d itemDelegate) Update(msg tea.Msg, m *Model) tea.Cmd { return nil }
func (d itemDelegate) Render(w io.Writer, m Model, index int, listItem Item) {
	i, ok := listItem.(item)
	if !ok {
		return
	}

	str := fmt.Sprintf("%d. %s", index+1, i)
	fmt.Fprint(w, m.Styles.TitleBar.Render(str))
}

func TestStatusBarItemName(t *testing.T) {
	list := New([]Item{item("foo"), item("bar")}, itemDelegate{}, 10, 10)
	expected := "2 items"
	if !strings.Contains(list.statusView(), expected) {
		t.Fatalf("Error: expected view to contain %s", expected)
	}

	list.SetItems([]Item{item("foo")})
	expected = "1 item"
	if !strings.Contains(list.statusView(), expected) {
		t.Fatalf("Error: expected view to contain %s", expected)
	}
}

func TestStatusBarWithoutItems(t *testing.T) {
	list := New([]Item{}, itemDelegate{}, 10, 10)

	expected := "No items"
	if !strings.Contains(list.statusView(), expected) {
		t.Fatalf("Error: expected view to contain %s", expected)
	}
}

func TestCustomStatusBarItemName(t *testing.T) {
	list := New([]Item{item("foo"), item("bar")}, itemDelegate{}, 10, 10)
	list.SetStatusBarItemName("connection", "connections")

	expected := "2 connections"
	if !strings.Contains(list.statusView(), expected) {
		t.Fatalf("Error: expected view to contain %s", expected)
	}

	list.SetItems([]Item{item("foo")})
	expected = "1 connection"
	if !strings.Contains(list.statusView(), expected) {
		t.Fatalf("Error: expected view to contain %s", expected)
	}

	list.SetItems([]Item{})
	expected = "No connections"
	if !strings.Contains(list.statusView(), expected) {
		t.Fatalf("Error: expected view to contain %s", expected)
	}
}

func TestSetFilterText(t *testing.T) {
	tc := []Item{item("foo"), item("bar"), item("baz")}

	list := New(tc, itemDelegate{}, 10, 10)
	list.SetFilterText("ba")

	list.SetFilterState(Unfiltered)
	expected := tc
	// TODO: replace with slices.Equal() when project move to go1.18 or later
	if !reflect.DeepEqual(list.VisibleItems(), expected) {
		t.Fatalf("Error: expected view to contain only %s", expected)
	}

	list.SetFilterState(Filtering)
	expected = []Item{item("bar"), item("baz")}
	if !reflect.DeepEqual(list.VisibleItems(), expected) {
		t.Fatalf("Error: expected view to contain only %s", expected)
	}

	list.SetFilterState(FilterApplied)
	if !reflect.DeepEqual(list.VisibleItems(), expected) {
		t.Fatalf("Error: expected view to contain only %s", expected)
	}
}

func TestSetFilterState(t *testing.T) {
	tc := []Item{item("foo"), item("bar"), item("baz")}

	list := New(tc, itemDelegate{}, 10, 10)
	list.SetFilterText("ba")

	list.SetFilterState(Unfiltered)
	expected, notExpected := "up", "clear filter"

	lines := strings.Split(list.View(), "\n")
	footer := lines[len(lines)-1]

	if !strings.Contains(footer, expected) || strings.Contains(footer, notExpected) {
		t.Fatalf("Error: expected view to contain '%s' not '%s'", expected, notExpected)
	}

	list.SetFilterState(Filtering)
	expected, notExpected = "filter", "more"

	lines = strings.Split(list.View(), "\n")
	footer = lines[len(lines)-1]

	if !strings.Contains(footer, expected) || strings.Contains(footer, notExpected) {
		t.Fatalf("Error: expected view to contain '%s' not '%s'", expected, notExpected)
	}

	list.SetFilterState(FilterApplied)
	expected = "clear"

	lines = strings.Split(list.View(), "\n")
	footer = lines[len(lines)-1]

	if !strings.Contains(footer, expected) {
		t.Fatalf("Error: expected view to contain '%s'", expected)
	}
}
