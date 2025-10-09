// Package pathpattern implements path matching.
//
// Examples of supported patterns:
//   - "/"
//   - "/abc""
//   - "/abc/{variable}" (matches until next '/' or end-of-string)
//   - "/abc/{variable*}" (matches everything, including "/abc" if "/abc" has root)
//   - "/abc/{ variable | prefix_(.*}_suffix }" (matches regular expressions)
package pathpattern

import (
	"bytes"
	"fmt"
	"regexp"
	"sort"
	"strings"
)

var DefaultOptions = &Options{
	SupportWildcard: true,
}

type Options struct {
	SupportWildcard bool
	SupportRegExp   bool
}

// PathFromHost converts a host pattern to a path pattern.
//
// Examples:
//   - PathFromHost("some-subdomain.domain.com", false) -> "com/./domain/./some-subdomain"
//   - PathFromHost("some-subdomain.domain.com", true) -> "com/./domain/./subdomain/-/some"
func PathFromHost(host string, specialDashes bool) string {
	buf := make([]byte, 0, len(host))
	end := len(host)

	// Go from end to start
	for start := end - 1; start >= 0; start-- {
		switch host[start] {
		case '.':
			buf = append(buf, host[start+1:end]...)
			buf = append(buf, '/', '.', '/')
			end = start
		case '-':
			if specialDashes {
				buf = append(buf, host[start+1:end]...)
				buf = append(buf, '/', '-', '/')
				end = start
			}
		}
	}
	buf = append(buf, host[:end]...)
	return string(buf)
}

type Node struct {
	VariableNames []string
	Value         any
	Suffixes      SuffixList
}

func (currentNode *Node) String() string {
	buf := bytes.NewBuffer(make([]byte, 0, 255))
	currentNode.toBuffer(buf, "")
	return buf.String()
}

func (currentNode *Node) toBuffer(buf *bytes.Buffer, linePrefix string) {
	if value := currentNode.Value; value != nil {
		buf.WriteString(linePrefix)
		buf.WriteString("VALUE: ")
		fmt.Fprint(buf, value)
		buf.WriteString("\n")
	}
	suffixes := currentNode.Suffixes
	if len(suffixes) > 0 {
		newLinePrefix := linePrefix + "  "
		for _, suffix := range suffixes {
			buf.WriteString(linePrefix)
			buf.WriteString("PATTERN: ")
			buf.WriteString(suffix.String())
			buf.WriteString("\n")
			suffix.Node.toBuffer(buf, newLinePrefix)
		}
	}
}

type SuffixKind int

// Note that order is important!
const (
	// SuffixKindConstant matches a constant string
	SuffixKindConstant = SuffixKind(iota)

	// SuffixKindRegExp matches a regular expression
	SuffixKindRegExp

	// SuffixKindVariable matches everything until '/'
	SuffixKindVariable

	// SuffixKindEverything matches everything (until end-of-string)
	SuffixKindEverything
)

// Suffix describes condition that
type Suffix struct {
	Kind    SuffixKind
	Pattern string

	// compiled regular expression
	regExp *regexp.Regexp

	// Next node
	Node *Node
}

func EqualSuffix(a, b Suffix) bool {
	return a.Kind == b.Kind && a.Pattern == b.Pattern
}

func (suffix Suffix) String() string {
	switch suffix.Kind {
	case SuffixKindConstant:
		return suffix.Pattern
	case SuffixKindVariable:
		return "{_}"
	case SuffixKindEverything:
		return "{_*}"
	default:
		return "{_|" + suffix.Pattern + "}"
	}
}

type SuffixList []Suffix

func (list SuffixList) Less(i, j int) bool {
	a, b := list[i], list[j]
	ak, bk := a.Kind, b.Kind
	if ak < bk {
		return true
	} else if bk < ak {
		return false
	}
	return a.Pattern > b.Pattern
}

func (list SuffixList) Len() int {
	return len(list)
}

func (list SuffixList) Swap(i, j int) {
	a, b := list[i], list[j]
	list[i], list[j] = b, a
}

func (currentNode *Node) MustAdd(path string, value any, options *Options) {
	node, err := currentNode.CreateNode(path, options)
	if err != nil {
		panic(err)
	}
	node.Value = value
}

func (currentNode *Node) Add(path string, value any, options *Options) error {
	node, err := currentNode.CreateNode(path, options)
	if err != nil {
		return err
	}
	node.Value = value
	return nil
}

