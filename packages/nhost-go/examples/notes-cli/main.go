package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/urfave/cli/v3"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/graphql"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/storage"
)

const (
	argumentName = "arguments"
	bucket       = "notes"
	twoArgs      = 2
	filePerm     = 0o600
)

// Sentinel errors keep the command handlers free of dynamic errors (err113)
// and let callers match with errors.Is.
var (
	errNothingToUpdate = errors.New("nothing to update (pass --title and/or --content)")
	errNotLoggedIn     = errors.New("not logged in")
	errNoteNotFound    = errors.New("note not found")
	errNotePermission  = errors.New("note not found or not permitted")
	errCreateNote      = errors.New("could not create note")
	errCreateNotebook  = errors.New("could not create notebook")
	errCreateTag       = errors.New("could not create tag")
	errUploadFailed    = errors.New("upload failed")
	errTooManyArgs     = errors.New("too many arguments")
	errUnknownCommand  = errors.New("unknown command")
)

// client is built once in the root command's Before hook and reused by every
// subcommand's Action.
var client *nhost.Client //nolint:gochecknoglobals

type graphQLID struct {
	ID string `json:"id"`
}

type noteTagData struct {
	Tag struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	} `json:"tag"`
}

type noteSummary struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	IsPinned bool   `json:"is_pinned"`
	Notebook *struct {
		Name string `json:"name"`
	} `json:"notebook"`
	NoteTags []noteTagData `json:"noteTags"`
}

type noteDetail struct {
	Title       string        `json:"title"`
	Content     string        `json:"content"`
	IsPinned    bool          `json:"is_pinned"`
	IsArchived  bool          `json:"is_archived"`
	NoteTags    []noteTagData `json:"noteTags"`
	Attachments []struct {
		File struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			MimeType string `json:"mimeType"`
		} `json:"file"`
	} `json:"attachments"`
	Collaborators []struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	} `json:"collaborators"`
}

