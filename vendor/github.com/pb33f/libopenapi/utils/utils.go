package utils

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/speakeasy-api/jsonpath/pkg/jsonpath"
	jsonpathconfig "github.com/speakeasy-api/jsonpath/pkg/jsonpath/config"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Case int8

const (
	// OpenApi3 is used by all OpenAPI 3+ docs
	OpenApi3 = "openapi"

	// OpenApi2 is used by all OpenAPI 2 docs, formerly known as swagger.
	OpenApi2 = "swagger"

	// AsyncApi is used by akk AsyncAPI docs, all versions.
	AsyncApi = "asyncapi"

	PascalCase Case = iota
	CamelCase
	ScreamingSnakeCase
	SnakeCase
	KebabCase
	ScreamingKebabCase
	RegularCase
	UnknownCase
)

// FindNodes will find a node based on JSONPath, it accepts raw yaml/json as input.
func FindNodes(yamlData []byte, jsonPath string) ([]*yaml.Node, error) {
	jsonPath = FixContext(jsonPath)

	var node yaml.Node
	yaml.Unmarshal(yamlData, &node)

	path, err := jsonpath.NewPath(jsonPath, jsonpathconfig.WithPropertyNameExtension())
	if err != nil {
		return nil, err
	}
	results := path.Query(&node)
	return results, nil
}

// FindLastChildNode will find the last node in a tree, based on a starting node.
// Deprecated: This function is deprecated, use FindLastChildNodeWithLevel instead.
// this has the potential to cause a stack overflow, so use with caution. It will be removed later.
func FindLastChildNode(node *yaml.Node) *yaml.Node {
	s := len(node.Content) - 1
	if s < 0 {
		s = 0
	}
	if len(node.Content) > 0 && len(node.Content[s].Content) > 0 {
		return FindLastChildNode(node.Content[s])
	} else {
		if len(node.Content) > 0 {
			return node.Content[s]
		}
		return node
	}
}

// FindLastChildNodeWithLevel will find the last node in a tree, based on a starting node.
// Will stop searching after 100 levels, because that's just silly, we probably have a loop.
func FindLastChildNodeWithLevel(node *yaml.Node, level int) *yaml.Node {
	if level > 100 {
		return node // we've gone too far, give up.
	}
	s := len(node.Content) - 1
	if s < 0 {
		s = 0
	}
	if len(node.Content) > 0 && len(node.Content[s].Content) > 0 {
		level++
		return FindLastChildNodeWithLevel(node.Content[s], level)
	} else {
		if len(node.Content) > 0 {
			return node.Content[s]
		}
		return node
	}
}

// BuildPath will construct a JSONPath from a base and an array of strings.
func BuildPath(basePath string, segs []string) string {
	path := strings.Join(segs, ".")

	// trim that last period.
	if len(path) > 0 && path[len(path)-1] == '.' {
		path = path[:len(path)-1]
	}
	return fmt.Sprintf("%s.%s", basePath, path)
}

// FindNodesWithoutDeserializing will find a node based on JSONPath, without deserializing from yaml/json
// This function will timeout after 500ms.
func FindNodesWithoutDeserializing(node *yaml.Node, jsonPath string) ([]*yaml.Node, error) {
	return FindNodesWithoutDeserializingWithTimeout(node, jsonPath, 500*time.Millisecond)
}

// FindNodesWithoutDeserializingWithTimeout will find a node based on JSONPath, without deserializing from yaml/json
// This function can be customized with a timeout.
func FindNodesWithoutDeserializingWithTimeout(node *yaml.Node, jsonPath string, timeout time.Duration) ([]*yaml.Node, error) {
	jsonPath = FixContext(jsonPath)

	path, err := jsonpath.NewPath(jsonPath, jsonpathconfig.WithPropertyNameExtension())
	if err != nil {
		return nil, err
	}

	// this can spin out, to lets gatekeep it.
	done := make(chan struct{})
	var results []*yaml.Node
	to, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	go func(d chan struct{}) {
		results = path.Query(node)
		done <- struct{}{}
	}(done)

	select {
	case <-done:
		return results, nil
	case <-to.Done():
		return nil, fmt.Errorf("node lookup timeout exceeded (%v)", timeout)
	}
}

