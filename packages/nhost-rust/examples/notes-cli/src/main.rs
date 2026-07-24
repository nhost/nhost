//! notes-cli — a note-taking CLI built on the Nhost Rust SDK.
//!
//! Demonstrates the SDK end to end against the "notes" quickstart backend:
//!
//! * Auth      — login/logout/whoami, session persisted to a JSON file
//!   (session middleware attaches + refreshes the token automatically)
//! * GraphQL   — notes, notebooks and tags CRUD (permissions enforced by Hasura)
//! * Storage   — attach/download files in the "notes" bucket
//! * Functions — `export` calls the notes/export serverless function
//!
//! Configuration (env, all optional):
//!   NHOST_SUBDOMAIN      default "local"
//!   NHOST_REGION         default "local"
//!   NHOST_NOTES_SESSION  session file path (default under ~/.config)

use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::path::PathBuf;

use nhost::auth::{SignInEmailPasswordRequest, SignOutRequest, SignUpEmailPasswordRequest};
use nhost::session::FileStorage;
use nhost::storage::{UploadFileMetadata, UploadFilesBody};
use nhost::{create_client, NhostClient, Options};
use serde_json::{json, Value};

const BUCKET: &str = "notes";

type Result<T> = std::result::Result<T, Box<dyn Error>>;

#[tokio::main]
async fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    if argv.is_empty() {
        usage();
        std::process::exit(2);
    }
    if let Err(e) = run(&argv[0], &argv[1..]).await {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}

async fn run(cmd: &str, args: &[String]) -> Result<()> {
    let client = make_client();
    match cmd {
        "login" => login(&client, args).await,
        "signup" => signup(&client, args).await,
        "logout" => logout(&client).await,
        "whoami" => whoami(&client),
        "note" => note(&client, args).await,
        "notebook" => notebook(&client, args).await,
        "tag" => tag(&client, args).await,
        "attach" => attach(&client, args).await,
        "download" => download(&client, args).await,
        "share" => share(&client, args).await,
        "unshare" => unshare(&client, args).await,
        "export" => export(&client).await,
        "help" | "-h" | "--help" => {
            usage();
            Ok(())
        }
        other => {
            usage();
            Err(format!("unknown command {other:?}").into())
        }
    }
}

// --- client & helpers -------------------------------------------------------

fn make_client() -> NhostClient {
    let path = session_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    create_client(Options {
        subdomain: Some(env("NHOST_SUBDOMAIN", "local")),
        region: Some(env("NHOST_REGION", "local")),
        storage: Some(Box::new(FileStorage::new(path))),
        ..Default::default()
    })
}

fn session_path() -> PathBuf {
    if let Ok(p) = std::env::var("NHOST_NOTES_SESSION") {
        return PathBuf::from(p);
    }
    let base = std::env::var("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".config")
        });
    base.join("nhost-notes").join("session.json")
}

fn env(key: &str, fallback: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| fallback.to_string())
}

/// Runs a GraphQL operation and returns the `data` value.
async fn gql(client: &NhostClient, query: &str, vars: Value) -> Result<Value> {
    let resp = client
        .graphql
        .request(query, Some(vars), None, None)
        .await?;
    Ok(resp.body.data.unwrap_or(Value::Null))
}

/// Minimal flag parser: `--flag value` for value flags, `--flag` for bools.
struct Parsed {
    pos: Vec<String>,
    flags: HashMap<String, String>,
    bools: HashSet<String>,
}

fn parse(args: &[String], bool_flags: &[&str]) -> Parsed {
    let bset: HashSet<&str> = bool_flags.iter().copied().collect();
    let mut out = Parsed {
        pos: vec![],
        flags: HashMap::new(),
        bools: HashSet::new(),
    };
    let mut i = 0;
    while i < args.len() {
        let a = &args[i];
        if let Some(name) = a.strip_prefix("--") {
            if bset.contains(name) {
                out.bools.insert(name.to_string());
            } else if i + 1 < args.len() {
                out.flags.insert(name.to_string(), args[i + 1].clone());
                i += 1;
            }
        } else {
            out.pos.push(a.clone());
        }
        i += 1;
    }
    out
}