func main() {
	if err := rootCmd().Run(context.Background(), os.Args); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

// rootCmd builds the cli command tree. The UX is flat: every verb is a
// top-level command (kebab-case), so there's no `note <sub>` nesting.
func rootCmd() *cli.Command { //nolint:funlen,maintidx
	root := &cli.Command{ //nolint:exhaustruct
		Name:                  "notes-cli",
		Usage:                 "A note-taking CLI built on the Nhost Go SDK",
		EnableShellCompletion: true,
		ConfigureShellCompletionCommand: func(command *cli.Command) {
			command.Hidden = false
			command.Usage = "Generate the autocompletion script for the specified shell"
		},
		Before: func(ctx context.Context, _ *cli.Command) (context.Context, error) {
			client = newClient()

			return ctx, nil
		},
		Action: commandHelp,
		Commands: []*cli.Command{
			{
				Name:      "signup",
				Usage:     "Create an account (and sign in if email verification is off)",
				Arguments: commandArguments("EMAIL PASSWORD", twoArgs, twoArgs),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return cmdSignup(ctx, client, args[0], args[1])
				}),
			},
			{
				Name:      "login",
				Usage:     "Sign in with email and password",
				Arguments: commandArguments("EMAIL PASSWORD", twoArgs, twoArgs),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return cmdLogin(ctx, client, args[0], args[1])
				}),
			},
			{
				Name:  "logout",
				Usage: "Sign out and clear the saved session",
				Action: withArgs(func(ctx context.Context, _ *cli.Command, _ []string) error {
					return cmdLogout(ctx, client)
				}),
			},
			{
				Name:  "whoami",
				Usage: "Show the currently signed-in user",
				Action: withArgs(func(_ context.Context, _ *cli.Command, _ []string) error {
					return cmdWhoami(client)
				}),
			},
			{
				Name:      "new",
				Usage:     "Create a note",
				Arguments: commandArguments("TITLE", 1, 1),
				Flags: []cli.Flag{
					&cli.StringFlag{ //nolint:exhaustruct
						Name:  "content",
						Usage: "note body",
					},
					&cli.StringFlag{ //nolint:exhaustruct
						Name:  "notebook",
						Usage: "notebook id",
					},
				},
				Action: withArgs(func(ctx context.Context, cmd *cli.Command, args []string) error {
					return noteNew(ctx, client, args[0], cmd.String("content"), cmd.String("notebook"))
				}),
			},
			{
				Name:  "ls",
				Usage: "List your notes",
				Flags: []cli.Flag{
					&cli.BoolFlag{ //nolint:exhaustruct
						Name:  "archived",
						Usage: "show archived notes",
					},
					&cli.StringFlag{ //nolint:exhaustruct
						Name:  "tag",
						Usage: "filter by tag name",
					},
				},
				Action: withArgs(func(ctx context.Context, cmd *cli.Command, _ []string) error {
					return noteLs(ctx, client, cmd.Bool("archived"), cmd.String("tag"))
				}),
			},
			{
				Name:      "show",
				Usage:     "Show a single note in full",
				Arguments: commandArguments("ID", 1, 1),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return noteShow(ctx, client, args[0])
				}),
			},
			{
				Name:      "edit",
				Usage:     "Edit a note's title and/or content",
				Arguments: commandArguments("ID", 1, 1),
				Flags: []cli.Flag{
					&cli.StringFlag{ //nolint:exhaustruct
						Name:  "title",
						Usage: "new title",
					},
					&cli.StringFlag{ //nolint:exhaustruct
						Name:  "content",
						Usage: "new content",
					},
				},
				Action: withArgs(func(ctx context.Context, cmd *cli.Command, args []string) error {
					set := map[string]any{}
					if cmd.IsSet("title") {
						set["title"] = cmd.String("title")
					}

					if cmd.IsSet("content") {
						set["content"] = cmd.String("content")
					}

					if len(set) == 0 {
						return errNothingToUpdate
					}

					return updateNote(ctx, client, args[0], set)
				}),
			},
			{
				Name:      "pin",
				Usage:     "Pin a note",
				Arguments: commandArguments("ID", 1, 1),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return updateNote(ctx, client, args[0], map[string]any{"is_pinned": true})
				}),
			},
			{
				Name:      "unpin",
				Usage:     "Unpin a note",
				Arguments: commandArguments("ID", 1, 1),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return updateNote(ctx, client, args[0], map[string]any{"is_pinned": false})
				}),
			},
			{
				Name:      "archive",
				Usage:     "Archive a note",
				Arguments: commandArguments("ID", 1, 1),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return updateNote(ctx, client, args[0], map[string]any{"is_archived": true})
				}),
			},
			{
				Name:      "rm",
				Usage:     "Delete a note",
				Arguments: commandArguments("ID", 1, 1),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return noteRm(ctx, client, args[0])
				}),
			},
			{
				Name:      "mv",
				Usage:     "Move a note into a notebook",
				Arguments: commandArguments("ID NOTEBOOK_ID", twoArgs, twoArgs),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return updateNote(ctx, client, args[0], map[string]any{"notebook_id": args[1]})
				}),
			},
			{
				Name:   "notebook",
				Usage:  "Manage notebooks",
				Action: commandHelp,
				Commands: []*cli.Command{
					{
						Name:      "new",
						Usage:     "Create a notebook",
						Arguments: commandArguments("NAME", 1, 1),
						Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
							return notebookNew(ctx, client, args[0])
						}),
					},
					{
						Name:  "ls",
						Usage: "List your notebooks",
						Action: withArgs(func(ctx context.Context, _ *cli.Command, _ []string) error {
							return notebookLs(ctx, client)
						}),
					},
				},
			},
			{
				Name:   "tag",
				Usage:  "Manage tags (and tag/untag notes)",
				Action: commandHelp,
				Commands: []*cli.Command{
					{
						Name:  "ls",
						Usage: "List your tags",
						Action: withArgs(func(ctx context.Context, _ *cli.Command, _ []string) error {
							return tagLs(ctx, client)
						}),
					},
					{
						Name:      "new",
						Usage:     "Create a tag",
						Arguments: commandArguments("NAME", 1, 1),
						Flags: []cli.Flag{
							&cli.StringFlag{ //nolint:exhaustruct
								Name:  "color",
								Usage: "hex color",
								Value: "#808080",
							},
						},
						Action: withArgs(func(ctx context.Context, cmd *cli.Command, args []string) error {
							return tagNew(ctx, client, args[0], cmd.String("color"))
						}),
					},
					{
						Name:      "add",
						Usage:     "Add a tag to a note (creates the tag if needed)",
						Arguments: commandArguments("NOTE_ID TAG_NAME", twoArgs, twoArgs),
						Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
							return noteTag(ctx, client, args[0], args[1])
						}),
					},
					{
						Name:      "rm",
						Usage:     "Remove a tag from a note",
						Arguments: commandArguments("NOTE_ID TAG_NAME", twoArgs, twoArgs),
						Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
							return noteUntag(ctx, client, args[0], args[1])
						}),
					},
				},
			},
			{
				Name:      "attach",
				Usage:     "Upload a file and attach it to a note",
				Arguments: commandArguments("NOTE_ID FILE", twoArgs, twoArgs),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return cmdAttach(ctx, client, args[0], args[1])
				}),
			},
			{
				Name:      "download",
				Usage:     "Download a file by id",
				Arguments: commandArguments("FILE_ID OUT_PATH", twoArgs, twoArgs),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return cmdDownload(ctx, client, args[0], args[1])
				}),
			},
			{
				Name:      "share",
				Usage:     "Share a note with another user",
				Arguments: commandArguments("NOTE_ID USER_ID", twoArgs, twoArgs),
				Flags: []cli.Flag{
					&cli.StringFlag{ //nolint:exhaustruct
						Name:  "role",
						Usage: "viewer|editor",
						Value: "viewer",
					},
				},
				Action: withArgs(func(ctx context.Context, cmd *cli.Command, args []string) error {
					return cmdShare(ctx, client, args[0], args[1], cmd.String("role"))
				}),
			},
			{
				Name:      "unshare",
				Usage:     "Remove a collaborator from a note",
				Arguments: commandArguments("NOTE_ID USER_ID", twoArgs, twoArgs),
				Action: withArgs(func(ctx context.Context, _ *cli.Command, args []string) error {
					return cmdUnshare(ctx, client, args[0], args[1])
				}),
			},
			{
				Name:  "export",
				Usage: "Export your notes via a serverless function",
				Action: withArgs(func(ctx context.Context, _ *cli.Command, _ []string) error {
					return cmdExport(ctx, client)
				}),
			},
		},
	}

	silenceUsage(root)

	return root
}