// ConvertInterfaceIntoStringMap will convert an unknown input into a string map.
func ConvertInterfaceIntoStringMap(context interface{}) map[string]string {
	converted := make(map[string]string)
	if context != nil {
		if v, ok := context.(map[string]interface{}); ok {
			for k, n := range v {
				if s, okB := n.(string); okB {
					converted[k] = s
				}
				if s, okB := n.(float64); okB {
					converted[k] = fmt.Sprint(s)
				}
				if s, okB := n.(bool); okB {
					converted[k] = fmt.Sprint(s)
				}
				if s, okB := n.(int); okB {
					converted[k] = fmt.Sprint(s)
				}
				if s, okB := n.(int64); okB {
					converted[k] = fmt.Sprint(s)
				}
			}
		}
		if v, ok := context.(map[string]string); ok {
			for k, n := range v {
				converted[k] = n
			}
		}
	}
	return converted
}

// ConvertInterfaceToStringArray will convert an unknown input map type into a string array/slice
func ConvertInterfaceToStringArray(raw interface{}) []string {
	if vals, ok := raw.(map[string]interface{}); ok {
		var s []string
		for _, v := range vals {
			if g, y := v.([]interface{}); y {
				for _, q := range g {
					s = append(s, fmt.Sprint(q))
				}
			}
		}
		return s
	}
	if vals, ok := raw.(map[string][]string); ok {
		var s []string
		for _, v := range vals {
			s = append(s, v...)
		}
		return s
	}
	return nil
}

// ConvertInterfaceArrayToStringArray will convert an unknown interface array type, into a string slice
func ConvertInterfaceArrayToStringArray(raw interface{}) []string {
	if vals, ok := raw.([]interface{}); ok {
		s := make([]string, len(vals))
		for i, v := range vals {
			s[i] = fmt.Sprint(v)
		}
		return s
	}
	if vals, ok := raw.([]string); ok {
		return vals
	}
	return nil
}

// ExtractValueFromInterfaceMap pulls out an unknown value from a map using a string key
func ExtractValueFromInterfaceMap(name string, raw interface{}) interface{} {
	if propMap, ok := raw.(map[string]interface{}); ok {
		if props, okn := propMap[name].([]interface{}); okn {
			return props
		} else {
			return propMap[name]
		}
	}
	if propMap, ok := raw.(map[string][]string); ok {
		return propMap[name]
	}

	return nil
}

// FindFirstKeyNode will locate the first key and value yaml.Node based on a key.
func FindFirstKeyNode(key string, nodes []*yaml.Node, depth int) (keyNode *yaml.Node, valueNode *yaml.Node) {
	if depth > 40 {
		return nil, nil
	}
	if nodes != nil && len(nodes) > 0 && nodes[0].Tag == "!!merge" {
		nodes = NodeAlias(nodes[1]).Content
	}
	for i, v := range nodes {
		if key != "" && key == v.Value {
			if i+1 >= len(nodes) {
				return v, NodeAlias(nodes[i]) // this is the node we need.
			}
			return NodeAlias(v), NodeAlias(nodes[i+1]) // next node is what we need.
		}
		if len(v.Content) > 0 {
			depth++
			x, y := FindFirstKeyNode(key, v.Content, depth)
			if x != nil && y != nil {
				return NodeAlias(x), NodeAlias(y)
			}
		}
	}
	return nil, nil
}

// KeyNodeResult is a result from a KeyNodeSearch performed by the FindAllKeyNodesWithPath
type KeyNodeResult struct {
	KeyNode   *yaml.Node
	ValueNode *yaml.Node
	Parent    *yaml.Node
	Path      []yaml.Node
}

// KeyNodeSearch keeps a track of everything we have found on our adventure down the trees.
type KeyNodeSearch struct {
	Key             string
	Ignore          []string
	Results         []*KeyNodeResult
	AllowExtensions bool
}

// FindKeyNodeTop is a non-recursive search of top level nodes for a key, will not look at content.
// Returns the key and value
func FindKeyNodeTop(key string, nodes []*yaml.Node) (keyNode *yaml.Node, valueNode *yaml.Node) {
	if nodes != nil && len(nodes) > 0 && nodes[0].Tag == "!!merge" {
		nodes = NodeAlias(nodes[1]).Content
	}
	for i := 0; i < len(nodes); i++ {
		v := nodes[i]
		if i%2 != 0 {
			continue
		}
		if strings.EqualFold(key, v.Value) {
			if i+1 >= len(nodes) {
				return NodeAlias(v), NodeAlias(nodes[i])
			}
			return NodeAlias(v), NodeAlias(nodes[i+1]) // next node is what we need.
		}
	}
	return nil, nil
}

