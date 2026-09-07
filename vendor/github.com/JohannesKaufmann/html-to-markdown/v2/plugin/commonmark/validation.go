package commonmark

import (
	"fmt"
	"strings"
)

func contains(values []string, searchVal string) bool {
	for _, val := range values {
		if val == searchVal {
			return true
		}
	}
	return false
}

// TODO: should this be with the commonmark package? Or more general?
// TODO: Maybe make it an interface? And also have a GetPluginName function?
type ValidateConfigError struct {
	Key   string
	Value string

	// By default is "Key:Value" but can be
	// overriden to e.g. "--key=value"
	KeyWithValue string

	patternDescription string
}

func (e *ValidateConfigError) setDefaultKeyWithValue() {
	e.KeyWithValue = fmt.Sprintf("%s:%q", e.Key, e.Value)
}
func (e *ValidateConfigError) Error() string {
	if e.KeyWithValue == "" {
		e.setDefaultKeyWithValue()
	}

	return fmt.Sprintf("invalid value for %s must be %s", e.KeyWithValue, e.patternDescription)
}

func validateConfig(cfg *config) error {
	if strings.Count(cfg.EmDelimiter, "_") != 1 && strings.Count(cfg.EmDelimiter, "*") != 1 {
		return &ValidateConfigError{
			Key:                "EmDelimiter",
			Value:              cfg.EmDelimiter,
			patternDescription: `exactly 1 character of "*" or "_"`,
		}
	}
	if strings.Count(cfg.StrongDelimiter, "_") != 2 && strings.Count(cfg.StrongDelimiter, "*") != 2 {
		return &ValidateConfigError{
			Key:                "StrongDelimiter",
			Value:              cfg.StrongDelimiter,
			patternDescription: `exactly 2 characters of "**" or "__"`,
		}
	}

	if strings.Count(cfg.HorizontalRule, "*") < 3 &&
		strings.Count(cfg.HorizontalRule, "_") < 3 &&
		strings.Count(cfg.HorizontalRule, "-") < 3 {
		return &ValidateConfigError{
			Key:                "HorizontalRule",
			Value:              cfg.HorizontalRule,
			patternDescription: `at least 3 characters of "*", "_" or "-"`,
		}
	}

	if !contains([]string{"-", "+", "*"}, cfg.BulletListMarker) {
		return &ValidateConfigError{
			Key:                "BulletListMarker",
			Value:              cfg.BulletListMarker,
			patternDescription: `one of "-", "+" or "*"`,
		}
	}

	if !contains([]string{"```", "~~~"}, cfg.CodeBlockFence) {
		return &ValidateConfigError{
			Key:                "CodeBlockFence",
			Value:              cfg.CodeBlockFence,
			patternDescription: "one of \"```\" or \"~~~\"",
		}
	}

	if !contains([]string{"atx", "setext"}, string(cfg.HeadingStyle)) {
		return &ValidateConfigError{
			Key:                "HeadingStyle",
			Value:              string(cfg.HeadingStyle),
			patternDescription: `one of "atx" or "setext"`,
		}
	}

	possibleLinkStyles := []string{string(LinkStyleInlined), string(LinkStyleReferencedIndex), string(LinkStyleReferencedShort)}
	if !contains(possibleLinkStyles, string(cfg.LinkStyle)) {
		return &ValidateConfigError{
			Key:                "LinkStyle",
			Value:              string(cfg.LinkStyle),
			patternDescription: `one of "inlined", "referenced_index" or "referenced_short"`,
		}
	}

	return nil
}