// commandArguments declares a command's positional argument range. withArgs
// also rejects anything left after Max, because cli.StringArgs retains extras.
func commandArguments(usage string, minArgs, maxArgs int) []cli.Argument {
	return []cli.Argument{
		&cli.StringArgs{ //nolint:exhaustruct
			Name:      argumentName,
			UsageText: usage,
			Min:       minArgs,
			Max:       maxArgs,
		},
	}
}

func withArgs(action func(context.Context, *cli.Command, []string) error) cli.ActionFunc {
	return func(ctx context.Context, cmd *cli.Command) error {
		args := cmd.StringArgs(argumentName)
		if cmd.Args().Present() {
			return fmt.Errorf(
				"%w: got %d, want at most %d",
				errTooManyArgs,
				len(args)+cmd.Args().Len(),
				len(args),
			)
		}

		return action(ctx, cmd, args)
	}
}

func commandHelp(_ context.Context, cmd *cli.Command) error {
	if cmd.Args().Present() {
		return fmt.Errorf("%w: %q", errUnknownCommand, cmd.Args().First())
	}

	if err := cli.ShowSubcommandHelp(cmd); err != nil {
		return fmt.Errorf("show command help: %w", err)
	}

	return nil
}

// silenceUsage preserves the concise error UX: command errors are returned to
// main without cli printing an additional usage page.
func silenceUsage(cmd *cli.Command) {
	cmd.OnUsageError = func(_ context.Context, _ *cli.Command, err error, _ bool) error {
		return err
	}

	for _, subcommand := range cmd.Commands {
		silenceUsage(subcommand)
	}
}