fn need(pos: &[String], n: usize, hint: &str) -> Result<()> {
    if pos.len() < n {
        return Err(format!("expected {hint}").into());
    }
    Ok(())
}

fn s(v: &Value, key: &str) -> String {
    v.get(key).and_then(Value::as_str).unwrap_or("").to_string()
}

fn tag_list(note: &Value) -> String {
    let names: Vec<String> = note
        .get("noteTags")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|nt| nt.get("tag").map(|t| format!("#{}", s(t, "name"))))
                .collect()
        })
        .unwrap_or_default();
    if names.is_empty() {
        String::new()
    } else {
        format!("  {}", names.join(" "))
    }
}

// --- auth -------------------------------------------------------------------

async fn login(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 2, "login <email> <password>")?;
    client
        .auth
        .sign_in_email_password(
            SignInEmailPasswordRequest {
                email: args[0].clone(),
                password: args[1].clone(),
            },
            None,
        )
        .await?;
    println!("logged in as {}", args[0]);
    Ok(())
}

async fn signup(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 2, "signup <email> <password>")?;
    client
        .auth
        .sign_up_email_password(
            SignUpEmailPasswordRequest {
                email: args[0].clone(),
                password: args[1].clone(),
                options: None,
                code_challenge: None,
            },
            None,
        )
        .await?;
    if client.get_user_session().is_some() {
        println!("signed up and logged in as {}", args[0]);
    } else {
        println!("signed up; verify your email, then `login`");
    }
    Ok(())
}

async fn logout(client: &NhostClient) -> Result<()> {
    if let Some(sess) = client.get_user_session() {
        let _ = client
            .auth
            .sign_out(
                SignOutRequest {
                    refresh_token: Some(sess.session.refresh_token),
                    all: None,
                },
                None,
            )
            .await;
    }
    client.clear_session();
    println!("logged out");
    Ok(())
}

fn whoami(client: &NhostClient) -> Result<()> {
    match client.get_user_session().and_then(|s| s.session.user) {
        Some(u) => {
            println!("{} ({})", u.email.unwrap_or_default(), u.id);
            Ok(())
        }
        None => Err("not logged in".into()),
    }
}

// --- notes ------------------------------------------------------------------

async fn note(client: &NhostClient, args: &[String]) -> Result<()> {
    let (sub, rest) = args
        .split_first()
        .ok_or("note <new|ls|show|edit|pin|unpin|archive|rm|mv|tag|untag> ...")?;
    match sub.as_str() {
        "new" => note_new(client, rest).await,
        "ls" => note_ls(client, rest).await,
        "show" => note_show(client, rest).await,
        "edit" => note_edit(client, rest).await,
        "pin" => note_pinned(client, rest, true).await,
        "unpin" => note_pinned(client, rest, false).await,
        "archive" => note_set(client, rest, json!({"is_archived": true})).await,
        "rm" => note_rm(client, rest).await,
        "mv" => note_mv(client, rest).await,
        "tag" => note_tag(client, rest).await,
        "untag" => note_untag(client, rest).await,
        other => Err(format!("unknown note subcommand {other:?}").into()),
    }
}

async fn note_new(client: &NhostClient, args: &[String]) -> Result<()> {
    let p = parse(args, &[]);
    need(&p.pos, 1, "note new [--content c] [--notebook id] <title>")?;
    let mut obj =
        json!({"title": p.pos[0], "content": p.flags.get("content").cloned().unwrap_or_default()});
    if let Some(nb) = p.flags.get("notebook") {
        obj["notebook_id"] = json!(nb);
    }
    let data = gql(
        client,
        "mutation NewNote($obj: notes_insert_input!) { insert_notes_one(object: $obj) { id } }",
        json!({ "obj": obj }),
    )
    .await?;
    println!("created {}", s(&data["insert_notes_one"], "id"));
    Ok(())
}

