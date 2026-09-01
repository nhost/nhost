package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/graphql"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/storage"
)

const (
	bucket   = "notes"
	twoArgs  = 2
	filePerm = 0o600
)

// Sentinel errors keep the command handlers free of dynamic errors (err113)
// and let callers match with errors.Is.
var (
	errNothingToUpdate = errors.New("nothing to update (pass --title and/or --content)")
	errNotLoggedIn     = errors.New("not logged in")
	errNoteNotFound    = errors.New("note not found")
	errNotePermission  = errors.New("note not found or not permitted")
	errCreateTag       = errors.New("could not create tag")
	errUploadFailed    = errors.New("upload failed")
)

// client is built once in the root command's PersistentPreRun and reused by
// every subcommand's RunE.
var client *nhost.Client //nolint:gochecknoglobals

func main() {
	if err := rootCmd().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

// rootCmd builds the cobra command tree. The UX is flat: every verb is a
// top-level command (kebab-case), so there's no `note <sub>` nesting.
func rootCmd() *cobra.Command { //nolint:funlen,maintidx
	root := &cobra.Command{ //nolint:exhaustruct
		Use:           "notes-cli",
		Short:         "A note-taking CLI built on the Nhost Go SDK",
		SilenceUsage:  true,
		SilenceErrors: true,
		PersistentPreRun: func(_ *cobra.Command, _ []string) {
			client = newClient()
		},
	}

	ctx := context.Background()

	// --- auth ---------------------------------------------------------------

	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "signup EMAIL PASSWORD",
		Short: "Create an account (and sign in if email verification is off)",
		Args:  cobra.ExactArgs(twoArgs),
		RunE: func(_ *cobra.Command, args []string) error {
			return cmdSignup(ctx, client, args[0], args[1])
		},
	})
	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "login EMAIL PASSWORD",
		Short: "Sign in with email and password",
		Args:  cobra.ExactArgs(twoArgs),
		RunE: func(_ *cobra.Command, args []string) error {
			return cmdLogin(ctx, client, args[0], args[1])
		},
	})
	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "logout",
		Short: "Sign out and clear the saved session",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return cmdLogout(ctx, client)
		},
	})
	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "whoami",
		Short: "Show the currently signed-in user",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return cmdWhoami(client)
		},
	})

	// --- notes --------------------------------------------------------------

	var noteNewContent, noteNewNotebook string

	noteNewCmd := &cobra.Command{ //nolint:exhaustruct
		Use:   "new TITLE",
		Short: "Create a note",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return noteNew(ctx, client, args[0], noteNewContent, noteNewNotebook)
		},
	}
	noteNewCmd.Flags().StringVar(&noteNewContent, "content", "", "note body")
	noteNewCmd.Flags().StringVar(&noteNewNotebook, "notebook", "", "notebook id")
	root.AddCommand(noteNewCmd)

	var (
		noteLsArchived bool
		noteLsTag      string
	)

	noteLsCmd := &cobra.Command{ //nolint:exhaustruct
		Use:   "ls",
		Short: "List your notes",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return noteLs(ctx, client, noteLsArchived, noteLsTag)
		},
	}
	noteLsCmd.Flags().BoolVar(&noteLsArchived, "archived", false, "show archived notes")
	noteLsCmd.Flags().StringVar(&noteLsTag, "tag", "", "filter by tag name")
	root.AddCommand(noteLsCmd)

	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "show ID",
		Short: "Show a single note in full",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return noteShow(ctx, client, args[0])
		},
	})

	var noteEditTitle, noteEditContent string

	noteEditCmd := &cobra.Command{ //nolint:exhaustruct
		Use:   "edit ID",
		Short: "Edit a note's title and/or content",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			set := map[string]any{}
			if cmd.Flags().Changed("title") {
				set["title"] = noteEditTitle
			}

			if cmd.Flags().Changed("content") {
				set["content"] = noteEditContent
			}

			if len(set) == 0 {
				return errNothingToUpdate
			}

			return updateNote(ctx, client, args[0], set)
		},
	}
	noteEditCmd.Flags().StringVar(&noteEditTitle, "title", "", "new title")
	noteEditCmd.Flags().StringVar(&noteEditContent, "content", "", "new content")
	root.AddCommand(noteEditCmd)

	// pin / unpin / archive all share the updateNote helper.
	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "pin ID",
		Short: "Pin a note",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return updateNote(ctx, client, args[0], map[string]any{"is_pinned": true})
		},
	})
	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "unpin ID",
		Short: "Unpin a note",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return updateNote(ctx, client, args[0], map[string]any{"is_pinned": false})
		},
	})
	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "archive ID",
		Short: "Archive a note",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return updateNote(ctx, client, args[0], map[string]any{"is_archived": true})
		},
	})
	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "rm ID",
		Short: "Delete a note",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return noteRm(ctx, client, args[0])
		},
	})
	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "mv ID NOTEBOOK_ID",
		Short: "Move a note into a notebook",
		Args:  cobra.ExactArgs(twoArgs),
		RunE: func(_ *cobra.Command, args []string) error {
			return updateNote(ctx, client, args[0], map[string]any{"notebook_id": args[1]})
		},
	})

	// --- notebooks ----------------------------------------------------------

	notebookCmd := &cobra.Command{ //nolint:exhaustruct
		Use:   "notebook",
		Short: "Manage notebooks",
	}
	notebookCmd.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "new NAME",
		Short: "Create a notebook",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return notebookNew(ctx, client, args[0])
		},
	})
	notebookCmd.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "ls",
		Short: "List your notebooks",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return notebookLs(ctx, client)
		},
	})
	root.AddCommand(notebookCmd)

	// --- tags ---------------------------------------------------------------

	tagCmd := &cobra.Command{ //nolint:exhaustruct
		Use:   "tag",
		Short: "Manage tags (and tag/untag notes)",
	}
	tagCmd.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "ls",
		Short: "List your tags",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return tagLs(ctx, client)
		},
	})

	var tagNewColor string

	tagNewCmd := &cobra.Command{ //nolint:exhaustruct
		Use:   "new NAME",
		Short: "Create a tag",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return tagNew(ctx, client, args[0], tagNewColor)
		},
	}
	tagNewCmd.Flags().StringVar(&tagNewColor, "color", "#808080", "hex color")
	tagCmd.AddCommand(tagNewCmd)

	tagCmd.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "add NOTE_ID TAG_NAME",
		Short: "Add a tag to a note (creates the tag if needed)",
		Args:  cobra.ExactArgs(twoArgs),
		RunE: func(_ *cobra.Command, args []string) error {
			return noteTag(ctx, client, args[0], args[1])
		},
	})
	tagCmd.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "rm NOTE_ID TAG_NAME",
		Short: "Remove a tag from a note",
		Args:  cobra.ExactArgs(twoArgs),
		RunE: func(_ *cobra.Command, args []string) error {
			return noteUntag(ctx, client, args[0], args[1])
		},
	})
	root.AddCommand(tagCmd)

	// --- storage & sharing --------------------------------------------------

	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "attach NOTE_ID FILE",
		Short: "Upload a file and attach it to a note",
		Args:  cobra.ExactArgs(twoArgs),
		RunE: func(_ *cobra.Command, args []string) error {
			return cmdAttach(ctx, client, args[0], args[1])
		},
	})
	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "download FILE_ID OUT_PATH",
		Short: "Download a file by id",
		Args:  cobra.ExactArgs(twoArgs),
		RunE: func(_ *cobra.Command, args []string) error {
			return cmdDownload(ctx, client, args[0], args[1])
		},
	})

	var shareRole string

	shareCmd := &cobra.Command{ //nolint:exhaustruct
		Use:   "share NOTE_ID USER_ID",
		Short: "Share a note with another user",
		Args:  cobra.ExactArgs(twoArgs),
		RunE: func(_ *cobra.Command, args []string) error {
			return cmdShare(ctx, client, args[0], args[1], shareRole)
		},
	}
	shareCmd.Flags().StringVar(&shareRole, "role", "viewer", "viewer|editor")
	root.AddCommand(shareCmd)

	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "unshare NOTE_ID USER_ID",
		Short: "Remove a collaborator from a note",
		Args:  cobra.ExactArgs(twoArgs),
		RunE: func(_ *cobra.Command, args []string) error {
			return cmdUnshare(ctx, client, args[0], args[1])
		},
	})

	// --- functions ----------------------------------------------------------

	root.AddCommand(&cobra.Command{ //nolint:exhaustruct
		Use:   "export",
		Short: "Export your notes via a serverless function",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return cmdExport(ctx, client)
		},
	})

	return root
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