func newClient() *nhost.Client {
	return nhost.New(nhost.Options{ //nolint:exhaustruct
		Subdomain: env("NHOST_SUBDOMAIN", "local"),
		Region:    env("NHOST_REGION", "local"),
		Storage:   &session.FileStorage{Path: sessionPath()},
	})
}

func sessionPath() string {
	if p := os.Getenv("NHOST_NOTES_SESSION"); p != "" {
		return p
	}

	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}

	return filepath.Join(dir, "nhost-notes", "session.json")
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}

	return fallback
}

// --- auth -------------------------------------------------------------------

func cmdLogin(ctx context.Context, c *nhost.Client, email, password string) error {
	if _, _, err := c.Auth.SignInEmailPassword(ctx, auth.SignInEmailPasswordRequest{
		Email:    email,
		Password: password,
	}, nil); err != nil {
		return fmt.Errorf("sign in: %w", err)
	}

	fmt.Fprintln(os.Stdout, "logged in as", email)

	return nil
}

func cmdSignup(ctx context.Context, c *nhost.Client, email, password string) error {
	if _, _, err := c.Auth.SignUpEmailPassword(
		ctx,
		auth.SignUpEmailPasswordRequest{ //nolint:exhaustruct
			Email:    email,
			Password: password,
		},
		nil,
	); err != nil {
		return fmt.Errorf("sign up: %w", err)
	}

	if _, ok := c.GetUserSession(); ok {
		fmt.Fprintln(os.Stdout, "signed up and logged in as", email)
	} else {
		fmt.Fprintln(os.Stdout, "signed up; verify your email, then `login`")
	}

	return nil
}

func cmdLogout(ctx context.Context, c *nhost.Client) error {
	if s, ok := c.GetUserSession(); ok {
		rt := s.RefreshToken
		_, _, _ = c.Auth.SignOut(
			ctx,
			auth.SignOutRequest{ //nolint:exhaustruct
				RefreshToken: &rt,
			},
			nil,
		)
	}

	c.ClearSession()
	fmt.Fprintln(os.Stdout, "logged out")

	return nil
}

func cmdWhoami(c *nhost.Client) error {
	s, ok := c.GetUserSession()
	if !ok || s.User == nil {
		return errNotLoggedIn
	}

	email := ""
	if s.User.Email != nil {
		email = *s.User.Email
	}

	fmt.Fprintf(os.Stdout, "%s (%s)\n", email, s.User.ID)

	return nil
}

// --- notes ------------------------------------------------------------------

func noteNew(ctx context.Context, c *nhost.Client, title, content, notebook string) error {
	obj := map[string]any{"title": title, "content": content}
	if notebook != "" {
		obj["notebook_id"] = notebook
	}

	var data struct {
		Note *graphQLID `json:"insert_notes_one"`
	}

	_, err := c.GraphQL.Request(ctx, `
		mutation NewNote($obj: notes_insert_input!) {
			insert_notes_one(object: $obj) { id title }
		}`, graphql.Variables{"obj": obj}, &data)
	if err != nil {
		return fmt.Errorf("create note: %w", err)
	}

	if data.Note == nil {
		return errCreateNote
	}

	fmt.Fprintln(os.Stdout, "created", data.Note.ID)

	return nil
}

func noteLs(ctx context.Context, c *nhost.Client, archived bool, tag string) error {
	where := map[string]any{"is_archived": map[string]any{"_eq": archived}}
	if tag != "" {
		where["noteTags"] = map[string]any{
			"tag": map[string]any{"name": map[string]any{"_eq": tag}},
		}
	}

	var data struct {
		Notes []noteSummary `json:"notes"`
	}

	_, err := c.GraphQL.Request(ctx, `
		query Notes($where: notes_bool_exp!) {
			notes(where: $where, order_by: [{is_pinned: desc}, {updated_at: desc}]) {
				id title is_pinned notebook { name } noteTags { tag { name } }
			}
		}`, graphql.Variables{"where": where}, &data)
	if err != nil {
		return fmt.Errorf("list notes: %w", err)
	}

	if len(data.Notes) == 0 {
		fmt.Fprintln(os.Stdout, "(no notes)")
		return nil
	}

	for _, note := range data.Notes {
		pin := " "
		if note.IsPinned {
			pin = "*"
		}

		notebook := ""
		if note.Notebook != nil {
			notebook = "  [" + note.Notebook.Name + "]"
		}

		fmt.Fprintf(
			os.Stdout,
			"%s %s  %s%s%s\n",
			pin,
			note.ID,
			note.Title,
			notebook,
			tagList(note.NoteTags),
		)
	}

	return nil
}