async fn note_ls(client: &NhostClient, args: &[String]) -> Result<()> {
    let p = parse(args, &["archived"]);
    let mut where_ = json!({"is_archived": {"_eq": p.bools.contains("archived")}});
    if let Some(t) = p.flags.get("tag") {
        where_["noteTags"] = json!({"tag": {"name": {"_eq": t}}});
    }
    let data = gql(
        client,
        "query Notes($where: notes_bool_exp!) {
            notes(where: $where, order_by: [{is_pinned: desc}, {updated_at: desc}]) {
                id title is_pinned notebook { name } noteTags { tag { name } }
            }
        }",
        json!({ "where": where_ }),
    )
    .await?;
    let notes = data["notes"].as_array().cloned().unwrap_or_default();
    if notes.is_empty() {
        println!("(no notes)");
        return Ok(());
    }
    for n in &notes {
        let pin = if n["is_pinned"].as_bool().unwrap_or(false) {
            "*"
        } else {
            " "
        };
        let nb = n
            .get("notebook")
            .filter(|v| !v.is_null())
            .map(|b| format!("  [{}]", s(b, "name")))
            .unwrap_or_default();
        println!(
            "{pin} {}  {}{}{}",
            s(n, "id"),
            s(n, "title"),
            nb,
            tag_list(n)
        );
    }
    Ok(())
}

async fn note_show(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 1, "note show <id>")?;
    let data = gql(
        client,
        "query Note($id: uuid!) {
            notes_by_pk(id: $id) {
                id title content is_pinned is_archived
                notebook { name }
                noteTags { tag { name color } }
                attachments { file { id name mimeType size } }
                collaborators { user_id role }
            }
        }",
        json!({ "id": args[0] }),
    )
    .await?;
    let n = &data["notes_by_pk"];
    if n.is_null() {
        return Err("note not found".into());
    }
    println!("# {}\n\n{}", s(n, "title"), s(n, "content"));
    println!(
        "\npinned={} archived={}{}",
        n["is_pinned"],
        n["is_archived"],
        tag_list(n)
    );
    if let Some(atts) = n["attachments"].as_array().filter(|a| !a.is_empty()) {
        println!("attachments:");
        for a in atts {
            let f = &a["file"];
            println!("  {}  {} ({})", s(f, "id"), s(f, "name"), s(f, "mimeType"));
        }
    }
    if let Some(cols) = n["collaborators"].as_array().filter(|c| !c.is_empty()) {
        println!("shared with:");
        for c in cols {
            println!("  {} ({})", s(c, "user_id"), s(c, "role"));
        }
    }
    Ok(())
}

async fn note_edit(client: &NhostClient, args: &[String]) -> Result<()> {
    let p = parse(args, &[]);
    need(&p.pos, 1, "note edit [--title t] [--content c] <id>")?;
    let mut set = serde_json::Map::new();
    if let Some(t) = p.flags.get("title") {
        set.insert("title".into(), json!(t));
    }
    if let Some(c) = p.flags.get("content") {
        set.insert("content".into(), json!(c));
    }
    if set.is_empty() {
        return Err("nothing to update (pass --title and/or --content)".into());
    }
    note_set(client, &p.pos, Value::Object(set)).await
}

async fn note_pinned(client: &NhostClient, args: &[String], pinned: bool) -> Result<()> {
    need(args, 1, "note pin/unpin <id>")?;
    note_set(client, args, json!({"is_pinned": pinned})).await
}

async fn note_mv(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 2, "note mv <id> <notebookId>")?;
    note_set(client, &args[..1], json!({"notebook_id": args[1]})).await
}

