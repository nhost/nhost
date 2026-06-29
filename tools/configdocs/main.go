// Command configdocs generates the nhost.toml configuration reference page for
// the documentation site from the mimir CUE schema. It walks the parsed CUE AST
// so the rendered types, defaults, and explanations stay faithful to the schema
// source (including its doc comments) rather than an evaluated/flattened value.
package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/format"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
)

var (
	errConfigNotFound  = errors.New("#Config definition not found")
	errConfigNotStruct = errors.New("#Config is not a struct literal")
)

func main() {
	schemaPath := flag.String("schema", "", "path to the mimir schema.cue file")
	outPath := flag.String("out", "", "path to the .mdx file to write")

	flag.Parse()

	if *schemaPath == "" || *outPath == "" {
		fmt.Fprintln(os.Stderr, "usage: configdocs -schema <schema.cue> -out <reference.mdx>")
		os.Exit(2)
	}

	src, err := os.ReadFile(*schemaPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read schema: %v\n", err)
		os.Exit(1)
	}

	out, err := generate(*schemaPath, src)
	if err != nil {
		fmt.Fprintf(os.Stderr, "generate: %v\n", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(filepath.Dir(*outPath), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "mkdir: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(*outPath, []byte(out), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "write: %v\n", err)
		os.Exit(1)
	}
}

// generator renders a single configuration reference page from the CUE AST.
type generator struct {
	defs        map[string]*ast.Field // "#Name" -> definition field
	topLevel    map[string]bool       // "#Name" definitions surfaced as top-level config sections
	sharedSeen  map[string]bool       // "#Name" definitions queued/rendered in the shared section
	sharedQueue []string
}

type fieldInfo struct {
	name        string
	optional    bool
	conditional bool
	value       ast.Expr
	doc         string
}

func newGenerator() *generator {
	return &generator{
		defs:        map[string]*ast.Field{},
		topLevel:    map[string]bool{},
		sharedSeen:  map[string]bool{},
		sharedQueue: nil,
	}
}

func generate(filename string, src []byte) (string, error) {
	file, err := parser.ParseFile(filename, src, parser.ParseComments)
	if err != nil {
		return "", fmt.Errorf("parse cue: %w", err)
	}

	g := newGenerator()

	for _, d := range file.Decls {
		f, ok := d.(*ast.Field)
		if !ok {
			continue
		}

		name, isDef := defName(f.Label)
		if !isDef {
			continue
		}

		g.defs[name] = f
	}

	root, ok := g.defs["#Config"]
	if !ok {
		return "", errConfigNotFound
	}

	rootStruct, ok := root.Value.(*ast.StructLit)
	if !ok {
		return "", errConfigNotStruct
	}

	topFields, _ := g.collectFields(rootStruct)
	for _, fi := range topFields {
		if id, ok := fi.value.(*ast.Ident); ok && strings.HasPrefix(id.Name, "#") {
			g.topLevel[id.Name] = true
		}
	}

	var body strings.Builder
	g.renderTopLevel(&body, topFields)

	for _, fi := range topFields {
		id, ok := fi.value.(*ast.Ident)
		if !ok || !strings.HasPrefix(id.Name, "#") {
			continue
		}

		doc := fi.doc
		if doc == "" {
			doc = docOf(g.defs[id.Name])
		}

		g.renderSection(&body, fi.name, id.Name, 2, fi.optional, doc)
	}

	g.renderShared(&body)

	return frontmatter + body.String(), nil
}

// renderTopLevel writes the overview table introducing every root section.
func (g *generator) renderTopLevel(b *strings.Builder, topFields []fieldInfo) {
	b.WriteString("## Top-level structure\n\n")
	b.WriteString("The root of `nhost.toml` is made up of the following sections.\n\n")
	b.WriteString("| Section | Description |\n|---|---|\n")

	for _, fi := range topFields {
		fmt.Fprintf(b, "| [`%s`](#%s) | %s |\n",
			fi.name, slug(fi.name), cell(resolveDoc(fi.doc, fi.name, fi.name)))
	}

	b.WriteString("\n")
}

// renderShared appends the "Shared types" appendix: definitions referenced from
// more than one section, rendered once at the end.
func (g *generator) renderShared(b *strings.Builder) {
	if len(g.sharedQueue) == 0 {
		return
	}

	b.WriteString("## Shared types\n\n")
	b.WriteString("Types reused across multiple sections above.\n\n")

	// Rendering a shared type can enqueue further referenced types, so the queue
	// grows during iteration. Re-check len each step rather than ranging over a
	// fixed bound, which would drop types enqueued while rendering.
	i := 0
	for i < len(g.sharedQueue) {
		name := g.sharedQueue[i]
		title := strings.TrimPrefix(name, "#")
		g.renderSection(b, title, name, 3, false, docOf(g.defs[name]))

		i++
	}
}

const frontmatter = `---
title: Configuration Reference
description: Full reference for the nhost.toml configuration file, generated from the configuration schema.
head:
  - tag: title
    content: "nhost.toml Configuration Reference | Nhost Docs"
  - tag: style
    content: |
      .sl-markdown-content.sl-markdown-content h2:not(.sl-card-title) {
        font-size: 2rem !important;
        line-height: 1.2 !important;
        margin-top: 5rem !important;
        margin-bottom: 1.5rem !important;
      }
      .sl-markdown-content.sl-markdown-content h3:not(.sl-card-title),
      .sl-markdown-content.sl-markdown-content h4:not(.sl-card-title),
      .sl-markdown-content.sl-markdown-content h5:not(.sl-card-title),
      .sl-markdown-content.sl-markdown-content h6:not(.sl-card-title) {
        margin-top: 4rem !important;
      }
      .sl-markdown-content.sl-markdown-content table {
        margin-bottom: 4rem !important;
      }
      .right-sidebar-panel {
        padding-block-end: 5rem !important;
      }
sidebar:
  label: Configuration
---
{/*
  This page is generated from the configuration schema by tools/configdocs.
  Do not edit it by hand; run "pnpm generate" in the docs workspace instead.
*/}

This page documents every field available in your project's ` + "`nhost.toml`" + `, generated
directly from the configuration schema. For task-oriented guidance and copy-paste
examples, see the per-product documentation; this page is the exhaustive field reference.

`

// renderSection renders a single named definition under the given title.
func (g *generator) renderSection(
	b *strings.Builder,
	title, defName string,
	level int,
	optional bool,
	doc string,
) {
	f, ok := g.defs[defName]
	if !ok {
		return
	}

	if d, ok := defOverrides[defName]; ok {
		doc = d
	} else {
		doc = sanitizeHasura(doc)
	}

	b.WriteString(strings.Repeat("#", level) + " " + title + "\n\n")

	if optional {
		doc = strings.TrimSpace("*Optional.* " + doc)
	}

	if doc != "" {
		b.WriteString(doc + "\n\n")
	}

	st, ok := f.Value.(*ast.StructLit)
	if !ok {
		// Non-struct definitions (disjunctions, aliases) are shown verbatim.
		b.WriteString("```cue\n" + formatExpr(f.Value) + "\n```\n\n")
		return
	}

	g.renderStruct(b, title, st, level)
}

// renderStruct renders the fields of a struct as a table, then recurses into any
// inline struct fields under their own heading (one level deeper than the
// parent) so nested objects read as distinct, well-spaced sub-sections.
func (g *generator) renderStruct(b *strings.Builder, prefix string, st *ast.StructLit, level int) {
	fields, embeds := g.collectFields(st)

	for _, em := range embeds {
		b.WriteString("Includes all fields from " + g.linkToDef(em) + ".\n\n")
	}

	if len(fields) > 0 {
		b.WriteString("| Field | Type | Default | Description |\n|---|---|---|---|\n")

		for _, fi := range fields {
			typeCell, def := g.renderType(fi.value)

			name := fi.name
			if fi.optional {
				name += "?"
			}

			fieldPath := fi.name
			if prefix != "" {
				fieldPath = prefix + "." + fi.name
			}

			desc := resolveDoc(fi.doc, fieldPath, fi.name)
			if fi.conditional {
				desc = strings.TrimSpace("*(conditional)* " + desc)
			}

			fmt.Fprintf(b, "| `%s` | %s | %s | %s |\n", name, typeCell, def, cell(desc))
		}

		b.WriteString("\n")
	}

	childLevel := min(level+1, 6)

	for _, fi := range fields {
		child, ok := fi.value.(*ast.StructLit)
		if !ok {
			continue
		}

		path := fi.name
		if prefix != "" {
			path = prefix + "." + fi.name
		}

		b.WriteString(strings.Repeat("#", childLevel) + " `" + path + "`\n\n")

		if fi.optional {
			b.WriteString("*Optional.*\n\n")
		}

		g.renderStruct(b, path, child, childLevel)
	}
}

// renderType returns the markdown for a field's type cell and its default value
// (empty if none). The default operand is marked with `*` in CUE and always
// populates the default column. When the disjunction is an enumeration of
// literal values (e.g. "GET" | *"POST"), the default is itself one of the
// allowed values, so it is also listed in the type column; for a broader-typed
// field (e.g. bool | *true) the default is shown only in the default column.
func (g *generator) renderType(expr ast.Expr) (typeCell, def string) {
	operands := splitDisjunction(expr)

	enum := true
	for _, op := range operands {
		v := op
		if u, ok := op.(*ast.UnaryExpr); ok && u.Op == token.MUL {
			v = u.X
		}

		if !isLiteralValue(v) {
			enum = false
			break
		}
	}

	parts := make([]string, 0, len(operands))
	for _, op := range operands {
		if u, ok := op.(*ast.UnaryExpr); ok && u.Op == token.MUL {
			def = "`" + formatExpr(u.X) + "`"
			if enum {
				parts = append(parts, g.typeAtom(u.X))
			}

			continue
		}

		parts = append(parts, g.typeAtom(op))
	}

	parts = dedupeStrings(parts)
	if len(parts) == 0 {
		parts = []string{"`" + formatExpr(expr) + "`"}
	}

	return strings.Join(parts, " \\| "), def
}

// typeAtom renders a single (non-disjunction) type expression, linking to named
// definitions where possible.
func (g *generator) typeAtom(expr ast.Expr) string {
	switch e := expr.(type) {
	case *ast.Ident:
		if strings.HasPrefix(e.Name, "#") {
			return g.linkToDef(e.Name)
		}

		return "`" + e.Name + "`"
	case *ast.StructLit:
		return "object"
	case *ast.ListLit:
		if elem := listElem(e); elem != nil {
			return "list of " + g.typeAtom(elem)
		}

		return "`" + formatExpr(e) + "`"
	case *ast.BinaryExpr:
		// Constraints such as `uint32 & >=1 & <=100`: link the leading type if it
		// is a definition, otherwise fall back to the formatted expression.
		if e.Op == token.AND {
			if id, ok := e.X.(*ast.Ident); ok && strings.HasPrefix(id.Name, "#") {
				return g.linkToDef(id.Name) + " `" + formatExpr(e.Y) + "`"
			}
		}

		return "`" + formatExpr(e) + "`"
	default:
		return "`" + formatExpr(expr) + "`"
	}
}

// linkToDef returns a markdown link to a definition's section, queuing it for the
// shared-types section if it is not a top-level config section.
func (g *generator) linkToDef(name string) string {
	bare := strings.TrimPrefix(name, "#")
	if _, ok := g.defs[name]; !ok {
		// Unknown definition (e.g. a builtin-looking alias not in this file).
		return "`" + name + "`"
	}

	if !g.topLevel[name] && !g.sharedSeen[name] {
		g.sharedSeen[name] = true
		g.sharedQueue = append(g.sharedQueue, name)
	}

	return fmt.Sprintf("[`%s`](#%s)", bare, slug(bare))
}

// collectFields extracts the documented fields of a struct, flattening fields
// declared inside conditional (`if ...`) comprehensions and recording embedded
// definitions. Hidden fields (leading underscore, used for validation) are
// skipped. Fields are de-duplicated by name, preserving first-seen order.
func (g *generator) collectFields(st *ast.StructLit) (fields []fieldInfo, embeds []string) {
	seen := map[string]bool{}

	var walk func(elts []ast.Decl, conditional bool)

	walk = func(elts []ast.Decl, conditional bool) {
		for _, d := range elts {
			switch e := d.(type) {
			case *ast.Field:
				name, isIdent := labelName(e.Label)
				if !isIdent || name == "" || strings.HasPrefix(name, "_") {
					continue
				}

				if strings.HasPrefix(name, "#") {
					continue
				}

				if seen[name] {
					continue
				}

				seen[name] = true
				fields = append(fields, fieldInfo{
					name:        name,
					optional:    e.Constraint == token.OPTION,
					conditional: conditional,
					value:       e.Value,
					doc:         docOf(e),
				})
			case *ast.Comprehension:
				if inner, ok := e.Value.(*ast.StructLit); ok {
					walk(inner.Elts, true)
				}
			case *ast.EmbedDecl:
				if id, ok := e.Expr.(*ast.Ident); ok && strings.HasPrefix(id.Name, "#") {
					embeds = append(embeds, id.Name)
				}
			}
		}
	}

	walk(st.Elts, false)

	return fields, embeds
}

// splitDisjunction flattens a `|` disjunction expression into its operands.
func splitDisjunction(expr ast.Expr) []ast.Expr {
	be, ok := expr.(*ast.BinaryExpr)
	if !ok || be.Op != token.OR {
		return []ast.Expr{expr}
	}

	return append(splitDisjunction(be.X), splitDisjunction(be.Y)...)
}

// isLiteralValue reports whether expr is a concrete value (a string, number, or
// the bool/null keywords) rather than a type. CUE parses all of these as
// *ast.BasicLit, so a disjunction whose operands are all literal values is an
// enumeration whose default is one of the allowed values.
func isLiteralValue(expr ast.Expr) bool {
	_, ok := expr.(*ast.BasicLit)
	return ok
}

// listElem returns the element type of a list written as `[...T]` or `[T]`.
func listElem(l *ast.ListLit) ast.Expr {
	for _, el := range l.Elts {
		if e, ok := el.(*ast.Ellipsis); ok && e.Type != nil {
			return e.Type
		}
	}

	if len(l.Elts) == 1 {
		if _, ok := l.Elts[0].(*ast.Ellipsis); !ok {
			return l.Elts[0]
		}
	}

	return nil
}

func defName(label ast.Label) (string, bool) {
	id, ok := label.(*ast.Ident)
	if !ok {
		return "", false
	}

	if !strings.HasPrefix(id.Name, "#") {
		return "", false
	}

	return id.Name, true
}

func labelName(label ast.Label) (string, bool) {
	switch l := label.(type) {
	case *ast.Ident:
		return l.Name, true
	case *ast.BasicLit:
		return strings.Trim(l.Value, `"`), true
	default:
		return "", false
	}
}

func docOf(n ast.Node) string {
	if n == nil {
		return ""
	}

	var parts []string
	for _, cg := range ast.Comments(n) {
		if cg.Line || cg.Position != 0 {
			continue
		}

		if t := strings.TrimSpace(cg.Text()); t != "" {
			parts = append(parts, t)
		}
	}

	return strings.Join(parts, " ")
}

func formatExpr(expr ast.Expr) string {
	b, err := format.Node(expr)
	if err != nil {
		return ""
	}

	return strings.TrimSpace(string(b))
}

func oneLine(s string) string {
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "|", "\\|")
	// Escape characters MDX would otherwise treat as JSX/expressions.
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "{", "\\{")
	s = strings.ReplaceAll(s, "}", "\\}")

	return strings.TrimSpace(strings.Join(strings.Fields(s), " "))
}

