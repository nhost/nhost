package main

import "github.com/nhost/nhost/internal/lib/clidocs"

// agentHints maps space-separated command paths (relative to the root) to the
// AgentHints attached to that command. Keep snippets short and concrete so
// the LLM has actionable, non-redundant guidance.
//
// Skipped on purpose: mcp, gen-docs, gen-json-docs, help.
var agentHints = map[string]clidocs.AgentHints{
	"": {
		PromptGuidelines: []string{
			"Run `nhost login` first if any command fails with an authentication error.",
			"Run `nhost project link` in a fresh checkout before commands that touch a specific cloud project (deployments, secrets, config apply/pull, run *).",
		},
	},

	// ── user ─────────────────────────────────────────────────────────────
	"login": {
		PromptSnippet: "Authenticate with Nhost Cloud (interactive browser flow).",
	},

	// ── project ──────────────────────────────────────────────────────────
	"init": {
		PromptSnippet: "Scaffold a new Nhost project in the current directory.",
		Destructive:   true,
		ExecutionMode: "sequential",
	},
	"list": {
		PromptSnippet: "List remote Nhost apps available to the logged-in account.",
		RequiresAuth:  true,
	},
	"link": {
		PromptSnippet: "Link the current working directory to a remote Nhost app.",
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},

	// ── dev (local stack) ────────────────────────────────────────────────
	"up": {
		PromptSnippet: "Start the local Nhost dev stack (postgres, hasura, auth, storage). Long-running.",
		PromptGuidelines: []string{
			"`nhost up` blocks; launch it in a background process or separate terminal.",
		},
		LongRunning:   true,
		ExecutionMode: "sequential",
		Examples: []clidocs.AgentExample{
			{Args: []string{"up"}, Description: "Start with defaults"},
			{Args: []string{"up", "--http-port", "1337"}, Description: "Custom HTTP port"},
		},
	},
	"up cloud": {
		PromptSnippet: "Start a local dev environment connected to a cloud project (BETA).",
		LongRunning:   true,
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},
	"down": {
		PromptSnippet: "Stop the local dev stack and free its containers/ports.",
		ExecutionMode: "sequential",
	},
	"logs": {
		PromptSnippet: "Tail logs from running services in the local dev stack.",
		LongRunning:   true,
	},
	"dev compose": {
		PromptSnippet: "Pass-through to docker compose with project name and compose file pre-set.",
		PromptGuidelines: []string{
			"Use `nhost dev compose` instead of plain `docker compose` so the project name and compose file resolve to this stack.",
		},
	},
	"dev hasura": {
		PromptSnippet: "Pass-through to hasura-cli scoped to this project (migrations, seeds, console).",
	},

	// ── config (project) ─────────────────────────────────────────────────
	"config default": {
		PromptSnippet: "Write a default nhost.toml plus secrets file into the project.",
		Destructive:   true,
		ExecutionMode: "sequential",
	},
	"config example": {
		PromptSnippet: "Print an example nhost.toml to stdout.",
	},
	"config show": {
		PromptSnippet: "Show resolved configuration after applying secrets and overlays.",
	},
	"config validate": {
		PromptSnippet: "Validate local configuration against the schema.",
	},
	"config edit": {
		PromptSnippet: "Open `$EDITOR` on the base config or an overlay.",
		ExecutionMode: "sequential",
	},
	"config apply": {
		PromptSnippet: "Apply the local configuration to the linked cloud project.",
		Destructive:   true,
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},
	"config pull": {
		PromptSnippet: "Download the linked cloud project's configuration.",
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},

	// ── deployments ──────────────────────────────────────────────────────
	"deployments list": {
		PromptSnippet: "List deployments for the linked cloud project.",
		RequiresAuth:  true,
	},
	"deployments logs": {
		PromptSnippet: "Tail deployment logs for a cloud deployment.",
		RequiresAuth:  true,
		LongRunning:   true,
	},
	"deployments new": {
		PromptSnippet: "[EXPERIMENTAL] Trigger a new deployment.",
		Destructive:   true,
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},

	// ── docker-credentials ───────────────────────────────────────────────
	"docker-credentials configure": {
		PromptSnippet: "Install the docker credential helper for nhost.run/registry.",
		Destructive:   true,
		ExecutionMode: "sequential",
	},

	// ── docs (bundled CLI documentation) ─────────────────────────────────
	"docs list": {
		PromptSnippet: "List bundled Nhost CLI documentation pages.",
	},
	"docs search": {
		PromptSnippet: "Search the bundled CLI documentation by keyword.",
	},
	"docs show": {
		PromptSnippet: "Display a bundled documentation page by id.",
	},

	// ── run (managed services) ───────────────────────────────────────────
	"run config-show": {
		PromptSnippet: "Show resolved Run service configuration after secret resolution.",
		RequiresAuth:  true,
	},
	"run config-deploy": {
		PromptSnippet: "Deploy a Run service configuration to the cloud.",
		Destructive:   true,
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},
	"run config-edit": {
		PromptSnippet: "Open `$EDITOR` on a Run service configuration.",
		ExecutionMode: "sequential",
	},
	"run config-edit-image": {
		PromptSnippet: "Edit a Run service config and set its container image tag.",
		ExecutionMode: "sequential",
	},
	"run config-pull": {
		PromptSnippet: "Download a Run service configuration.",
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},
	"run config-validate": {
		PromptSnippet: "Validate a Run service configuration locally.",
	},
	"run config-example": {
		PromptSnippet: "Print an example Run service configuration.",
	},
	"run env": {
		PromptSnippet: "Print Run service environment variables (useful for generating .env files).",
	},

	// ── secrets ──────────────────────────────────────────────────────────
	"secrets list": {
		PromptSnippet: "List secrets for the linked cloud project (values redacted).",
		RequiresAuth:  true,
	},
	"secrets create": {
		PromptSnippet: "Create a new cloud secret.",
		Destructive:   true,
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},
	"secrets update": {
		PromptSnippet: "Update an existing cloud secret.",
		Destructive:   true,
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},
	"secrets delete": {
		PromptSnippet: "Delete a cloud secret.",
		Destructive:   true,
		RequiresAuth:  true,
		ExecutionMode: "sequential",
	},

	// ── software (self-management) ───────────────────────────────────────
	"sw version": {
		PromptSnippet: "Print the installed Nhost CLI version.",
	},
	"sw upgrade": {
		PromptSnippet: "Upgrade the installed Nhost CLI to the latest release.",
		Destructive:   true,
		ExecutionMode: "sequential",
	},
	"sw uninstall": {
		PromptSnippet: "Remove the installed Nhost CLI from the system.",
		Destructive:   true,
		ExecutionMode: "sequential",
	},
}
