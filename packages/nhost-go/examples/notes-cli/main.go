// Command notes-cli is a small note-taking CLI built on the Nhost Go SDK.
//
// It demonstrates the SDK end to end against the "notes" quickstart backend:
//
//	Auth     — login/logout/whoami, with the session persisted to a JSON file
//	           (session middleware attaches + refreshes the token automatically)
//	GraphQL  — notes, notebooks and tags CRUD (permissions enforced by Hasura)
//	Storage  — attach/download files in the "notes" bucket
//	Functions— `export` calls the notes/export serverless function
//
// Configuration (env, all optional):
//
//	NHOST_SUBDOMAIN       default "local"
//	NHOST_REGION          default "local"
//	NHOST_NOTES_SESSION   session file path (default under os.UserConfigDir)
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/graphql"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/storage"
)

const bucket = "notes"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	if err := run(context.Background(), os.Args[1], os.Args[2:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, cmd string, args []string) error {
	c := newClient()
	switch cmd {
	case "login":
		return cmdLogin(ctx, c, args)
	case "signup":
		return cmdSignup(ctx, c, args)
	case "logout":
		return cmdLogout(ctx, c)
	case "whoami":
		return cmdWhoami(c)
	case "note":
		return cmdNote(ctx, c, args)
	case "notebook":
		return cmdNotebook(ctx, c, args)
	case "tag":
		return cmdTag(ctx, c, args)
	case "attach":
		return cmdAttach(ctx, c, args)
	case "download":
		return cmdDownload(ctx, c, args)
	case "share":
		return cmdShare(ctx, c, args)
	case "unshare":
		return cmdUnshare(ctx, c, args)
	case "export":
		return cmdExport(ctx, c)
	case "help", "-h", "--help":
		usage()
		return nil
	default:
		usage()
		return fmt.Errorf("unknown command %q", cmd)
	}
}

// --- client & helpers -------------------------------------------------------

func newClient() *nhost.Client {
	return nhost.CreateClient(nhost.Options{
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
// surface as a non-nil error (the SDK returns a *fetch.FetchError).
func gql(ctx context.Context, c *nhost.Client, query string, vars graphql.Variables) (map[string]any, error) {
	resp, err := c.GraphQL.Request(ctx, query, vars, "", nil)
	if err != nil {
		return nil, err
	}
	return resp.Body.Data, nil
}

func requireArgs(args []string, n int, hint string) error {
	if len(args) < n {
		return fmt.Errorf("expected %s", hint)
	}
	return nil
}

// --- auth -------------------------------------------------------------------

func cmdLogin(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 2, "login <email> <password>"); err != nil {
		return err
	}
	if _, err := c.Auth.SignInEmailPassword(ctx, auth.SignInEmailPasswordRequest{
		Email:    args[0],
		Password: args[1],
	}, nil); err != nil {
		return err
	}
	fmt.Println("logged in as", args[0])
	return nil
}

func cmdSignup(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 2, "signup <email> <password>"); err != nil {
		return err
	}
	if _, err := c.Auth.SignUpEmailPassword(ctx, auth.SignUpEmailPasswordRequest{
		Email:    args[0],
		Password: args[1],
	}, nil); err != nil {
		return err
	}
	if _, ok := c.GetUserSession(); ok {
		fmt.Println("signed up and logged in as", args[0])
	} else {
		fmt.Println("signed up; verify your email, then `login`")
	}
	return nil
}

func cmdLogout(ctx context.Context, c *nhost.Client) error {
	if s, ok := c.GetUserSession(); ok {
		rt := s.RefreshToken
		_, _ = c.Auth.SignOut(ctx, auth.SignOutRequest{RefreshToken: &rt}, nil)
	}
	c.ClearSession()
	fmt.Println("logged out")
	return nil
}

func cmdWhoami(c *nhost.Client) error {
	s, ok := c.GetUserSession()
	if !ok || s.User == nil {
		return errors.New("not logged in")
	}
	email := ""
	if s.User.Email != nil {
		email = *s.User.Email
	}
	fmt.Printf("%s (%s)\n", email, s.User.ID)
	return nil
}

// --- notes ------------------------------------------------------------------

func cmdNote(ctx context.Context, c *nhost.Client, args []string) error {
	if len(args) == 0 {
		return errors.New("note <new|ls|show|edit|pin|unpin|archive|rm|mv|tag|untag> ...")
	}
	sub, rest := args[0], args[1:]
	switch sub {
	case "new":
		return noteNew(ctx, c, rest)
	case "ls":
		return noteLs(ctx, c, rest)
	case "show":
		return noteShow(ctx, c, rest)
	case "edit":
		return noteEdit(ctx, c, rest)
	case "pin":
		return notePinned(ctx, c, rest, true)
	case "unpin":
		return notePinned(ctx, c, rest, false)
	case "archive":
		return noteArchive(ctx, c, rest)
	case "rm":
		return noteRm(ctx, c, rest)
	case "mv":
		return noteMv(ctx, c, rest)
	case "tag":
		return noteTag(ctx, c, rest)
	case "untag":
		return noteUntag(ctx, c, rest)
	default:
		return fmt.Errorf("unknown note subcommand %q", sub)
	}
}

func noteNew(ctx context.Context, c *nhost.Client, args []string) error {
	fs := flag.NewFlagSet("note new", flag.ContinueOnError)
	content := fs.String("content", "", "note body")
	notebook := fs.String("notebook", "", "notebook id")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() < 1 {
		return errors.New("note new [--content c] [--notebook id] <title>")
	}
	obj := map[string]any{"title": fs.Arg(0), "content": *content}
	if *notebook != "" {
		obj["notebook_id"] = *notebook
	}
	data, err := gql(ctx, c, `
		mutation NewNote($obj: notes_insert_input!) {
			insert_notes_one(object: $obj) { id title }
		}`, graphql.Variables{"obj": obj})
	if err != nil {
		return err
	}
	fmt.Println("created", str(dig(data, "insert_notes_one", "id")))
	return nil
}

func noteLs(ctx context.Context, c *nhost.Client, args []string) error {
	fs := flag.NewFlagSet("note ls", flag.ContinueOnError)
	archived := fs.Bool("archived", false, "show archived notes")
	tag := fs.String("tag", "", "filter by tag name")
	if err := fs.Parse(args); err != nil {
		return err
	}
	where := map[string]any{"is_archived": map[string]any{"_eq": *archived}}
	if *tag != "" {
		where["noteTags"] = map[string]any{"tag": map[string]any{"name": map[string]any{"_eq": *tag}}}
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
		fmt.Println("(no notes)")
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
		fmt.Printf("%s %s  %s%s%s\n", pin, str(m["id"]), str(m["title"]), nb, tagList(m))
	}
	return nil
}

func noteShow(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 1, "note show <id>"); err != nil {
		return err
	}
	data, err := gql(ctx, c, `
		query Note($id: uuid!) {
			notes_by_pk(id: $id) {
				id title content is_pinned is_archived
				notebook { name }
				noteTags { tag { name color } }
				attachments { file { id name mimeType size } }
				collaborators { user_id role }
			}
		}`, graphql.Variables{"id": args[0]})
	if err != nil {
		return err
	}
	n, ok := data["notes_by_pk"].(map[string]any)
	if !ok || n == nil {
		return errors.New("note not found")
	}
	fmt.Printf("# %s\n\n%s\n", str(n["title"]), str(n["content"]))
	fmt.Printf("\npinned=%v archived=%v%s\n", n["is_pinned"], n["is_archived"], tagList(n))
	if atts, _ := n["attachments"].([]any); len(atts) > 0 {
		fmt.Println("attachments:")
		for _, a := range atts {
			if f, ok := a.(map[string]any)["file"].(map[string]any); ok {
				fmt.Printf("  %s  %s (%s)\n", str(f["id"]), str(f["name"]), str(f["mimeType"]))
			}
		}
	}
	if cols, _ := n["collaborators"].([]any); len(cols) > 0 {
		fmt.Println("shared with:")
		for _, cl := range cols {
			m, _ := cl.(map[string]any)
			fmt.Printf("  %s (%s)\n", str(m["user_id"]), str(m["role"]))
		}
	}
	return nil
}

func noteEdit(ctx context.Context, c *nhost.Client, args []string) error {
	fs := flag.NewFlagSet("note edit", flag.ContinueOnError)
	title := fs.String("title", "", "new title")
	content := fs.String("content", "", "new content")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() < 1 {
		return errors.New("note edit [--title t] [--content c] <id>")
	}
	set := map[string]any{}
	fs.Visit(func(f *flag.Flag) {
		switch f.Name {
		case "title":
			set["title"] = *title
		case "content":
			set["content"] = *content
		}
	})
	if len(set) == 0 {
		return errors.New("nothing to update (pass --title and/or --content)")
	}
	return updateNote(ctx, c, fs.Arg(0), set)
}

func notePinned(ctx context.Context, c *nhost.Client, args []string, pinned bool) error {
	if err := requireArgs(args, 1, "note pin/unpin <id>"); err != nil {
		return err
	}
	return updateNote(ctx, c, args[0], map[string]any{"is_pinned": pinned})
}

func noteArchive(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 1, "note archive <id>"); err != nil {
		return err
	}
	return updateNote(ctx, c, args[0], map[string]any{"is_archived": true})
}