func noteShow(ctx context.Context, c *nhost.Client, id string) error {
	var data struct {
		Note *noteDetail `json:"notes_by_pk"`
	}

	_, err := c.GraphQL.Request(ctx, `
		query Note($id: uuid!) {
			notes_by_pk(id: $id) {
				id title content is_pinned is_archived
				notebook { name }
				noteTags { tag { name color } }
				attachments { file { id name mimeType size } }
				collaborators { user_id role }
			}
		}`, graphql.Variables{"id": id}, &data)
	if err != nil {
		return fmt.Errorf("show note: %w", err)
	}

	if data.Note == nil {
		return errNoteNotFound
	}

	note := data.Note
	fmt.Fprintf(os.Stdout, "# %s\n\n%s\n", note.Title, note.Content)
	fmt.Fprintf(
		os.Stdout,
		"\npinned=%v archived=%v%s\n",
		note.IsPinned,
		note.IsArchived,
		tagList(note.NoteTags),
	)

	if len(note.Attachments) > 0 {
		fmt.Fprintln(os.Stdout, "attachments:")

		for _, attachment := range note.Attachments {
			fmt.Fprintf(
				os.Stdout,
				"  %s  %s (%s)\n",
				attachment.File.ID,
				attachment.File.Name,
				attachment.File.MimeType,
			)
		}
	}

	if len(note.Collaborators) > 0 {
		fmt.Fprintln(os.Stdout, "shared with:")

		for _, collaborator := range note.Collaborators {
			fmt.Fprintf(os.Stdout, "  %s (%s)\n", collaborator.UserID, collaborator.Role)
		}
	}

	return nil
}

func updateNote(ctx context.Context, c *nhost.Client, id string, set map[string]any) error {
	var data struct {
		Note *graphQLID `json:"update_notes_by_pk"`
	}

	_, err := c.GraphQL.Request(ctx, `
		mutation UpdateNote($id: uuid!, $set: notes_set_input!) {
			update_notes_by_pk(pk_columns: {id: $id}, _set: $set) { id }
		}`, graphql.Variables{"id": id, "set": set}, &data)
	if err != nil {
		return fmt.Errorf("update note: %w", err)
	}

	if data.Note == nil {
		return errNotePermission
	}

	fmt.Fprintln(os.Stdout, "updated", id)

	return nil
}

func noteRm(ctx context.Context, c *nhost.Client, id string) error {
	var data struct {
		Note *graphQLID `json:"delete_notes_by_pk"`
	}

	_, err := c.GraphQL.Request(ctx, `
		mutation DeleteNote($id: uuid!) {
			delete_notes_by_pk(id: $id) { id }
		}`, graphql.Variables{"id": id}, &data)
	if err != nil {
		return fmt.Errorf("delete note: %w", err)
	}

	if data.Note == nil {
		return errNotePermission
	}

	fmt.Fprintln(os.Stdout, "deleted", id)

	return nil
}

func noteTag(ctx context.Context, c *nhost.Client, noteID, tagName string) error {
	tagID, err := upsertTag(ctx, c, tagName, "")
	if err != nil {
		return err
	}

	if _, err := c.GraphQL.Request(ctx, `
		mutation TagNote($noteId: uuid!, $tagId: uuid!) {
			insert_note_tags_one(
				object: {note_id: $noteId, tag_id: $tagId}
				on_conflict: {constraint: note_tags_pkey, update_columns: []}
			) { note_id }
		}`, graphql.Variables{"noteId": noteID, "tagId": tagID}, nil); err != nil {
		return fmt.Errorf("tag note: %w", err)
	}

	fmt.Fprintf(os.Stdout, "tagged %s with #%s\n", noteID, tagName)

	return nil
}