// FindKeyNode is a non-recursive search of a *yaml.Node Content for a child node with a key.
// Returns the key and value
func FindKeyNode(key string, nodes []*yaml.Node) (keyNode *yaml.Node, valueNode *yaml.Node) {
	if nodes != nil && len(nodes) > 0 && nodes[0].Tag == "!!merge" {
		nodes = NodeAlias(nodes[1]).Content
	}
	for i, v := range nodes {
		if i%2 == 0 && key == v.Value {
			if len(nodes) <= i+1 {
				return NodeAlias(v), NodeAlias(nodes[i])
			}
			return NodeAlias(v), NodeAlias(nodes[i+1]) // next node is what we need.
		}
		for x, j := range v.Content {
			if key == j.Value {
				if IsNodeMap(v) {
					if x+1 == len(v.Content) {
						return NodeAlias(v), NodeAlias(v.Content[x])
					}
					return NodeAlias(v), NodeAlias(v.Content[x+1]) // next node is what we need.

				}
				if IsNodeArray(v) {
					return NodeAlias(v), NodeAlias(v.Content[x])
				}
			}
		}
	}
	return nil, nil
}

// FindKeyNodeFull is an overloaded version of FindKeyNode. This version however returns keys, labels and values.
// generally different things are required from different node trees, so depending on what this function is looking at
// it will return different things.
func FindKeyNodeFull(key string, nodes []*yaml.Node) (keyNode *yaml.Node, labelNode *yaml.Node, valueNode *yaml.Node) {
	if nodes != nil && len(nodes) > 0 && nodes[0].Tag == "!!merge" {
		nodes = NodeAlias(nodes[1]).Content
	}
	for i := 0; i < len(nodes); i++ {
		if i%2 == 0 && key == nodes[i].Value {
			if i+1 >= len(nodes) {
				return NodeAlias(nodes[i]), NodeAlias(nodes[i]), NodeAlias(nodes[i])
			}
			return NodeAlias(nodes[i]), NodeAlias(nodes[i]), NodeAlias(nodes[i+1]) // next node is what we need.
		}
	}
	for _, v := range nodes {
		for x := 0; x < len(v.Content); x++ {
			r := v.Content[x]
			if x%2 == 0 {
				if r.Tag == "!!merge" {
					if len(nodes) > x+1 {
						v = NodeAlias(nodes[x+1])
					}
				}
			}

			if len(v.Content) > 0 && key == v.Content[x].Value {
				if IsNodeMap(v) {
					if x+1 == len(v.Content) {
						return v, v.Content[x], NodeAlias(v.Content[x])
					}
					return NodeAlias(v), NodeAlias(v.Content[x]), NodeAlias(v.Content[x+1])
				}
				if IsNodeArray(v) {
					return NodeAlias(v), NodeAlias(v.Content[x]), NodeAlias(v.Content[x])
				}
			}
		}
	}
	return nil, nil, nil
}

// FindKeyNodeFullTop is an overloaded version of FindKeyNodeFull. This version only looks at the top
// level of the node and not the children.
func FindKeyNodeFullTop(key string, nodes []*yaml.Node) (keyNode *yaml.Node, labelNode *yaml.Node, valueNode *yaml.Node) {
	if nodes != nil && len(nodes) >= 0 && nodes[0].Tag == "!!merge" {
		nodes = NodeAlias(nodes[1]).Content
	}
	for i := 0; i < len(nodes); i++ {
		v := nodes[i]
		if i%2 == 0 {
			if v.Tag == "!!merge" {
				if len(nodes) > i+1 {
					v = NodeAlias(nodes[i+1])
					if len(v.Content) > 0 {
						nodes = append(nodes, v.Content...)
					}
				}
			}
		}
		if i%2 != 0 {
			continue
		}
		if i%2 == 0 && key == nodes[i].Value {
			return NodeAlias(nodes[i]), NodeAlias(nodes[i]), NodeAlias(nodes[i+1]) // next node is what we need.
		}
	}
	return nil, nil, nil
}

type ExtensionNode struct {
	Key   *yaml.Node
	Value *yaml.Node
}