func noteMv(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 2, "note mv <id> <notebookId>"); err != nil {
		return err
	}
	return updateNote(ctx, c, args[0], map[string]any{"notebook_id": args[1]})
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
		return errors.New("note not found or not permitted")
	}
	fmt.Println("updated", id)
	return nil
}

func noteRm(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 1, "note rm <id>"); err != nil {
		return err
	}
	data, err := gql(ctx, c, `
		mutation DeleteNote($id: uuid!) {
			delete_notes_by_pk(id: $id) { id }
		}`, graphql.Variables{"id": args[0]})
	if err != nil {
		return err
	}
	if dig(data, "delete_notes_by_pk", "id") == nil {
		return errors.New("note not found or not permitted")
	}
	fmt.Println("deleted", args[0])
	return nil
}

func noteTag(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 2, "note tag <noteId> <tagName>"); err != nil {
		return err
	}
	tagID, err := upsertTag(ctx, c, args[1], "")
	if err != nil {
		return err
	}
	if _, err := gql(ctx, c, `
		mutation TagNote($noteId: uuid!, $tagId: uuid!) {
			insert_note_tags_one(
				object: {note_id: $noteId, tag_id: $tagId}
				on_conflict: {constraint: note_tags_pkey, update_columns: []}
			) { note_id }
		}`, graphql.Variables{"noteId": args[0], "tagId": tagID}); err != nil {
		return err
	}
	fmt.Printf("tagged %s with #%s\n", args[0], args[1])
	return nil
}

