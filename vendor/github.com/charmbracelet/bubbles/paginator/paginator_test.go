package paginator

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNew(t *testing.T) {
	model := New()

	if model.PerPage != 1 {
		t.Errorf("PerPage = %d, expected %d", model.PerPage, 1)
	}
	if model.TotalPages != 1 {
		t.Errorf("TotalPages = %d, expected %d", model.TotalPages, 1)
	}

	perPage := 42
	totalPages := 42

	model = New(
		WithPerPage(perPage),
		WithTotalPages(totalPages),
	)

	if model.PerPage != perPage {
		t.Errorf("PerPage = %d, expected %d", model.PerPage, perPage)
	}
	if model.TotalPages != totalPages {
		t.Errorf("TotalPages = %d, expected %d", model.TotalPages, totalPages)
	}
}

func TestSetTotalPages(t *testing.T) {
	tests := []struct {
		name         string
		items        int // total no of items to be set
		initialTotal int // intital total pages for the testcase
		expected     int // expected value after SetTotalPages function call
	}{
		{"Less than one page", 5, 1, 5},
		{"Exactly one page", 10, 1, 10},
		{"More than one page", 15, 1, 15},
		{"negative value for page", -10, 1, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model := New()
			if model.TotalPages != tt.initialTotal {
				model.SetTotalPages(tt.initialTotal)
			}
			model.SetTotalPages(tt.items)
			if model.TotalPages != tt.expected {
				t.Errorf("TotalPages = %d, expected %d", model.TotalPages, tt.expected)
			}
		})
	}
}

func TestPrevPage(t *testing.T) {
	tests := []struct {
		name       string
		totalPages int // Total pages to be set for the testcase
		page       int // intital page for test
		expected   int
	}{
		{"Go to previous page", 10, 1, 0},
		{"Stay on first page", 5, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model := New()
			model.SetTotalPages(tt.totalPages)
			model.Page = tt.page

			model, _ = model.Update(tea.KeyMsg{Type: tea.KeyLeft, Alt: false, Runes: []rune{}})
			if model.Page != tt.expected {
				t.Errorf("PrevPage() = %d, expected %d", model.Page, tt.expected)
			}
		})
	}
}

func TestNextPage(t *testing.T) {
	tests := []struct {
		name       string
		totalPages int
		page       int
		expected   int
	}{
		{"Go to next page", 2, 0, 1},
		{"Stay on last page", 2, 1, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model := New()
			model.SetTotalPages(tt.totalPages)
			model.Page = tt.page

			model, _ = model.Update(tea.KeyMsg{Type: tea.KeyRight, Alt: false, Runes: []rune{}})
			if model.Page != tt.expected {
				t.Errorf("NextPage() = %d, expected %d", model.Page, tt.expected)
			}
		})
	}
}

func TestOnLastPage(t *testing.T) {
	tests := []struct {
		name       string
		page       int
		totalPages int
		expected   bool
	}{
		{"On last page", 1, 2, true},
		{"Not on last page", 0, 2, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model := New()
			model.SetTotalPages(tt.totalPages)
			model.Page = tt.page

			if result := model.OnLastPage(); result != tt.expected {
				t.Errorf("OnLastPage() = %t, expected %t", result, tt.expected)
			}
		})
	}
}

func TestOnFirstPage(t *testing.T) {
	tests := []struct {
		name       string
		page       int
		totalPages int
		expected   bool
	}{
		{"On first page", 0, 2, true},
		{"Not on first page", 1, 2, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model := New()
			model.SetTotalPages(tt.totalPages)
			model.Page = tt.page

			if result := model.OnFirstPage(); result != tt.expected {
				t.Errorf("OnFirstPage() = %t, expected %t", result, tt.expected)
			}
		})
	}
}

func TestItemsOnPage(t *testing.T) {
	testCases := []struct {
		currentPage   int // current page to be set for the testcase
		totalPages    int // Total pages to be set for the testcase
		totalItems    int // Total items
		expectedItems int // expected items on current page
	}{
		{1, 10, 10, 1},
		{3, 10, 10, 1},
		{7, 10, 10, 1},
	}

	for _, tc := range testCases {
		model := New()
		model.Page = tc.currentPage
		model.SetTotalPages(tc.totalPages)
		if actualItems := model.ItemsOnPage(tc.totalItems); actualItems != tc.expectedItems {
			t.Errorf("ItemsOnPage() returned %d, expected %d for total items %d", actualItems, tc.expectedItems, tc.totalItems)
		}
	}
}