func noteUntag(ctx context.Context, c *nhost.Client, noteID, tagName string) error {
	if _, err := c.GraphQL.Request(ctx, `
		mutation Untag($noteId: uuid!, $name: String!) {
			delete_note_tags(where: {note_id: {_eq: $noteId}, tag: {name: {_eq: $name}}}) {
				affected_rows
			}
		}`, graphql.Variables{"noteId": noteID, "name": tagName}, nil); err != nil {
		return fmt.Errorf("untag note: %w", err)
	}

	fmt.Fprintf(os.Stdout, "removed #%s from %s\n", tagName, noteID)

	return nil
}

// --- notebooks & tags -------------------------------------------------------

func notebookNew(ctx context.Context, c *nhost.Client, name string) error {
	var data struct {
		Notebook *graphQLID `json:"insert_notebooks_one"`
	}

	_, err := c.GraphQL.Request(ctx, `
		mutation NewNotebook($name: String!) {
			insert_notebooks_one(object: {name: $name}) { id name }
		}`, graphql.Variables{"name": name}, &data)
	if err != nil {
		return fmt.Errorf("create notebook: %w", err)
	}

	if data.Notebook == nil {
		return errCreateNotebook
	}

	fmt.Fprintln(os.Stdout, "created", data.Notebook.ID)

	return nil
}