func noteUntag(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 2, "note untag <noteId> <tagName>"); err != nil {
		return err
	}
	if _, err := gql(ctx, c, `
		mutation Untag($noteId: uuid!, $name: String!) {
			delete_note_tags(where: {note_id: {_eq: $noteId}, tag: {name: {_eq: $name}}}) {
				affected_rows
			}
		}`, graphql.Variables{"noteId": args[0], "name": args[1]}); err != nil {
		return err
	}
	fmt.Printf("removed #%s from %s\n", args[1], args[0])
	return nil
}

// --- notebooks & tags -------------------------------------------------------

func cmdNotebook(ctx context.Context, c *nhost.Client, args []string) error {
	if len(args) == 0 {
		return errors.New("notebook <new|ls> ...")
	}
	switch args[0] {
	case "new":
		if err := requireArgs(args[1:], 1, "notebook new <name>"); err != nil {
			return err
		}
		data, err := gql(ctx, c, `
			mutation NewNotebook($name: String!) {
				insert_notebooks_one(object: {name: $name}) { id name }
			}`, graphql.Variables{"name": args[1]})
		if err != nil {
			return err
		}
		fmt.Println("created", str(dig(data, "insert_notebooks_one", "id")))
		return nil
	case "ls":
		data, err := gql(ctx, c, `query { notebooks(order_by: {name: asc}) { id name } }`, nil)
		if err != nil {
			return err
		}
		for _, nb := range asSlice(data["notebooks"]) {
			m, _ := nb.(map[string]any)
			fmt.Printf("%s  %s\n", str(m["id"]), str(m["name"]))
		}
		return nil
	default:
		return fmt.Errorf("unknown notebook subcommand %q", args[0])
	}
}

func cmdTag(ctx context.Context, c *nhost.Client, args []string) error {
	if len(args) == 0 {
		return errors.New("tag <new|ls> ...")
	}
	switch args[0] {
	case "new":
		fs := flag.NewFlagSet("tag new", flag.ContinueOnError)
		color := fs.String("color", "#808080", "hex color")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() < 1 {
			return errors.New("tag new [--color #rrggbb] <name>")
		}
		id, err := upsertTag(ctx, c, fs.Arg(0), *color)
		if err != nil {
			return err
		}
		fmt.Println("created", id)
		return nil
	case "ls":
		data, err := gql(ctx, c, `query { tags(order_by: {name: asc}) { id name color } }`, nil)
		if err != nil {
			return err
		}
		for _, t := range asSlice(data["tags"]) {
			m, _ := t.(map[string]any)
			fmt.Printf("%s  %-16s %s\n", str(m["id"]), str(m["name"]), str(m["color"]))
		}
		return nil
	default:
		return fmt.Errorf("unknown tag subcommand %q", args[0])
	}
}

// upsertTag creates the tag (or returns the existing one) and returns its id.
func upsertTag(ctx context.Context, c *nhost.Client, name, color string) (string, error) {
	obj := map[string]any{"name": name}
	update := []string{}
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
		return "", errors.New("could not create tag")
	}
	return id, nil
}