// gql runs a GraphQL operation and returns the decoded data map. GraphQL errors
// surface as a non-nil error (the SDK returns a *transport.APIError).
func gql(
	ctx context.Context,
	c *nhost.Client,
	query string,
	vars graphql.Variables,
) (map[string]any, error) {
	res, _, err := c.GraphQL.Request(ctx, query, vars, "", nil)
	if err != nil {
		return nil, fmt.Errorf("graphql request: %w", err)
	}

	return res.Data, nil
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
		_, _, _ = c.Auth.SignOut(ctx, auth.SignOutRequest{RefreshToken: &rt}, nil) //nolint:exhaustruct
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

	data, err := gql(ctx, c, `
		mutation NewNote($obj: notes_insert_input!) {
			insert_notes_one(object: $obj) { id title }
		}`, graphql.Variables{"obj": obj})
	if err != nil {
		return err
	}

	fmt.Fprintln(os.Stdout, "created", str(dig(data, "insert_notes_one", "id")))

	return nil
}

func noteLs(ctx context.Context, c *nhost.Client, archived bool, tag string) error {
	where := map[string]any{"is_archived": map[string]any{"_eq": archived}}
	if tag != "" {
		where["noteTags"] = map[string]any{
			"tag": map[string]any{"name": map[string]any{"_eq": tag}},
		}
	}

	data, err := gql(ctx, c, `
		query Notes($where: notes_bool_exp!) {
			notes(where: $where, order_by: [{is_pinned: desc}, {updated_at: desc}]) {
				id title is_pinned notebook { name } noteTags { tag { name } }
			}
		}`, graphql.Variables{"where": where})
	if err != nil {
		return err
	}

	notes, _ := data["notes"].([]any)
	if len(notes) == 0 {
		fmt.Fprintln(os.Stdout, "(no notes)")
		return nil
	}

	for _, n := range notes {
		m, _ := n.(map[string]any)

		pin := " "
		if b, _ := m["is_pinned"].(bool); b {
			pin = "*"
		}

		nb := ""
		if book, ok := m["notebook"].(map[string]any); ok && book != nil {
			nb = "  [" + str(book["name"]) + "]"
		}

		fmt.Fprintf(
			os.Stdout,
			"%s %s  %s%s%s\n",
			pin,
			str(m["id"]),
			str(m["title"]),
			nb,
			tagList(m),
		)
	}

	return nil
}