func notebookLs(ctx context.Context, c *nhost.Client) error {
	var data struct {
		Notebooks []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"notebooks"`
	}

	_, err := c.GraphQL.Request(
		ctx,
		`query { notebooks(order_by: {name: asc}) { id name } }`,
		nil,
		&data,
	)
	if err != nil {
		return fmt.Errorf("list notebooks: %w", err)
	}

	for _, notebook := range data.Notebooks {
		fmt.Fprintf(os.Stdout, "%s  %s\n", notebook.ID, notebook.Name)
	}

	return nil
}

func tagNew(ctx context.Context, c *nhost.Client, name, color string) error {
	id, err := upsertTag(ctx, c, name, color)
	if err != nil {
		return err
	}

	fmt.Fprintln(os.Stdout, "created", id)

	return nil
}

func tagLs(ctx context.Context, c *nhost.Client) error {
	var data struct {
		Tags []struct {
			ID    string `json:"id"`
			Name  string `json:"name"`
			Color string `json:"color"`
		} `json:"tags"`
	}

	_, err := c.GraphQL.Request(
		ctx,
		`query { tags(order_by: {name: asc}) { id name color } }`,
		nil,
		&data,
	)
	if err != nil {
		return fmt.Errorf("list tags: %w", err)
	}

	for _, tag := range data.Tags {
		fmt.Fprintf(os.Stdout, "%s  %-16s %s\n", tag.ID, tag.Name, tag.Color)
	}

	return nil
}

// upsertTag creates the tag (or returns the existing one) and returns its id.
func upsertTag(ctx context.Context, c *nhost.Client, name, color string) (string, error) {
	obj := map[string]any{"name": name}
	// Always update `name` on conflict so the upsert returns the existing row's
	// id (an empty update_columns makes Hasura DO NOTHING and return null).
	update := []string{"name"}
	if color != "" {
		obj["color"] = color

		update = append(update, "color")
	}

	var data struct {
		Tag *graphQLID `json:"insert_tags_one"`
	}

	_, err := c.GraphQL.Request(ctx, `
		mutation UpsertTag($obj: tags_insert_input!, $update: [tags_update_column!]!) {
			insert_tags_one(
				object: $obj
				on_conflict: {constraint: tags_user_id_name_key, update_columns: $update}
			) { id }
		}`, graphql.Variables{"obj": obj, "update": update}, &data)
	if err != nil {
		return "", fmt.Errorf("upsert tag: %w", err)
	}

	if data.Tag == nil {
		return "", errCreateTag
	}

	return data.Tag.ID, nil
}

// --- storage & sharing ------------------------------------------------------

func cmdAttach(ctx context.Context, c *nhost.Client, noteID, file string) error {
	raw, err := os.ReadFile(file)
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}

	name := filepath.Base(file)
	b := bucket

	up, _, err := c.Storage.UploadFiles(ctx, storage.UploadFilesBody{
		BucketID: &b,
		File:     [][]byte{raw},
		Metadata: &[]storage.UploadFileMetadata{{Name: &name}}, //nolint:exhaustruct
	}, nil)
	if err != nil {
		return fmt.Errorf("upload: %w", err)
	}

	if len(up.ProcessedFiles) == 0 {
		return errUploadFailed
	}

	fileID := up.ProcessedFiles[0].ID
	if _, err := c.GraphQL.Request(ctx, `
		mutation Attach($noteId: uuid!, $fileId: uuid!) {
			insert_note_attachments_one(object: {note_id: $noteId, file_id: $fileId}) { file_id }
		}`, graphql.Variables{"noteId": noteID, "fileId": fileID}, nil); err != nil {
		return fmt.Errorf("attach file: %w", err)
	}

	fmt.Fprintf(os.Stdout, "attached %s (file %s) to %s\n", name, fileID, noteID)

	return nil
}

func cmdDownload(ctx context.Context, c *nhost.Client, fileID, outPath string) error {
	data, _, err := c.Storage.GetFile(ctx, fileID, nil, nil)
	if err != nil {
		return fmt.Errorf("get file: %w", err)
	}

	if err := os.WriteFile(outPath, data, filePerm); err != nil {
		return fmt.Errorf("write file: %w", err)
	}

	fmt.Fprintf(os.Stdout, "wrote %d bytes to %s\n", len(data), outPath)

	return nil
}

func cmdShare(ctx context.Context, c *nhost.Client, noteID, userID, role string) error {
	if _, err := c.GraphQL.Request(ctx, `
		mutation Share($noteId: uuid!, $userId: uuid!, $role: String!) {
			insert_note_collaborators_one(
				object: {note_id: $noteId, user_id: $userId, role: $role}
				on_conflict: {constraint: note_collaborators_pkey, update_columns: [role]}
			) { note_id role }
		}`, graphql.Variables{"noteId": noteID, "userId": userID, "role": role}, nil); err != nil {
		return fmt.Errorf("share note: %w", err)
	}

	fmt.Fprintf(os.Stdout, "shared %s with %s as %s\n", noteID, userID, role)

	return nil
}

func cmdUnshare(ctx context.Context, c *nhost.Client, noteID, userID string) error {
	if _, err := c.GraphQL.Request(ctx, `
		mutation Unshare($noteId: uuid!, $userId: uuid!) {
			delete_note_collaborators_by_pk(note_id: $noteId, user_id: $userId) { note_id }
		}`, graphql.Variables{"noteId": noteID, "userId": userID}, nil); err != nil {
		return fmt.Errorf("unshare note: %w", err)
	}

	fmt.Fprintf(os.Stdout, "unshared %s from %s\n", noteID, userID)

	return nil
}

// --- functions --------------------------------------------------------------

func cmdExport(ctx context.Context, c *nhost.Client) error {
	body, _, err := c.Functions.Post(ctx, "/notes/export", struct{}{}, nil)
	if err != nil {
		return fmt.Errorf("call function: %w", err)
	}

	out, err := json.MarshalIndent(body, "", "  ")
	if err != nil {
		return fmt.Errorf("encode export: %w", err)
	}

	fmt.Fprintln(os.Stdout, string(out))

	return nil
}

// --- small helpers ----------------------------------------------------------

func tagList(tags []noteTagData) string {
	if len(tags) == 0 {
		return ""
	}

	var sb strings.Builder

	sb.WriteString("  ")

	for _, tag := range tags {
		sb.WriteString("#" + tag.Tag.Name + " ")
	}

	return sb.String()
}