async fn note_set(client: &NhostClient, args: &[String], set: Value) -> Result<()> {
    need(args, 1, "note <id>")?;
    let data = gql(
        client,
        "mutation UpdateNote($id: uuid!, $set: notes_set_input!) {
            update_notes_by_pk(pk_columns: {id: $id}, _set: $set) { id }
        }",
        json!({ "id": args[0], "set": set }),
    )
    .await?;
    if data["update_notes_by_pk"].is_null() {
        return Err("note not found or not permitted".into());
    }
    println!("updated {}", args[0]);
    Ok(())
}

async fn note_rm(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 1, "note rm <id>")?;
    let data = gql(
        client,
        "mutation Del($id: uuid!) { delete_notes_by_pk(id: $id) { id } }",
        json!({ "id": args[0] }),
    )
    .await?;
    if data["delete_notes_by_pk"].is_null() {
        return Err("note not found or not permitted".into());
    }
    println!("deleted {}", args[0]);
    Ok(())
}

async fn note_tag(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 2, "note tag <noteId> <tagName>")?;
    let tag_id = upsert_tag(client, &args[1], None).await?;
    gql(
        client,
        "mutation TagNote($noteId: uuid!, $tagId: uuid!) {
            insert_note_tags_one(
                object: {note_id: $noteId, tag_id: $tagId}
                on_conflict: {constraint: note_tags_pkey, update_columns: []}
            ) { note_id }
        }",
        json!({ "noteId": args[0], "tagId": tag_id }),
    )
    .await?;
    println!("tagged {} with #{}", args[0], args[1]);
    Ok(())
}

async fn note_untag(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 2, "note untag <noteId> <tagName>")?;
    gql(
        client,
        "mutation Untag($noteId: uuid!, $name: String!) {
            delete_note_tags(where: {note_id: {_eq: $noteId}, tag: {name: {_eq: $name}}}) {
                affected_rows
            }
        }",
        json!({ "noteId": args[0], "name": args[1] }),
    )
    .await?;
    println!("removed #{} from {}", args[1], args[0]);
    Ok(())
}

// --- notebooks & tags -------------------------------------------------------

async fn notebook(client: &NhostClient, args: &[String]) -> Result<()> {
    let (sub, rest) = args.split_first().ok_or("notebook <new|ls> ...")?;
    match sub.as_str() {
        "new" => {
            need(rest, 1, "notebook new <name>")?;
            let data = gql(
                client,
                "mutation NewNotebook($name: String!) { insert_notebooks_one(object: {name: $name}) { id } }",
                json!({ "name": rest[0] }),
            )
            .await?;
            println!("created {}", s(&data["insert_notebooks_one"], "id"));
            Ok(())
        }
        "ls" => {
            let data = gql(
                client,
                "query { notebooks(order_by: {name: asc}) { id name } }",
                Value::Null,
            )
            .await?;
            for nb in data["notebooks"].as_array().cloned().unwrap_or_default() {
                println!("{}  {}", s(&nb, "id"), s(&nb, "name"));
            }
            Ok(())
        }
        other => Err(format!("unknown notebook subcommand {other:?}").into()),
    }
}

async fn tag(client: &NhostClient, args: &[String]) -> Result<()> {
    let (sub, rest) = args.split_first().ok_or("tag <new|ls> ...")?;
    match sub.as_str() {
        "new" => {
            let p = parse(rest, &[]);
            need(&p.pos, 1, "tag new [--color #rrggbb] <name>")?;
            let color = p
                .flags
                .get("color")
                .map(String::as_str)
                .unwrap_or("#808080");
            println!(
                "created {}",
                upsert_tag(client, &p.pos[0], Some(color)).await?
            );
            Ok(())
        }
        "ls" => {
            let data = gql(
                client,
                "query { tags(order_by: {name: asc}) { id name color } }",
                Value::Null,
            )
            .await?;
            for t in data["tags"].as_array().cloned().unwrap_or_default() {
                println!("{}  {:<16} {}", s(&t, "id"), s(&t, "name"), s(&t, "color"));
            }
            Ok(())
        }
        other => Err(format!("unknown tag subcommand {other:?}").into()),
    }
}