func FindExtensionNodes(nodes []*yaml.Node) []*ExtensionNode {
	var extensions []*ExtensionNode
	for i, v := range nodes {
		if i%2 == 0 && strings.HasPrefix(v.Value, "x-") {
			if i+1 < len(nodes) {
				extensions = append(
					extensions, &ExtensionNode{
						Key:   v,
						Value: NodeAlias(nodes[i+1]),
					},
				)
			}
		}
	}
	return extensions
}

var (
	ObjectLabel  = "object"
	IntegerLabel = "integer"
	NumberLabel  = "number"
	StringLabel  = "string"
	BinaryLabel  = "binary"
	ArrayLabel   = "array"
	BooleanLabel = "boolean"
	SchemaSource = "https://json-schema.org/draft/2020-12/schema"
	SchemaId     = "https://pb33f.io/openapi-changes/schema"
)

func MakeTagReadable(node *yaml.Node) string {
	switch node.Tag {
	case "!!map":
		return ObjectLabel
	case "!!seq":
		return ArrayLabel
	case "!!str":
		return StringLabel
	case "!!int":
		return IntegerLabel
	case "!!float":
		return NumberLabel
	case "!!bool":
		return BooleanLabel
	}
	return "unknown"
}

// IsNodeMap checks if the node is a map type
func IsNodeMap(node *yaml.Node) bool {
	if node == nil {
		return false
	}
	n := NodeAlias(node)
	if n.Kind == yaml.MappingNode {
		return true
	}
	return n.Tag == "!!map"
}

// IsNodeNull checks if the node is a null type
func IsNodeNull(node *yaml.Node) bool {
	if node == nil {
		return true
	}
	n := NodeAlias(node)
	return n.Tag == "!!null"
}

// IsNodeAlias checks if the node is an alias, and lifts out the anchor
func IsNodeAlias(node *yaml.Node) (*yaml.Node, bool) {
	if node == nil {
		return nil, false
	}
	if node.Kind == yaml.AliasNode {
		node = node.Alias
		return node, true
	}
	return node, false
}

func NodeMerge(nodes []*yaml.Node) *yaml.Node {
	for i, v := range nodes {
		if v.Tag == "!!merge" {
			if i+1 < len(nodes) {
				return NodeAlias(nodes[i+1])
			}
		}
	}
	if len(nodes) > 0 {
		return NodeAlias(nodes[0])
	}
	return nil
}

// NodeAlias checks if the node is an alias, and lifts out the anchor
func NodeAlias(node *yaml.Node) *yaml.Node {

	if node == nil {
		return nil
	}

	content := node.Content
	if node.Kind == yaml.AliasNode {
		content = node.Alias.Content
	}

	for i, n := range content {
		if i%2 == 0 {
			if n.Tag == "!!merge" {
				g := NodeMerge(content[i+1:])
				if g != nil {
					node = g
				}
			}
		}
	}

	if node.Kind == yaml.AliasNode {
		node = node.Alias
		return node
	}
	return node
}

// IsNodePolyMorphic will return true if the node contains polymorphic keys.
func IsNodePolyMorphic(node *yaml.Node) bool {
	n := NodeAlias(node)
	for i, v := range n.Content {
		if i%2 == 0 {
			if v.Value == "anyOf" || v.Value == "oneOf" || v.Value == "allOf" {
				return true
			}
		}
	}
	return false
}

// IsNodeArray checks if a node is an array type
func IsNodeArray(node *yaml.Node) bool {
	if node == nil {
		return false
	}
	n := NodeAlias(node)
	return n.Tag == "!!seq"
}

// IsNodeStringValue checks if a node is a string value
func IsNodeStringValue(node *yaml.Node) bool {
	if node == nil {
		return false
	}
	n := NodeAlias(node)
	return n.Tag == "!!str"
}

// IsNodeIntValue will check if a node is an int value
func IsNodeIntValue(node *yaml.Node) bool {
	if node == nil {
		return false
	}
	n := NodeAlias(node)
	return n.Tag == "!!int"
}

// IsNodeFloatValue will check is a node is a float value.
func IsNodeFloatValue(node *yaml.Node) bool {
	if node == nil {
		return false
	}
	n := NodeAlias(node)
	return n.Tag == "!!float"
}

// IsNodeNumberValue will check if a node can be parsed as a float value.
func IsNodeNumberValue(node *yaml.Node) bool {
	if node == nil {
		return false
	}
	return IsNodeIntValue(node) || IsNodeFloatValue(node)
}