// --- storage & sharing ------------------------------------------------------

func cmdAttach(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 2, "attach <noteId> <file>"); err != nil {
		return err
	}
	raw, err := os.ReadFile(args[1])
	if err != nil {
		return err
	}
	name := filepath.Base(args[1])
	b := bucket
	up, err := c.Storage.UploadFiles(ctx, storage.UploadFilesBody{
		BucketID: &b,
		File:     [][]byte{raw},
		Metadata: &[]storage.UploadFileMetadata{{Name: &name}},
	}, nil)
	if err != nil {
		return err
	}
	if len(up.Body.ProcessedFiles) == 0 {
		return errors.New("upload failed")
	}
	fileID := up.Body.ProcessedFiles[0].ID
	if _, err := gql(ctx, c, `
		mutation Attach($noteId: uuid!, $fileId: uuid!) {
			insert_note_attachments_one(object: {note_id: $noteId, file_id: $fileId}) { file_id }
		}`, graphql.Variables{"noteId": args[0], "fileId": fileID}); err != nil {
		return err
	}
	fmt.Printf("attached %s (file %s) to %s\n", name, fileID, args[0])
	return nil
}

func cmdDownload(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 2, "download <fileId> <outPath>"); err != nil {
		return err
	}
	resp, err := c.Storage.GetFile(ctx, args[0], nil, nil)
	if err != nil {
		return err
	}
	if err := os.WriteFile(args[1], resp.Body, 0o600); err != nil {
		return err
	}
	fmt.Printf("wrote %d bytes to %s\n", len(resp.Body), args[1])
	return nil
}

func cmdShare(ctx context.Context, c *nhost.Client, args []string) error {
	fs := flag.NewFlagSet("share", flag.ContinueOnError)
	role := fs.String("role", "viewer", "viewer|editor")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() < 2 {
		return errors.New("share [--role viewer|editor] <noteId> <userId>")
	}
	if _, err := gql(ctx, c, `
		mutation Share($noteId: uuid!, $userId: uuid!, $role: String!) {
			insert_note_collaborators_one(
				object: {note_id: $noteId, user_id: $userId, role: $role}
				on_conflict: {constraint: note_collaborators_pkey, update_columns: [role]}
			) { note_id role }
		}`, graphql.Variables{"noteId": fs.Arg(0), "userId": fs.Arg(1), "role": *role}); err != nil {
		return err
	}
	fmt.Printf("shared %s with %s as %s\n", fs.Arg(0), fs.Arg(1), *role)
	return nil
}

func cmdUnshare(ctx context.Context, c *nhost.Client, args []string) error {
	if err := requireArgs(args, 2, "unshare <noteId> <userId>"); err != nil {
		return err
	}
	if _, err := gql(ctx, c, `
		mutation Unshare($noteId: uuid!, $userId: uuid!) {
			delete_note_collaborators_by_pk(note_id: $noteId, user_id: $userId) { note_id }
		}`, graphql.Variables{"noteId": args[0], "userId": args[1]}); err != nil {
		return err
	}
	fmt.Printf("unshared %s from %s\n", args[0], args[1])
	return nil
}

// --- functions --------------------------------------------------------------

func cmdExport(ctx context.Context, c *nhost.Client) error {
	resp, err := c.Functions.Post(ctx, "/notes/export", struct{}{}, nil)
	if err != nil {
		return err
	}
	out, _ := json.MarshalIndent(resp.Body, "", "  ")
	fmt.Println(string(out))
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
	out := "  "
	for _, nt := range nts {
		if tag, ok := nt.(map[string]any)["tag"].(map[string]any); ok {
			out += "#" + str(tag["name"]) + " "
		}
	}
	return out
}

func usage() {
	fmt.Fprint(os.Stderr, `notes-cli — Nhost Go SDK demo

Auth:
  signup <email> <password>
  login  <email> <password>
  logout
  whoami

Notes:
  note new [--content c] [--notebook id] <title>
  note ls  [--archived] [--tag name]
  note show <id>
  note edit [--title t] [--content c] <id>
  note pin|unpin|archive|rm <id>
  note mv <id> <notebookId>
  note tag|untag <id> <tagName>

Notebooks / tags:
  notebook new <name> | notebook ls
  tag new [--color #rrggbb] <name> | tag ls

Storage / sharing / functions:
  attach <noteId> <file>
  download <fileId> <outPath>
  share [--role viewer|editor] <noteId> <userId>
  unshare <noteId> <userId>
  export
`)
}