func noteShow(ctx context.Context, c *nhost.Client, id string) error {
	data, err := gql(ctx, c, `
		query Note($id: uuid!) {
			notes_by_pk(id: $id) {
				id title content is_pinned is_archived
				notebook { name }
				noteTags { tag { name color } }
				attachments { file { id name mimeType size } }
				collaborators { user_id role }
			}
		}`, graphql.Variables{"id": id})
	if err != nil {
		return err
	}

	n, ok := data["notes_by_pk"].(map[string]any)
	if !ok || n == nil {
		return errNoteNotFound
	}

	fmt.Fprintf(os.Stdout, "# %s\n\n%s\n", str(n["title"]), str(n["content"]))
	fmt.Fprintf(
		os.Stdout,
		"\npinned=%v archived=%v%s\n",
		n["is_pinned"],
		n["is_archived"],
		tagList(n),
	)

	if atts, _ := n["attachments"].([]any); len(atts) > 0 {
		fmt.Fprintln(os.Stdout, "attachments:")

		for _, a := range atts {
			if f, ok := a.(map[string]any)["file"].(map[string]any); ok {
				fmt.Fprintf(
					os.Stdout,
					"  %s  %s (%s)\n",
					str(f["id"]),
					str(f["name"]),
					str(f["mimeType"]),
				)
			}
		}
	}

	if cols, _ := n["collaborators"].([]any); len(cols) > 0 {
		fmt.Fprintln(os.Stdout, "shared with:")

		for _, cl := range cols {
			m, _ := cl.(map[string]any)
			fmt.Fprintf(os.Stdout, "  %s (%s)\n", str(m["user_id"]), str(m["role"]))
		}
	}

	return nil
}

func updateNote(ctx context.Context, c *nhost.Client, id string, set map[string]any) error {
	data, err := gql(ctx, c, `
		mutation UpdateNote($id: uuid!, $set: notes_set_input!) {
			update_notes_by_pk(pk_columns: {id: $id}, _set: $set) { id }
		}`, graphql.Variables{"id": id, "set": set})
	if err != nil {
		return err
	}

	if dig(data, "update_notes_by_pk", "id") == nil {
		return errNotePermission
	}

	fmt.Fprintln(os.Stdout, "updated", id)

	return nil
}