// IsNodeBoolValue will check is a node is a bool
func IsNodeBoolValue(node *yaml.Node) bool {
	if node == nil {
		return false
	}
	n := NodeAlias(node)
	return n.Tag == "!!bool"
}

func IsNodeRefValue(node *yaml.Node) (bool, *yaml.Node, string) {
	if node == nil {
		return false, nil, ""
	}
	n := NodeAlias(node)
	for i, r := range n.Content {
		if i%2 == 0 {
			if r.Value == "$ref" {
				if i+1 < len(n.Content) {
					return true, r, n.Content[i+1].Value
				}
			}
		}
	}
	return false, nil, ""
}

// FixContext will clean up a JSONpath string to be correctly traversable.
func FixContext(context string) string {
	tokens := strings.Split(context, ".")
	cleaned := []string{}

	for i, t := range tokens {
		if v, err := strconv.Atoi(t); err == nil {
			if v < 200 { // codes start here
				if cleaned[i-1] != "" {
					cleaned[i-1] += fmt.Sprintf("[%v]", t)
				}
			} else {
				cleaned = append(cleaned, t)
			}
			continue
		}
		cleaned = append(cleaned, strings.ReplaceAll(t, "(root)", "$"))
	}

	return strings.Join(cleaned, ".")
}

// IsJSON will tell you if a string is JSON or not.
func IsJSON(testString string) bool {
	if testString == "" {
		return false
	}
	runes := []rune(strings.TrimSpace(testString))
	if runes[0] == '{' && runes[len(runes)-1] == '}' {
		return true
	}
	return false
}

// IsYAML will tell you if a string is YAML or not.
var (
	yamlKeyValuePattern = regexp.MustCompile(`(?m)^\s*[a-zA-Z0-9_-]+\s*:\s*.+$`)
	yamlListPattern     = regexp.MustCompile(`(?m)^\s*-\s+.+$`)
	yamlHeaderPattern   = regexp.MustCompile(`(?m)^---\s*$`)
)

func IsYAML(testString string) bool {
	if testString == "" {
		return false
	}
	if IsJSON(testString) {
		return false
	}

	// Trim leading and trailing whitespace
	s := strings.TrimSpace(testString)

	// Fast checks for common YAML features
	if strings.Contains(s, ": ") || strings.Contains(s, "- ") || strings.Contains(s, "\n- ") {
		return true
	}

	// Regular expressions for more robust detection
	if yamlKeyValuePattern.MatchString(s) || yamlListPattern.MatchString(s) || yamlHeaderPattern.MatchString(s) {
		return true
	}

	return false
}

// ConvertYAMLtoJSON will do exactly what you think it will. It will deserialize YAML into serialized JSON.
func ConvertYAMLtoJSON(yamlData []byte) ([]byte, error) {
	var decodedYaml map[string]interface{}
	err := yaml.Unmarshal(yamlData, &decodedYaml)
	if err != nil {
		return nil, err
	}
	// if the data can be decoded, it can be encoded (that's my view anyway). no need for an error check.
	jsonData, _ := json.Marshal(decodedYaml)
	return jsonData, nil
}

// IsHttpVerb will check if an operation is valid or not.
func IsHttpVerb(verb string) bool {
	verbs := []string{"get", "post", "put", "patch", "delete", "options", "trace", "head"}
	for _, v := range verbs {
		if verb == v {
			return true
		}
	}
	return false
}

// define bracket name expression
var (
	bracketNameExp = regexp.MustCompile(`^(\w+)\['?([\w/]+)'?]$`)
	pathCharExp    = regexp.MustCompile(`^[A-Za-z0-9_\\]*$`)
)

func appendSegment(sb *strings.Builder, segs []string, cleaned []string, i int, wrapInQuotes bool) {
	sb.Reset()
	if wrapInQuotes {
		sb.WriteString("['")
		sb.WriteString(segs[i])
		sb.WriteString("']")
	} else {
		sb.WriteString("[")
		sb.WriteString(segs[i])
		sb.WriteString("]")
	}
	c := sb.String()
	sb.Reset()
	sb.WriteString(cleaned[len(cleaned)-1])
	sb.WriteString(c)
	cleaned[len(cleaned)-1] = sb.String()
}

