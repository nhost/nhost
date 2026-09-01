package provider

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestBuildConfiguredProviders(t *testing.T) {
	t.Parallel()

	maxName := strings.Repeat("a", 63)
	tests := []struct {
		name      string
		raw       string
		wantNames []string
	}{
		{name: "unset", raw: "", wantNames: nil},
		{name: "whitespace", raw: " \n\t\r ", wantNames: nil},
		{name: "empty array", raw: "[]", wantNames: nil},
		{
			name:      "omitted headers",
			raw:       providerDeclarationJSON("openai", "https://api.openai.com/v1", ""),
			wantNames: []string{"openai"},
		},
		{
			name: "empty headers",
			raw: providerDeclarationJSON(
				"openai_compatible",
				"http://localhost:11434/v1",
				`,"headers":{}`,
			),
			wantNames: []string{"openai_compatible"},
		},
		{
			name: "historical names",
			raw: "[" + strings.Join([]string{
				providerDeclarationObject("anthropic", "https://example.com/v1", ""),
				providerDeclarationObject("google", "https://example.com/v1", ""),
				providerDeclarationObject("openai", "https://example.com/v1", ""),
				providerDeclarationObject("openai_compatible", "https://example.com/v1", ""),
			}, ",") + "]",
			wantNames: []string{"anthropic", "google", "openai", "openai_compatible"},
		},
		{
			name: "type equal name",
			raw: providerDeclarationJSON(
				providerTypeOpenAIChatCompletions,
				"https://example.com/v1",
				``,
			),
			wantNames: []string{providerTypeOpenAIChatCompletions},
		},
		{
			name: "maximum name and trusted network endpoints",
			raw: "[" + strings.Join([]string{
				providerDeclarationObject(maxName, "http://127.0.0.1:8080/v1", ""),
				providerDeclarationObject("private-network", "http://10.0.0.7/v1", ""),
				providerDeclarationObject("ipv6.loopback", "http://[::1]:8080/v1", ""),
			}, ",") + "]",
			wantNames: []string{maxName, "private-network", "ipv6.loopback"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			registry, typesByName, err := buildConfiguredProviders(test.raw)
			if err != nil {
				t.Fatalf("build configured providers: %v", err)
			}

			if len(registry) != len(test.wantNames) {
				t.Fatalf("registry length = %d, want %d", len(registry), len(test.wantNames))
			}

			wantTypes := make(map[string]string, len(test.wantNames))
			for _, name := range test.wantNames {
				provider, ok := registry[name]
				if !ok {
					t.Errorf("registry is missing provider %q", name)
					continue
				}

				if _, ok := provider.(*OpenAIChatCompletions); !ok {
					t.Errorf("provider %q has concrete type %T", name, provider)
				}

				wantTypes[name] = providerTypeOpenAIChatCompletions
			}

			if diff := cmp.Diff(wantTypes, typesByName); diff != "" {
				t.Errorf("provider type metadata mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestBuildProviderRegistryRejectsUnsupportedProviderType(t *testing.T) {
	t.Parallel()

	registry, typesByName, err := buildProviderRegistry([]providerDeclaration{
		{
			name:           "configured-provider",
			typeDescriptor: nil,
			configuration: endpointConfiguration{
				baseURL: "https://example.com/v1",
				headers: nil,
			},
		},
	})
	if !errors.Is(err, errInvalidAgentProviderConfiguration) {
		t.Fatalf("error = %v, want configuration error", err)
	}

	if registry != nil || typesByName != nil {
		t.Fatalf("partial result = %#v, %#v; want nil results", registry, typesByName)
	}

	for _, want := range []string{"declaration 0", "configured-provider", "unsupported provider type"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not contain safe context %q", err, want)
		}
	}

	if strings.Contains(err.Error(), "secret-marker") {
		t.Errorf("error exposed unsupported provider type: %v", err)
	}
}

func TestBuildConfiguredProvidersRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	invalidUTF8 := string([]byte{'[', 0xff, ']'})
	longName := strings.Repeat("a", 64)
	valid := providerDeclarationObject("first", "https://example.com/v1", "")
	tests := []struct {
		name string
		raw  string
	}{
		{name: "null root", raw: "null"},
		{name: "object root", raw: "{}"},
		{name: "null declaration", raw: "[null]"},
		{name: "BOM", raw: "\ufeff[]"},
		{name: "invalid UTF-8", raw: invalidUTF8},
		{name: "trailing object", raw: "[] {}"},
		{name: "trailing scalar", raw: "[] true"},
		{name: "unterminated array", raw: "["},
		{name: "unknown declaration field", raw: `[{
			"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1"},"unknown":"secret-marker"
		}]`},
		{name: "duplicate declaration name", raw: `[{
			"name":"p","name":"other","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1"}
		}]`},
		{name: "duplicate declaration type", raw: `[{
			"name":"p","type":"openai_chat_completions","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1"}
		}]`},
		{name: "duplicate declaration configuration", raw: `[{
			"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1"},"configuration":{"base_url":"https://example.com/v1"}
		}]`},
		{
			name: "missing name",
			raw:  `[{"type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1"}}]`,
		},
		{
			name: "missing type",
			raw:  `[{"name":"p","configuration":{"base_url":"https://example.com/v1"}}]`,
		},
		{name: "missing configuration", raw: `[{"name":"p","type":"openai_chat_completions"}]`},
		{
			name: "null configuration",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":null}]`,
		},
		{
			name: "array configuration",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":[]}]`,
		},
		{
			name: "non-string name",
			raw:  `[{"name":1,"type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1"}}]`,
		},
		{
			name: "non-string type",
			raw:  `[{"name":"p","type":1,"configuration":{"base_url":"https://example.com/v1"}}]`,
		},
		{
			name: "unknown configuration field",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1","unknown":"secret-marker"}}]`,
		},
		{
			name: "duplicate base URL",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1","base_url":"https://example.com/v2"}}]`,
		},
		{
			name: "duplicate headers field",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1","headers":{},"headers":{}}}]`,
		},
		{
			name: "missing base URL",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{}}]`,
		},
		{
			name: "empty base URL",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":""}}]`,
		},
		{
			name: "non-string base URL",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":1}}]`,
		},
		{
			name: "null headers",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1","headers":null}}]`,
		},
		{
			name: "array headers",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1","headers":[]}}]`,
		},
		{
			name: "non-string header",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1","headers":{"X-Secret":1}}}]`,
		},
		{
			name: "null header",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1","headers":{"X-Secret":null}}}]`,
		},
		{
			name: "exact duplicate header",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1","headers":{"X-Test":"one","X-Test":"two"}}}]`,
		},
		{
			name: "case-fold duplicate header",
			raw:  `[{"name":"p","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/v1","headers":{"X-Test":"one","x-test":"two"}}}]`,
		},
		{name: "duplicate provider names", raw: "[" + valid + "," + valid + "]"},
		{
			name: "unknown provider type",
			raw:  `[{"name":"p","type":"secret-marker","configuration":{"base_url":"https://example.com/v1"}}]`,
		},
		{
			name: "empty provider name",
			raw:  providerDeclarationJSON("", "https://example.com/v1", ""),
		},
		{
			name: "64-byte provider name",
			raw:  providerDeclarationJSON(longName, "https://example.com/v1", ""),
		},
		{
			name: "uppercase provider name",
			raw:  providerDeclarationJSON("OpenAI", "https://example.com/v1", ""),
		},
		{
			name: "leading separator",
			raw:  providerDeclarationJSON("-openai", "https://example.com/v1", ""),
		},
		{
			name: "trailing separator",
			raw:  providerDeclarationJSON("openai-", "https://example.com/v1", ""),
		},
		{
			name: "repeated separator",
			raw:  providerDeclarationJSON("openai--one", "https://example.com/v1", ""),
		},
		{
			name: "separator sequence",
			raw:  providerDeclarationJSON("openai._one", "https://example.com/v1", ""),
		},
		{
			name: "userinfo URL",
			raw:  providerDeclarationJSON("p", "https://user:secret-marker@example.com/v1", ""),
		},
		{
			name: "query URL",
			raw:  providerDeclarationJSON("p", "https://example.com/v1?token=secret-marker", ""),
		},
		{
			name: "fragment URL",
			raw:  providerDeclarationJSON("p", "https://example.com/v1#secret-marker", ""),
		},
		{
			name: "complete operation URL",
			raw:  providerDeclarationJSON("p", "https://example.com/v1/chat/completions", ""),
		},
		{
			name: "unsafe common header",
			raw: providerDeclarationJSON(
				"p",
				"https://example.com/v1",
				`,"headers":{"Host":"secret-marker"}`,
			),
		},
		{
			name: "SDK-owned header",
			raw: providerDeclarationJSON(
				"p",
				"https://example.com/v1",
				`,"headers":{"X-Stainless-Secret":"secret-marker"}`,
			),
		},
		{
			name: "invalid header value",
			raw: providerDeclarationJSON(
				"p",
				"https://example.com/v1",
				`,"headers":{"X-Test":"secret-marker\u000a"}`,
			),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			registry, typesByName, err := buildConfiguredProviders(test.raw)
			if !errors.Is(err, errInvalidAgentProviderConfiguration) {
				t.Fatalf("error = %v, want configuration error", err)
			}

			if registry != nil || typesByName != nil {
				t.Fatalf("partial result = %#v, %#v; want nil results", registry, typesByName)
			}

			if strings.Contains(err.Error(), "secret-marker") ||
				strings.Contains(err.Error(), "https://") {
				t.Errorf("error exposed rejected configuration: %v", err)
			}
		})
	}
}