func (currentNode *Node) CreateNode(path string, options *Options) (*Node, error) {
	if options == nil {
		options = DefaultOptions
	}
	for strings.HasSuffix(path, "/") {
		path = path[:len(path)-1]
	}
	remaining := path
	var variableNames []string
loop:
	for {
		//remaining = strings.TrimPrefix(remaining, "/")
		if len(remaining) == 0 {
			// This node is the right one
			// Check whether another route already leads to this node
			currentNode.VariableNames = variableNames
			return currentNode, nil
		}

		suffix := Suffix{}
		var i int
		if strings.HasPrefix(remaining, "/") {
			remaining = remaining[1:]
			suffix.Kind = SuffixKindConstant
			suffix.Pattern = "/"
		} else {
			i = strings.IndexAny(remaining, "/{")
			if i < 0 {
				i = len(remaining)
			}
			if i > 0 {
				// Constant string pattern
				suffix.Kind = SuffixKindConstant
				suffix.Pattern = remaining[:i]
				remaining = remaining[i:]
			} else if remaining[0] == '{' {
				// This is probably a variable
				suffix.Kind = SuffixKindVariable

				// Find variable name
				i := strings.IndexByte(remaining, '}')
				if i < 0 {
					return nil, fmt.Errorf("missing '}' in: %s", path)
				}
				variableName := strings.TrimSpace(remaining[1:i])
				remaining = remaining[i+1:]

				if options.SupportRegExp {
					// See if it has regular expression
					i = strings.IndexByte(variableName, '|')
					if i >= 0 {
						suffix.Kind = SuffixKindRegExp
						suffix.Pattern = strings.TrimSpace(variableName[i+1:])
						variableName = strings.TrimSpace(variableName[:i])
					}
				}
				if suffix.Kind == SuffixKindVariable && options.SupportWildcard {
					if strings.HasSuffix(variableName, "*") {
						suffix.Kind = SuffixKindEverything
					}
				}
				variableNames = append(variableNames, variableName)
			}
		}

		// Find existing matcher
		for _, existing := range currentNode.Suffixes {
			if EqualSuffix(existing, suffix) {
				currentNode = existing.Node
				continue loop
			}
		}

		// Compile regular expression
		if suffix.Kind == SuffixKindRegExp {
			regExp, err := regexp.Compile(suffix.Pattern)
			if err != nil {
				return nil, fmt.Errorf("invalid regular expression in: %s", path)
			}
			suffix.regExp = regExp
		}

		// Create new node
		newNode := &Node{}
		suffix.Node = newNode
		currentNode.Suffixes = append(currentNode.Suffixes, suffix)
		sort.Sort(currentNode.Suffixes)
		currentNode = newNode
		continue loop
	}
}

func (currentNode *Node) Match(path string) (*Node, []string) {
	for strings.HasSuffix(path, "/") {
		path = path[:len(path)-1]
	}
	variableValues := make([]string, 0, 8)
	return currentNode.matchRemaining(path, variableValues)
}

func (currentNode *Node) matchRemaining(remaining string, paramValues []string) (*Node, []string) {
	// Check if this node matches
	if len(remaining) == 0 && currentNode.Value != nil {
		return currentNode, paramValues
	}

	// See if any suffix  matches
	for _, suffix := range currentNode.Suffixes {
		var resultNode *Node
		var resultValues []string
		switch suffix.Kind {
		case SuffixKindConstant:
			pattern := suffix.Pattern
			if strings.HasPrefix(remaining, pattern) {
				newRemaining := remaining[len(pattern):]
				resultNode, resultValues = suffix.Node.matchRemaining(newRemaining, paramValues)
			} else if len(remaining) == 0 && pattern == "/" {
				resultNode, resultValues = suffix.Node.matchRemaining(remaining, paramValues)
			}
		case SuffixKindVariable:
			i := strings.IndexByte(remaining, '/')
			if i < 0 {
				i = len(remaining)
			}
			newParamValues := append(paramValues, remaining[:i])
			newRemaining := remaining[i:]
			resultNode, resultValues = suffix.Node.matchRemaining(newRemaining, newParamValues)
		case SuffixKindEverything:
			newParamValues := append(paramValues, remaining)
			resultNode, resultValues = suffix.Node, newParamValues
		case SuffixKindRegExp:
			i := strings.IndexByte(remaining, '/')
			if i < 0 {
				i = len(remaining)
			}
			paramValue := remaining[:i]
			regExp := suffix.regExp
			if regExp.MatchString(paramValue) {
				matches := regExp.FindStringSubmatch(paramValue)
				if len(matches) > 1 {
					paramValue = matches[1]
				}
				newParamValues := append(paramValues, paramValue)
				newRemaining := remaining[i:]
				resultNode, resultValues = suffix.Node.matchRemaining(newRemaining, newParamValues)
			}
		}
		if resultNode != nil && resultNode.Value != nil {
			// This suffix matched
			return resultNode, resultValues
		}
	}

	// No suffix matched
	return nil, nil
}