/// Creates the tag (or returns the existing one) and returns its id.
async fn upsert_tag(client: &NhostClient, name: &str, color: Option<&str>) -> Result<String> {
    let mut obj = json!({ "name": name });
    let mut update: Vec<&str> = vec![];
    if let Some(c) = color {
        obj["color"] = json!(c);
        update.push("color");
    }
    let data = gql(
        client,
        "mutation UpsertTag($obj: tags_insert_input!, $update: [tags_update_column!]!) {
            insert_tags_one(
                object: $obj
                on_conflict: {constraint: tags_user_id_name_key, update_columns: $update}
            ) { id }
        }",
        json!({ "obj": obj, "update": update }),
    )
    .await?;
    let id = s(&data["insert_tags_one"], "id");
    if id.is_empty() {
        return Err("could not create tag".into());
    }
    Ok(id)
}

// --- storage / sharing / functions -----------------------------------------

async fn attach(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 2, "attach <noteId> <file>")?;
    let bytes = std::fs::read(&args[1])?;
    let name = PathBuf::from(&args[1])
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());
    let up = client
        .storage
        .upload_files(
            UploadFilesBody {
                bucket_id: Some(BUCKET.to_string()),
                metadata: Some(vec![UploadFileMetadata {
                    id: None,
                    name: Some(name.clone()),
                    metadata: None,
                }]),
                file: vec![bytes],
            },
            None,
        )
        .await?;
    let file_id = up
        .body
        .processed_files
        .first()
        .ok_or("upload failed")?
        .id
        .clone();
    gql(
        client,
        "mutation Attach($noteId: uuid!, $fileId: uuid!) {
            insert_note_attachments_one(object: {note_id: $noteId, file_id: $fileId}) { file_id }
        }",
        json!({ "noteId": args[0], "fileId": file_id }),
    )
    .await?;
    println!("attached {} (file {}) to {}", name, file_id, args[0]);
    Ok(())
}

async fn download(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 2, "download <fileId> <outPath>")?;
    let resp = client.storage.get_file(&args[0], None, None).await?;
    std::fs::write(&args[1], &resp.body)?;
    println!("wrote {} bytes to {}", resp.body.len(), args[1]);
    Ok(())
}

async fn share(client: &NhostClient, args: &[String]) -> Result<()> {
    let p = parse(args, &[]);
    need(&p.pos, 2, "share [--role viewer|editor] <noteId> <userId>")?;
    let role = p.flags.get("role").map(String::as_str).unwrap_or("viewer");
    gql(
        client,
        "mutation Share($noteId: uuid!, $userId: uuid!, $role: String!) {
            insert_note_collaborators_one(
                object: {note_id: $noteId, user_id: $userId, role: $role}
                on_conflict: {constraint: note_collaborators_pkey, update_columns: [role]}
            ) { note_id role }
        }",
        json!({ "noteId": p.pos[0], "userId": p.pos[1], "role": role }),
    )
    .await?;
    println!("shared {} with {} as {}", p.pos[0], p.pos[1], role);
    Ok(())
}

async fn unshare(client: &NhostClient, args: &[String]) -> Result<()> {
    need(args, 2, "unshare <noteId> <userId>")?;
    gql(
        client,
        "mutation Unshare($noteId: uuid!, $userId: uuid!) {
            delete_note_collaborators_by_pk(note_id: $noteId, user_id: $userId) { note_id }
        }",
        json!({ "noteId": args[0], "userId": args[1] }),
    )
    .await?;
    println!("unshared {} from {}", args[0], args[1]);
    Ok(())
}

async fn export(client: &NhostClient) -> Result<()> {
    let resp = client
        .functions
        .post("/notes/export", &json!({}), None)
        .await?;
    println!("{}", serde_json::to_string_pretty(&resp.body)?);
    Ok(())
}

fn usage() {
    eprint!(
        r#"notes-cli — Nhost Rust SDK demo

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
"#
    );
}