func TestBuildConfiguredProvidersErrorIsAttributableAndAtomic(t *testing.T) {
	t.Parallel()

	raw := "[" +
		providerDeclarationObject("first", "https://example.com/v1", "") + "," +
		providerDeclarationObject(
			"second",
			"https://example.com/secret-url-marker",
			`,"headers":{"Host":"secret-header-marker"}`,
		) + "]"

	registry, typesByName, err := buildConfiguredProviders(raw)
	if !errors.Is(err, errInvalidAgentProviderConfiguration) {
		t.Fatalf("error = %v, want configuration error", err)
	}

	if registry != nil || typesByName != nil {
		t.Fatalf("partial result = %#v, %#v; want nil results", registry, typesByName)
	}

	for _, want := range []string{"declaration 1", "second", "invalid headers"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not contain safe context %q", err, want)
		}
	}

	for _, marker := range []string{"secret-url-marker", "secret-header-marker"} {
		if strings.Contains(err.Error(), marker) {
			t.Errorf("error exposed marker %q: %v", marker, err)
		}
	}
}

func providerDeclarationJSON(name, baseURL, headersSuffix string) string {
	return "[" + providerDeclarationObject(name, baseURL, headersSuffix) + "]"
}

func providerDeclarationObject(name, baseURL, headersSuffix string) string {
	return fmt.Sprintf(
		`{"name":%q,"type":%q,"configuration":{"base_url":%q%s}}`,
		name,
		providerTypeOpenAIChatCompletions,
		baseURL,
		headersSuffix,
	)
}