func noteRm(ctx context.Context, c *nhost.Client, id string) error {
	data, err := gql(ctx, c, `
		mutation DeleteNote($id: uuid!) {
			delete_notes_by_pk(id: $id) { id }
		}`, graphql.Variables{"id": id})
	if err != nil {
		return err
	}

	if dig(data, "delete_notes_by_pk", "id") == nil {
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

	if _, err := gql(ctx, c, `
		mutation TagNote($noteId: uuid!, $tagId: uuid!) {
			insert_note_tags_one(
				object: {note_id: $noteId, tag_id: $tagId}
				on_conflict: {constraint: note_tags_pkey, update_columns: []}
			) { note_id }
		}`, graphql.Variables{"noteId": noteID, "tagId": tagID}); err != nil {
		return err
	}

	fmt.Fprintf(os.Stdout, "tagged %s with #%s\n", noteID, tagName)

	return nil
}

func noteUntag(ctx context.Context, c *nhost.Client, noteID, tagName string) error {
	if _, err := gql(ctx, c, `
		mutation Untag($noteId: uuid!, $name: String!) {
			delete_note_tags(where: {note_id: {_eq: $noteId}, tag: {name: {_eq: $name}}}) {
				affected_rows
			}
		}`, graphql.Variables{"noteId": noteID, "name": tagName}); err != nil {
		return err
	}

	fmt.Fprintf(os.Stdout, "removed #%s from %s\n", tagName, noteID)

	return nil
}

// --- notebooks & tags -------------------------------------------------------

func notebookNew(ctx context.Context, c *nhost.Client, name string) error {
	data, err := gql(ctx, c, `
		mutation NewNotebook($name: String!) {
			insert_notebooks_one(object: {name: $name}) { id name }
		}`, graphql.Variables{"name": name})
	if err != nil {
		return err
	}

	fmt.Fprintln(os.Stdout, "created", str(dig(data, "insert_notebooks_one", "id")))

	return nil
}

func notebookLs(ctx context.Context, c *nhost.Client) error {
	data, err := gql(ctx, c, `query { notebooks(order_by: {name: asc}) { id name } }`, nil)
	if err != nil {
		return err
	}

	for _, nb := range asSlice(data["notebooks"]) {
		m, _ := nb.(map[string]any)
		fmt.Fprintf(os.Stdout, "%s  %s\n", str(m["id"]), str(m["name"]))
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
	data, err := gql(ctx, c, `query { tags(order_by: {name: asc}) { id name color } }`, nil)
	if err != nil {
		return err
	}

	for _, t := range asSlice(data["tags"]) {
		m, _ := t.(map[string]any)
		fmt.Fprintf(os.Stdout, "%s  %-16s %s\n", str(m["id"]), str(m["name"]), str(m["color"]))
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

	data, err := gql(ctx, c, `
		mutation UpsertTag($obj: tags_insert_input!, $update: [tags_update_column!]!) {
			insert_tags_one(
				object: $obj
				on_conflict: {constraint: tags_user_id_name_key, update_columns: $update}
			) { id }
		}`, graphql.Variables{"obj": obj, "update": update})
	if err != nil {
		return "", err
	}

	id := str(dig(data, "insert_tags_one", "id"))
	if id == "" {
		return "", errCreateTag
	}

	return id, nil
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
	if _, err := gql(ctx, c, `
		mutation Attach($noteId: uuid!, $fileId: uuid!) {
			insert_note_attachments_one(object: {note_id: $noteId, file_id: $fileId}) { file_id }
		}`, graphql.Variables{"noteId": noteID, "fileId": fileID}); err != nil {
		return err
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
	if _, err := gql(ctx, c, `
		mutation Share($noteId: uuid!, $userId: uuid!, $role: String!) {
			insert_note_collaborators_one(
				object: {note_id: $noteId, user_id: $userId, role: $role}
				on_conflict: {constraint: note_collaborators_pkey, update_columns: [role]}
			) { note_id role }
		}`, graphql.Variables{"noteId": noteID, "userId": userID, "role": role}); err != nil {
		return err
	}

	fmt.Fprintf(os.Stdout, "shared %s with %s as %s\n", noteID, userID, role)

	return nil
}

func cmdUnshare(ctx context.Context, c *nhost.Client, noteID, userID string) error {
	if _, err := gql(ctx, c, `
		mutation Unshare($noteId: uuid!, $userId: uuid!) {
			delete_note_collaborators_by_pk(note_id: $noteId, user_id: $userId) { note_id }
		}`, graphql.Variables{"noteId": noteID, "userId": userID}); err != nil {
		return err
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

func dig(m map[string]any, keys ...string) any {
	var cur any = m
	for _, k := range keys {
		mm, ok := cur.(map[string]any)
		if !ok {
			return nil
		}

		cur = mm[k]
	}

	return cur
}

func asSlice(v any) []any {
	s, _ := v.([]any)
	return s
}

func str(v any) string {
	s, _ := v.(string)
	return s
}

func tagList(note map[string]any) string {
	nts, _ := note["noteTags"].([]any)
	if len(nts) == 0 {
		return ""
	}

	var sb strings.Builder

	sb.WriteString("  ")

	for _, nt := range nts {
		if tag, ok := nt.(map[string]any)["tag"].(map[string]any); ok {
			sb.WriteString("#" + str(tag["name"]) + " ")
		}
	}

	return sb.String()
}