// cell formats a value for a markdown table cell, escaping MDX-sensitive
// characters and substituting "-" for empty values so columns never read blank.
func cell(s string) string {
	s = oneLine(s)
	if s == "" {
		return "-"
	}

	return s
}

// resolveDoc turns a raw schema comment into a human-readable description. With
// a comment it strips Hasura doc links and rewrites bare environment-variable
// names into curated prose. With no comment it falls back to a curated
// description (keyed by full path, then by field name), and finally to a
// humanized field name so no field is left blank.
func resolveDoc(raw, path, name string) string {
	raw = sanitizeHasura(raw)
	if raw != "" {
		if isEnvVar(raw) {
			if d, ok := envOverrides[raw]; ok {
				return d
			}

			return humanizeEnvVar(raw)
		}

		return raw
	}

	if d, ok := pathOverrides[path]; ok {
		return d
	}

	if d, ok := fieldOverrides[name]; ok {
		return d
	}

	return humanizeName(name)
}

var camelRe = regexp.MustCompile(`([a-z0-9])([A-Z])`)

// humanizeName converts a camelCase field name into a readable sentence-case
// label, used as a last resort when no curated description exists.
func humanizeName(s string) string {
	s = strings.ToLower(camelRe.ReplaceAllString(s, "$1 $2"))
	if s == "" {
		return ""
	}

	return strings.ToUpper(s[:1]) + s[1:]
}

