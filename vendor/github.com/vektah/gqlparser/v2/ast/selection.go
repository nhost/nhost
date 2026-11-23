package ast

type SelectionSet []Selection

type Selection interface {
	isSelection()
	GetPosition() *Position
}

func (*Field) isSelection()          {}
func (*FragmentSpread) isSelection() {}
func (*InlineFragment) isSelection() {}

func (f *Field) GetPosition() *Position          { return f.Position }
func (s *FragmentSpread) GetPosition() *Position { return s.Position }
func (f *InlineFragment) GetPosition() *Position { return f.Position }

type Field struct {
	Alias        string
	Name         string
	Arguments    ArgumentList
	Directives   DirectiveList
	SelectionSet SelectionSet
	Position     *Position `dump:"-" json:"-"`
	Comment      *CommentGroup

	// Require validation
	Definition       *FieldDefinition
	ObjectDefinition *Definition
}

type Argument struct {
	Name     string
	Value    *Value
	Position *Position `dump:"-" json:"-"`
	Comment  *CommentGroup
}

// ArgumentMap resolves the field's arguments and default values into a map, panicking on error.
func (f *Field) ArgumentMap(vars map[string]any) map[string]any {
	m, err := f.TryArgumentMap(vars)
	if err != nil {
		panic(err)
	}
	return m
}

// TryArgumentMap resolves the field's arguments and default values into a map.
func (f *Field) TryArgumentMap(vars map[string]any) (map[string]any, error) {
	if f.Definition == nil {
		return nil, nil
	}
	return arg2map(f.Definition.Arguments, f.Arguments, vars)
}
