package table

import (
	"testing"

	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
	"github.com/charmbracelet/x/exp/golden"
)

func TestFromValues(t *testing.T) {
	input := "foo1,bar1\nfoo2,bar2\nfoo3,bar3"
	table := New(WithColumns([]Column{{Title: "Foo"}, {Title: "Bar"}}))
	table.FromValues(input, ",")

	if len(table.rows) != 3 {
		t.Fatalf("expect table to have 3 rows but it has %d", len(table.rows))
	}

	expect := []Row{
		{"foo1", "bar1"},
		{"foo2", "bar2"},
		{"foo3", "bar3"},
	}
	if !deepEqual(table.rows, expect) {
		t.Fatal("table rows is not equals to the input")
	}
}

func TestFromValuesWithTabSeparator(t *testing.T) {
	input := "foo1.\tbar1\nfoo,bar,baz\tbar,2"
	table := New(WithColumns([]Column{{Title: "Foo"}, {Title: "Bar"}}))
	table.FromValues(input, "\t")

	if len(table.rows) != 2 {
		t.Fatalf("expect table to have 2 rows but it has %d", len(table.rows))
	}

	expect := []Row{
		{"foo1.", "bar1"},
		{"foo,bar,baz", "bar,2"},
	}
	if !deepEqual(table.rows, expect) {
		t.Fatal("table rows is not equals to the input")
	}
}

func deepEqual(a, b []Row) bool {
	if len(a) != len(b) {
		return false
	}
	for i, r := range a {
		for j, f := range r {
			if f != b[i][j] {
				return false
			}
		}
	}
	return true
}

var cols = []Column{
	{Title: "col1", Width: 10},
	{Title: "col2", Width: 10},
	{Title: "col3", Width: 10},
}

func TestRenderRow(t *testing.T) {
	tests := []struct {
		name     string
		table    *Model
		expected string
	}{
		{
			name: "simple row",
			table: &Model{
				rows:   []Row{{"Foooooo", "Baaaaar", "Baaaaaz"}},
				cols:   cols,
				styles: Styles{Cell: lipgloss.NewStyle()},
			},
			expected: "Foooooo   Baaaaar   Baaaaaz   ",
		},
		{
			name: "simple row with truncations",
			table: &Model{
				rows:   []Row{{"Foooooooooo", "Baaaaaaaaar", "Quuuuuuuuux"}},
				cols:   cols,
				styles: Styles{Cell: lipgloss.NewStyle()},
			},
			expected: "Foooooooo…Baaaaaaaa…Quuuuuuuu…",
		},
		{
			name: "simple row avoiding truncations",
			table: &Model{
				rows:   []Row{{"Fooooooooo", "Baaaaaaaar", "Quuuuuuuux"}},
				cols:   cols,
				styles: Styles{Cell: lipgloss.NewStyle()},
			},
			expected: "FoooooooooBaaaaaaaarQuuuuuuuux",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			row := tc.table.renderRow(0)
			if row != tc.expected {
				t.Fatalf("\n\nWant: \n%s\n\nGot:  \n%s\n", tc.expected, row)
			}
		})
	}
}

func TestTableAlignment(t *testing.T) {
	t.Run("No border", func(t *testing.T) {
		biscuits := New(
			WithHeight(5),
			WithColumns([]Column{
				{Title: "Name", Width: 25},
				{Title: "Country of Origin", Width: 16},
				{Title: "Dunk-able", Width: 12},
			}),
			WithRows([]Row{
				{"Chocolate Digestives", "UK", "Yes"},
				{"Tim Tams", "Australia", "No"},
				{"Hobnobs", "UK", "Yes"},
			}),
		)
		got := ansi.Strip(biscuits.View())
		golden.RequireEqual(t, []byte(got))
	})
	t.Run("With border", func(t *testing.T) {
		baseStyle := lipgloss.NewStyle().
			BorderStyle(lipgloss.NormalBorder()).
			BorderForeground(lipgloss.Color("240"))

		s := DefaultStyles()
		s.Header = s.Header.
			BorderStyle(lipgloss.NormalBorder()).
			BorderForeground(lipgloss.Color("240")).
			BorderBottom(true).
			Bold(false)

		biscuits := New(
			WithHeight(5),
			WithColumns([]Column{
				{Title: "Name", Width: 25},
				{Title: "Country of Origin", Width: 16},
				{Title: "Dunk-able", Width: 12},
			}),
			WithRows([]Row{
				{"Chocolate Digestives", "UK", "Yes"},
				{"Tim Tams", "Australia", "No"},
				{"Hobnobs", "UK", "Yes"},
			}),
			WithStyles(s),
		)
		got := ansi.Strip(baseStyle.Render(biscuits.View()))
		golden.RequireEqual(t, []byte(got))
	})
}