var hasuraDocRe = regexp.MustCompile(
	`(?i)\s*(see|reference:?)?\s*https?://[^\s)]*hasura\.io[^\s)]*`,
)

// sanitizeHasura removes links into Hasura's documentation; the engine config
// names themselves are retained, but we point readers at Nhost docs instead.
func sanitizeHasura(s string) string {
	return strings.TrimSpace(hasuraDocRe.ReplaceAllString(s, ""))
}

var envVarRe = regexp.MustCompile(`^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$`)

func isEnvVar(s string) bool {
	return envVarRe.MatchString(strings.TrimSpace(s))
}

func humanizeEnvVar(s string) string {
	s = strings.TrimSpace(s)
	for _, p := range []string{"HASURA_GRAPHQL_", "AUTH_", "NHOST_", "POSTGRES_", "STORAGE_"} {
		if after, ok := strings.CutPrefix(s, p); ok {
			s = after
			break
		}
	}

	s = strings.ToLower(strings.ReplaceAll(s, "_", " "))
	if s == "" {
		return ""
	}

	return strings.ToUpper(s[:1]) + s[1:]
}

// TEMPORARY: the override maps below (defOverrides, envOverrides, pathOverrides,
// fieldOverrides) are a curation layer that fills in descriptions the vendored
// mimir schema.cue either lacks or documents only with a bare env-var name. The
// durable fix is to move these into the schema's doc comments upstream in the
// nhost/be repo (services/mimir/schema/schema.cue), which makes the schema the
// single source of truth for docs, dashboard tooltips, and the GraphQL config
// API. Follow-up PR in nhost/be tracks that migration; once it lands and the
// vendored module is bumped here, these maps can be deleted.