// ConvertComponentIdIntoFriendlyPathSearch will convert a JSON Path into a friendly path search string.
// the friendliness comes from it being suitable for use with any JSON Path parser.
//
// This function was re-written in v0.18.0 in order to fix a number of performance issues with the original
// implementation. Allocations were high and this function is used a lot, this new implementation is much
// lighter on string allocations by using a string builder.
func ConvertComponentIdIntoFriendlyPathSearch(id string) (string, string) {
	if id == "" || id == "#/" {
		return "", "$."
	}
	segs := strings.Split(id, "/")
	name, _ := url.QueryUnescape(strings.ReplaceAll(segs[len(segs)-1], "~1", "/"))
	cleaned := make([]string, 0, len(segs))

	// use a builder to prevent many pointless string allocations.
	var sb strings.Builder

	// check for strange spaces, chars and if found, wrap them up, clean them and create a new cleaned path.
	for i := range segs {
		if segs[i] == "" {
			continue
		}
		if !pathCharExp.MatchString(segs[i]) {

			segs[i], _ = url.QueryUnescape(strings.ReplaceAll(segs[i], "~1", "/"))
			sb.Reset()
			sb.WriteString("['")
			sb.WriteString(segs[i])
			sb.WriteString("']")
			segs[i] = sb.String()

			if len(cleaned) > 0 && i < len(segs)-1 {
				sb.Reset()
				sb.WriteString(segs[i-1])
				sb.WriteString(segs[i])
				cleaned[len(cleaned)-1] = sb.String()
				continue
			} else {
				if i > 0 && i < len(segs)-1 {
					cleaned = append(cleaned, segs[i])
					continue
				}
				if i == len(segs)-1 {
					sb.Reset()
					l := len(cleaned)
					if l > 0 {
						sb.WriteString(cleaned[l-1])
						sb.WriteString(segs[i])
						cleaned[l-1] = sb.String()
					} else {
						cleaned = append(cleaned, segs[i])
					}
				}
			}
		} else {

			// strip out any backslashes
			if strings.Contains(id, "#") && strings.Contains(segs[i], `\`) {
				segs[i] = strings.ReplaceAll(segs[i], `\`, "")
				cleaned = append(cleaned, segs[i])
				continue
			}

			intVal, err := strconv.Atoi(segs[i])
			if err == nil {
				if intVal <= 99 {
					if len(cleaned) > 0 {
						appendSegment(&sb, segs, cleaned, i, false)
					}
				} else {
					if len(cleaned) > 0 {
						appendSegment(&sb, segs, cleaned, i, true)
					}
				}
				continue
			}

			// if we have a plural parent, wrap it in quotes.
			if i > 0 && segs[i-1] != "" && segs[i-1][len(segs[i-1])-1] == 's' {
				if i == 2 { // ignore first segment.
					cleaned = append(cleaned, segs[i])
					continue
				}
				sb.Reset()
				sb.WriteString("['")
				sb.WriteString(segs[i])
				sb.WriteString("']")
				c := sb.String()
				sb.Reset()
				sb.WriteString(cleaned[len(cleaned)-1])
				sb.WriteString(c)
				cleaned[len(cleaned)-1] = sb.String()
				continue
			}

			cleaned = append(cleaned, segs[i])
		}
	}

	var replaced string
	if len(cleaned) > 1 {
		replaced = strings.ReplaceAll(strings.Join(cleaned, "."), "#", "$")
	} else {
		replaced = strings.ReplaceAll(strings.Join(cleaned, ""), "#", "$.")
	}

	if len(replaced) > 0 {
		if replaced[0] != '$' {
			replaced = fmt.Sprintf("$%s", replaced)
		}
		if replaced[1] != '.' {

			// the second rune needs to be a period, if it's not we need to insert one.
			sb.Reset()
			sb.WriteString(fmt.Sprintf("%s.%s", replaced[:1], replaced[1:]))
			replaced = sb.String()
		}
	}
	return name, replaced
}

// ConvertComponentIdIntoPath will convert a JSON Path into a component ID
// TODO: This function is named incorrectly and should be changed to reflect the correct function
func ConvertComponentIdIntoPath(id string) (string, string) {

	segs := strings.Split(id, ".")
	name, _ := url.QueryUnescape(strings.ReplaceAll(segs[len(segs)-1], "~1", "/"))
	var cleaned []string

	// check for strange spaces, chars and if found, wrap them up, clean them and create a new cleaned path.
	for i := range segs {
		brackets := bracketNameExp.FindStringSubmatch(segs[i])
		if i == 0 {
			if segs[i] == "$" {
				cleaned = append(cleaned, "#")
				continue
			}
		}

		// if there are brackets, shift the path to encapsulate them correctly.
		if len(brackets) > 0 {

			//bracketNameExp/.
			key := bracketNameExp.ReplaceAllString(segs[i], "$1")
			val := strings.ReplaceAll(bracketNameExp.ReplaceAllString(segs[i], "$2"), "/", "~1")
			cleaned = append(
				cleaned[:i],
				append([]string{fmt.Sprintf("%s/%s", key, val)}, cleaned[i:]...)...,
			)
			continue
		}
		cleaned = append(cleaned, segs[i])
	}

	if cleaned[0] != "#" {
		cleaned = append(cleaned[:0], append([]string{"#"}, cleaned[0:]...)...)

	}
	replaced := strings.ReplaceAll(strings.Join(cleaned, "/"), "$", "#")

	return name, replaced
}

func RenderCodeSnippet(startNode *yaml.Node, specData []string, before, after int) string {
	buf := new(strings.Builder)

	startLine := startNode.Line - before
	endLine := startNode.Line + after

	if startLine < 0 {
		startLine = 0
	}

	if endLine >= len(specData) {
		endLine = len(specData) - 1
	}

	delta := endLine - startLine

	for i := 0; i < delta; i++ {
		l := startLine + i
		if l < len(specData) {
			line := specData[l]
			buf.WriteString(fmt.Sprintf("%s\n", line))
		}
	}

	return buf.String()
}

func DetectCase(input string) Case {
	trim := strings.TrimSpace(input)
	if trim == "" {
		return UnknownCase
	}

	pascalCase := regexp.MustCompile("^[A-Z][a-z]+(?:[A-Z][a-z]+)*$")
	camelCase := regexp.MustCompile("^[a-z]+(?:[A-Z][a-z]+)*$")
	screamingSnakeCase := regexp.MustCompile("^[A-Z]+(_[A-Z]+)*$")
	snakeCase := regexp.MustCompile("^[a-z]+(_[a-z]+)*$")
	kebabCase := regexp.MustCompile("^[a-z]+(-[a-z]+)*$")
	screamingKebabCase := regexp.MustCompile("^[A-Z]+(-[A-Z]+)*$")
	if pascalCase.MatchString(trim) {
		return PascalCase
	}
	if camelCase.MatchString(trim) {
		return CamelCase
	}
	if screamingSnakeCase.MatchString(trim) {
		return ScreamingSnakeCase
	}
	if snakeCase.MatchString(trim) {
		return SnakeCase
	}
	if kebabCase.MatchString(trim) {
		return KebabCase
	}
	if screamingKebabCase.MatchString(trim) {
		return ScreamingKebabCase
	}
	return RegularCase
}

// CheckEnumForDuplicates will check an array of nodes to check if there are any duplicate values.
func CheckEnumForDuplicates(seq []*yaml.Node) []*yaml.Node {
	var res []*yaml.Node
	seen := make(map[string]*yaml.Node)

	for _, enum := range seq {
		if seen[enum.Value] != nil {
			res = append(res, enum)
			continue
		}
		seen[enum.Value] = enum
	}
	return res
}

var whitespaceExp = regexp.MustCompile(`\n( +)`)

// DetermineWhitespaceLength will determine the length of the whitespace for a JSON or YAML file.
func DetermineWhitespaceLength(input string) int {
	whiteSpace := whitespaceExp.FindAllStringSubmatch(input, -1)
	var filtered []string
	for i := range whiteSpace {
		filtered = append(filtered, whiteSpace[i][1])
	}
	sort.Strings(filtered)
	if len(filtered) > 0 {
		return len(filtered[0])
	} else {
		return 0
	}
}

// CheckForMergeNodes will check the top level of the schema for merge nodes. If any are found, then the merged nodes
// will be appended to the end of the rest of the nodes in the schema.
// Note: this is a destructive operation, so the in-memory node structure will be modified
func CheckForMergeNodes(node *yaml.Node) {
	if node == nil {
		return
	}
	total := len(node.Content)
	for i := 0; i < total; i++ {
		mn := node.Content[i]
		if i%2 == 0 {
			if mn.Tag == "!!merge" {
				an := node.Content[i+1].Alias
				if an != nil {
					node.Content = append(node.Content, an.Content...) // append the merged nodes
					total = len(node.Content)
					i += 2
				}
			}
		}
	}
}

type RemoteURLHandler = func(url string) (*http.Response, error)