// defOverrides replaces a definition's section intro. Used where the schema
// comment links to Hasura docs we no longer want to reference.
var defOverrides = map[string]string{
	"#JWTSecret": "Signing key and configuration used to verify JSON Web Tokens. " +
		"See [JSON Web Tokens](/products/auth/jwt) for the full configuration and examples.",
}

// envOverrides maps bare environment-variable schema comments to brief,
// human-readable descriptions.
var envOverrides = map[string]string{
	"HASURA_GRAPHQL_CORS_DOMAIN":                               "Comma-separated list of domains allowed to make cross-origin requests.",
	"HASURA_GRAPHQL_DEV_MODE":                                  "Include detailed error messages in API responses (development only).",
	"HASURA_GRAPHQL_ENABLE_ALLOWLIST":                          "Restrict execution to queries in the allowlist.",
	"HASURA_GRAPHQL_ENABLE_CONSOLE":                            "Serve the web console for managing the GraphQL API.",
	"HASURA_GRAPHQL_ENABLE_REMOTE_SCHEMA_PERMISSIONS":          "Enforce role-based permissions on remote schemas.",
	"HASURA_GRAPHQL_ENABLED_APIS":                              "Comma-separated list of APIs to expose (e.g. metadata, graphql).",
	"HASURA_GRAPHQL_INFER_FUNCTION_PERMISSIONS":                "Automatically infer permissions for custom SQL functions.",
	"HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_REFETCH_INTERVAL": "How often, in milliseconds, live queries are refetched.",
	"HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES":                   "Return numeric and bigint values as strings to avoid precision loss.",
	"HASURA_GRAPHQL_AUTH_HOOK":                                 "URL of the webhook used to authenticate requests.",
	"HASURA_GRAPHQL_AUTH_HOOK_MODE":                            "HTTP method used to call the auth webhook (GET or POST).",
	"HASURA_GRAPHQL_AUTH_HOOK_SEND_REQUEST_BODY":               "Forward the request body to the auth webhook.",
	"HASURA_GRAPHQL_LOG_LEVEL":                                 "Minimum severity of log messages to emit.",
	"HASURA_GRAPHQL_EVENTS_HTTP_POOL_SIZE":                     "Maximum number of concurrent HTTP connections used to deliver events.",
	"AUTH_CLIENT_URL":                                          "URL of your frontend application, used for post-authentication redirects.",
	"AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS":                "Additional URLs permitted as post-authentication redirect targets.",
	"AUTH_DISABLE_NEW_USERS":                                   "Block newly registered users from signing in until activated.",
	"AUTH_DISABLE_SIGNUP":                                      "Disable user registration entirely.",
	"AUTH_DISABLE_AUTO_SIGNUP":                                 "Require explicit account creation instead of signing users up on first login.",
	"AUTH_USER_DEFAULT_ROLE":                                   "Default role assigned to new users.",
	"AUTH_USER_DEFAULT_ALLOWED_ROLES":                          "Roles a user is allowed to assume.",
	"AUTH_LOCALE_DEFAULT":                                      "Default locale used for emails and messages.",
	"AUTH_LOCALE_ALLOWED_LOCALES":                              "Locales users are allowed to select.",
	"AUTH_GRAVATAR_ENABLED":                                    "Use Gravatar to provide default user avatars.",
	"AUTH_GRAVATAR_DEFAULT":                                    "Fallback Gravatar image used when a user has none.",
	"AUTH_GRAVATAR_RATING":                                     "Maximum Gravatar content rating to allow.",
	"AUTH_ACCESS_CONTROL_ALLOWED_EMAILS":                       "Email addresses permitted to sign up.",
	"AUTH_ACCESS_CONTROL_BLOCKED_EMAILS":                       "Email addresses blocked from signing up.",
	"AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS":                "Email domains permitted to sign up.",
	"AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS":                "Email domains blocked from signing up.",
	"AUTH_ACCESS_TOKEN_EXPIRES_IN":                             "Lifetime of an access token, in seconds.",
	"AUTH_REFRESH_TOKEN_EXPIRES_IN":                            "Lifetime of a refresh token, in seconds.",
	"AUTH_JWT_CUSTOM_CLAIMS":                                   "Custom claims added to the JWT, mapped from the session and database.",
}

// pathOverrides describes fields by their full dotted path. Used only where the
// same field name means different things in different sections.
var pathOverrides = map[string]string{
	"auth.user.email":         "Restrictions on which email addresses may sign up.",
	"auth.method.otp.email":   "Enable one-time-password sign-in over email.",
	"AuthRateLimit.emails":    "Rate limit for outgoing emails.",
	"AuthRateLimit.sms":       "Rate limit for outgoing SMS messages.",
	"Grafana.smtp.user":       "Username for SMTP authentication.",
	"Grafana.contacts.emails": "Email addresses to send alerts to.",
}

// fieldOverrides describes fields by name, used when the schema has no comment.
// One entry covers every occurrence of a name that means the same thing
// everywhere (e.g. `enabled`, the OAuth provider structs, SMTP fields).
var fieldOverrides = map[string]string{
	"enabled":                       "Enable this feature.",
	"version":                       "Version of the service image to deploy.",
	"resources":                     "Compute resources and scaling for the service.",
	"rateLimit":                     "Rate limiting applied to the service.",
	"settings":                      "Advanced configuration settings for the service.",
	"networking":                    "Network exposure and ingress configuration.",
	"compute":                       "CPU and memory allocation.",
	"autoscaler":                    "Automatic replica scaling settings.",
	"replicas":                      "Number of service replicas to run.",
	"maxReplicas":                   "Maximum number of replicas the autoscaler may create.",
	"ingresses":                     "Ingress rules exposing the service.",
	"webhookSecret":                 "Secret used to authenticate webhook calls.",
	"apiKey":                        "API key used to authenticate with the service.",
	"organization":                  "Organization identifier for the provider.",
	"authHook":                      "Webhook used to authenticate GraphQL requests.",
	"logs":                          "Logging configuration for the service.",
	"events":                        "Event delivery configuration.",
	"security":                      "Security controls for the GraphQL API.",
	"node":                          "Node.js runtime configuration for functions.",
	"elevatedPrivileges":            "Settings for elevated-privilege operations.",
	"mode":                          "How elevated privileges are granted.",
	"redirections":                  "Allowed post-authentication redirect URLs.",
	"signUp":                        "User sign-up settings.",
	"turnstile":                     "Cloudflare Turnstile bot-protection settings.",
	"secretKey":                     "Secret key used to verify Turnstile tokens.",
	"user":                          "Default settings applied to users.",
	"roles":                         "Default and allowed roles for users.",
	"locale":                        "Default and allowed locales for users.",
	"gravatar":                      "Gravatar avatar settings.",
	"emailDomains":                  "Allowed and blocked email domains for sign-up.",
	"session":                       "Access and refresh token settings.",
	"accessToken":                   "Access token settings.",
	"refreshToken":                  "Refresh token settings.",
	"expiresIn":                     "Token lifetime, in seconds.",
	"method":                        "Available authentication methods.",
	"totp":                          "Time-based one-time password (TOTP) authentication.",
	"anonymous":                     "Anonymous (guest) sign-in.",
	"emailPasswordless":             "Passwordless sign-in via email magic link.",
	"otp":                           "One-time password (OTP) sign-in.",
	"emailPassword":                 "Email and password sign-in.",
	"smsPasswordless":               "Passwordless sign-in via SMS.",
	"oauth":                         "OAuth social sign-in providers.",
	"webauthn":                      "WebAuthn / passkey sign-in.",
	"emailVerificationRequired":     "Require users to verify their email before signing in.",
	"passwordMinLength":             "Minimum allowed password length.",
	"apple":                         "Apple OAuth provider.",
	"azuread":                       "Azure AD OAuth provider.",
	"bitbucket":                     "Bitbucket OAuth provider.",
	"discord":                       "Discord OAuth provider.",
	"entraid":                       "Microsoft Entra ID OAuth provider.",
	"facebook":                      "Facebook OAuth provider.",
	"github":                        "GitHub OAuth provider.",
	"gitlab":                        "GitLab OAuth provider.",
	"google":                        "Google OAuth provider.",
	"linkedin":                      "LinkedIn OAuth provider.",
	"spotify":                       "Spotify OAuth provider.",
	"strava":                        "Strava OAuth provider.",
	"twitch":                        "Twitch OAuth provider.",
	"twitter":                       "Twitter (X) OAuth provider.",
	"windowslive":                   "Microsoft account (Windows Live) OAuth provider.",
	"workos":                        "WorkOS OAuth provider.",
	"audience":                      "Expected audience claim for the provider's tokens.",
	"scope":                         "OAuth scopes requested from the provider.",
	"tenant":                        "Directory (tenant) ID for the provider.",
	"connection":                    "Specific connection to use for the provider.",
	"relyingParty":                  "WebAuthn relying party settings.",
	"attestation":                   "WebAuthn attestation conveyance settings.",
	"id":                            "Relying party identifier (typically your domain).",
	"name":                          "Human-readable relying party name.",
	"origins":                       "Allowed origins for WebAuthn ceremonies.",
	"timeout":                       "Timeout, in milliseconds, for WebAuthn ceremonies.",
	"oauth2Provider":                "Settings for acting as an OAuth 2.0 provider.",
	"clientIdMetadataDocument":      "Client ID metadata document settings.",
	"misc":                          "Miscellaneous authentication settings.",
	"concealErrors":                 "Hide detailed error messages from API responses.",
	"pitr":                          "Point-in-time recovery settings.",
	"storage":                       "Persistent disk storage.",
	"enablePublicAccess":            "Expose the database on a public endpoint.",
	"capacity":                      "Storage capacity, in gigabytes.",
	"jit":                           "Enable just-in-time compilation of queries.",
	"maxConnections":                "Maximum number of concurrent database connections.",
	"sharedBuffers":                 "Memory dedicated to the shared buffer cache.",
	"effectiveCacheSize":            "Planner estimate of memory available for disk caching.",
	"maintenanceWorkMem":            "Memory used for maintenance operations such as VACUUM.",
	"checkpointCompletionTarget":    "Target fraction of the checkpoint interval over which to spread writes.",
	"walBuffers":                    "Memory used for write-ahead log buffers.",
	"defaultStatisticsTarget":       "Default sample size for table statistics.",
	"randomPageCost":                "Planner's estimated cost of a non-sequential disk page fetch.",
	"effectiveIOConcurrency":        "Number of concurrent disk I/O operations the planner expects.",
	"workMem":                       "Memory used per query operation before spilling to disk.",
	"hugePages":                     "Whether to use huge memory pages.",
	"minWalSize":                    "Minimum size to shrink the write-ahead log to.",
	"maxWalSize":                    "Maximum write-ahead log size before a checkpoint is triggered.",
	"maxWorkerProcesses":            "Maximum number of background worker processes.",
	"maxParallelWorkersPerGather":   "Maximum parallel workers per Gather node.",
	"maxParallelWorkers":            "Maximum parallel workers across the system.",
	"maxParallelMaintenanceWorkers": "Maximum parallel workers for maintenance operations.",
	"walLevel":                      "Amount of information written to the write-ahead log.",
	"maxWalSenders":                 "Maximum number of concurrent WAL sender processes.",
	"maxReplicationSlots":           "Maximum number of replication slots.",
	"archiveTimeout":                "Force a WAL segment switch after this many seconds.",
	"trackIoTiming":                 "Collect timing statistics for disk I/O.",
	"retention":                     "Number of days to retain backups.",
	"smtp":                          "SMTP server used to send emails.",
	"sms":                           "SMS provider configuration.",
	"antivirus":                     "Antivirus scanning for uploaded files.",
	"server":                        "Address of the antivirus (ClamAV) server.",
	"openai":                        "OpenAI API configuration.",
	"autoEmbeddings":                "Automatic embeddings generation settings.",
	"synchPeriodMinutes":            "How often, in minutes, embeddings are synchronized.",
	"grafana":                       "Grafana dashboards and alerting configuration.",
	"constellation":                 "Constellation GraphQL engine settings.",
	"limit":                         "Maximum number of requests allowed per interval.",
	"interval":                      "Length of the rate-limit window.",
	"forbidAminSecret":              "Reject requests authenticated with the admin secret.",
	"maxDepthQueries":               "Maximum allowed depth of a GraphQL query.",
	"emails":                        "Email addresses to notify.",
	"bruteForce":                    "Rate limit to mitigate brute-force attacks.",
	"signups":                       "Rate limit for new sign-ups.",
	"global":                        "Global rate limit applied across all auth endpoints.",
	"oauth2Server":                  "Rate limit for OAuth 2.0 server endpoints.",
	"provider":                      "SMS provider to use.",
	"accountSid":                    "Provider account SID.",
	"authToken":                     "Provider auth token.",
	"messagingServiceId":            "Provider messaging service ID.",
	"adminPassword":                 "Admin password for Grafana.",
	"alerting":                      "Grafana alerting configuration.",
	"contacts":                      "Contact points for Grafana alerts.",
	"host":                          "SMTP server hostname.",
	"port":                          "SMTP server port.",
	"sender":                        "From address for outgoing emails.",
	"password":                      "Password for SMTP authentication.",
	"pagerduty":                     "PagerDuty alert contact.",
	"slack":                         "Slack alert contact.",
	"webhook":                       "Webhook alert contact.",
	"fqdn":                          "Fully-qualified domain names for the ingress.",
	"tls":                           "TLS configuration for the ingress.",
	"clientCA":                      "Client certificate authority for mutual TLS.",
}

func dedupeStrings(in []string) []string {
	seen := map[string]bool{}

	out := in[:0]
	for _, s := range in {
		if seen[s] {
			continue
		}

		seen[s] = true
		out = append(out, s)
	}

	return out
}

// slug mirrors github-slugger (used by Starlight for heading anchors): lowercase,
// drop characters that are not alphanumeric/space/hyphen, spaces to hyphens.
func slug(s string) string {
	s = strings.ToLower(s)

	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-':
			b.WriteRune(r)
		case r == ' ':
			b.WriteRune('-')
		}
	}

	return b.String()
}
