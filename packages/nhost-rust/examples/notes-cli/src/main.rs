use std::error::Error;
use std::path::PathBuf;

use clap::{Parser, Subcommand};
use nhost::auth::{SignInEmailPasswordRequest, SignOutRequest, SignUpEmailPasswordRequest};
use nhost::session::FileStorage;
use nhost::storage::{UploadFileMetadata, UploadFilesBody};
use nhost::{create_client, NhostClient, Options};
use serde_json::{json, Value};

const BUCKET: &str = "notes";

type Result<T> = std::result::Result<T, Box<dyn Error>>;

/// notes-cli — a note-taking CLI built on the Nhost Rust SDK.
#[derive(Parser)]
#[command(name = "notes-cli", version, about)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

// clap derives each subcommand's name from its variant in kebab-case, so the UX
// is flat for notes (`new`, `ls`, ...), while the notebook and tag *entities*
// are grouped under their own subcommands (`notebook ls`, `tag new`, ...).
#[derive(Subcommand)]
enum Command {
    /// Sign in with email and password
    Login { email: String, password: String },
    /// Create an account (and sign in if email verification is off)
    Signup { email: String, password: String },
    /// Sign out and clear the saved session
    Logout,
    /// Show the currently signed-in user
    Whoami,

    /// Create a note
    New {
        title: String,
        #[arg(long)]
        content: Option<String>,
        #[arg(long)]
        notebook: Option<String>,
    },
    /// List your notes
    Ls {
        #[arg(long)]
        archived: bool,
        #[arg(long)]
        tag: Option<String>,
    },
    /// Show a single note in full
    Show { id: String },
    /// Edit a note's title and/or content
    Edit {
        id: String,
        #[arg(long)]
        title: Option<String>,
        #[arg(long)]
        content: Option<String>,
    },
    /// Pin a note
    Pin { id: String },
    /// Unpin a note
    Unpin { id: String },
    /// Archive a note
    Archive { id: String },
    /// Delete a note
    Rm { id: String },
    /// Move a note into a notebook
    Mv { id: String, notebook_id: String },

    /// Manage notebooks
    Notebook {
        #[command(subcommand)]
        cmd: NotebookCmd,
    },
    /// Manage tags (and tag/untag notes)
    Tag {
        #[command(subcommand)]
        cmd: TagCmd,
    },

    /// Upload a file and attach it to a note
    Attach { note_id: String, file: String },
    /// Download a file by id
    Download { file_id: String, out_path: String },
    /// Share a note with another user
    Share {
        note_id: String,
        user_id: String,
        /// viewer (default) or editor
        #[arg(long)]
        role: Option<String>,
    },
    /// Remove a collaborator from a note
    Unshare { note_id: String, user_id: String },
    /// Export your notes via a serverless function
    Export,
}

#[derive(Subcommand)]
enum NotebookCmd {
    /// Create a notebook
    New { name: String },
    /// List your notebooks
    Ls,
}

#[derive(Subcommand)]
enum TagCmd {
    /// List your tags
    Ls,
    /// Create a tag
    New {
        name: String,
        #[arg(long)]
        color: Option<String>,
    },
    /// Add a tag to a note (creates the tag if needed)
    Add { note_id: String, tag_name: String },
    /// Remove a tag from a note
    Rm { note_id: String, tag_name: String },
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    if let Err(e) = run(cli.command).await {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}

async fn run(command: Command) -> Result<()> {
    let client = make_client();
    match command {
        Command::Login { email, password } => login(&client, &email, &password).await,
        Command::Signup { email, password } => signup(&client, &email, &password).await,
        Command::Logout => logout(&client).await,
        Command::Whoami => whoami(&client),

        Command::New {
            title,
            content,
            notebook,
        } => note_new(&client, &title, content.as_deref(), notebook.as_deref()).await,
        Command::Ls { archived, tag } => note_ls(&client, archived, tag.as_deref()).await,
        Command::Show { id } => note_show(&client, &id).await,
        Command::Edit {
            id,
            title,
            content,
        } => note_edit(&client, &id, title.as_deref(), content.as_deref()).await,
        Command::Pin { id } => note_set(&client, &id, json!({ "is_pinned": true })).await,
        Command::Unpin { id } => note_set(&client, &id, json!({ "is_pinned": false })).await,
        Command::Archive { id } => note_set(&client, &id, json!({ "is_archived": true })).await,
        Command::Rm { id } => note_rm(&client, &id).await,
        Command::Mv { id, notebook_id } => {
            note_set(&client, &id, json!({ "notebook_id": notebook_id })).await
        }
        Command::Notebook { cmd } => match cmd {
            NotebookCmd::New { name } => notebook_new(&client, &name).await,
            NotebookCmd::Ls => notebook_ls(&client).await,
        },
        Command::Tag { cmd } => match cmd {
            TagCmd::Ls => tag_ls(&client).await,
            TagCmd::New { name, color } => tag_new(&client, &name, color.as_deref()).await,
            TagCmd::Add { note_id, tag_name } => note_tag(&client, &note_id, &tag_name).await,
            TagCmd::Rm { note_id, tag_name } => note_untag(&client, &note_id, &tag_name).await,
        },

        Command::Attach { note_id, file } => attach(&client, &note_id, &file).await,
        Command::Download { file_id, out_path } => download(&client, &file_id, &out_path).await,
        Command::Share {
            note_id,
            user_id,
            role,
        } => share(&client, &note_id, &user_id, role.as_deref().unwrap_or("viewer")).await,
        Command::Unshare { note_id, user_id } => unshare(&client, &note_id, &user_id).await,
        Command::Export => export(&client).await,
    }
}

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

async fn login(client: &NhostClient, email: &str, password: &str) -> Result<()> {
    client
        .auth
        .sign_in_email_password(
            SignInEmailPasswordRequest {
                email: email.to_string(),
                password: password.to_string(),
            },
            None,
        )
        .await?;
    println!("logged in as {email}");
    Ok(())
}

async fn signup(client: &NhostClient, email: &str, password: &str) -> Result<()> {
    client
        .auth
        .sign_up_email_password(
            SignUpEmailPasswordRequest {
                email: email.to_string(),
                password: password.to_string(),
                options: None,
                code_challenge: None,
            },
            None,
        )
        .await?;
    if client.get_user_session().is_some() {
        println!("signed up and logged in as {email}");
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

async fn note_new(
    client: &NhostClient,
    title: &str,
    content: Option<&str>,
    notebook: Option<&str>,
) -> Result<()> {
    let mut obj = json!({ "title": title, "content": content.unwrap_or_default() });
    if let Some(nb) = notebook {
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

async fn note_ls(client: &NhostClient, archived: bool, tag: Option<&str>) -> Result<()> {
    let mut where_ = json!({ "is_archived": { "_eq": archived } });
    if let Some(t) = tag {
        where_["noteTags"] = json!({ "tag": { "name": { "_eq": t } } });
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

async fn note_show(client: &NhostClient, id: &str) -> Result<()> {
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
        json!({ "id": id }),
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

async fn note_edit(
    client: &NhostClient,
    id: &str,
    title: Option<&str>,
    content: Option<&str>,
) -> Result<()> {
    let mut set = serde_json::Map::new();
    if let Some(t) = title {
        set.insert("title".into(), json!(t));
    }
    if let Some(c) = content {
        set.insert("content".into(), json!(c));
    }
    if set.is_empty() {
        return Err("nothing to update (pass --title and/or --content)".into());
    }
    note_set(client, id, Value::Object(set)).await
}

async fn note_set(client: &NhostClient, id: &str, set: Value) -> Result<()> {
    let data = gql(
        client,
        "mutation UpdateNote($id: uuid!, $set: notes_set_input!) {
            update_notes_by_pk(pk_columns: {id: $id}, _set: $set) { id }
        }",
        json!({ "id": id, "set": set }),
    )
    .await?;
    if data["update_notes_by_pk"].is_null() {
        return Err("note not found or not permitted".into());
    }
    println!("updated {}", id);
    Ok(())
}

async fn note_rm(client: &NhostClient, id: &str) -> Result<()> {
    let data = gql(
        client,
        "mutation Del($id: uuid!) { delete_notes_by_pk(id: $id) { id } }",
        json!({ "id": id }),
    )
    .await?;
    if data["delete_notes_by_pk"].is_null() {
        return Err("note not found or not permitted".into());
    }
    println!("deleted {}", id);
    Ok(())
}

async fn note_tag(client: &NhostClient, note_id: &str, tag_name: &str) -> Result<()> {
    let tag_id = upsert_tag(client, tag_name, None).await?;
    gql(
        client,
        "mutation TagNote($noteId: uuid!, $tagId: uuid!) {
            insert_note_tags_one(
                object: {note_id: $noteId, tag_id: $tagId}
                on_conflict: {constraint: note_tags_pkey, update_columns: []}
            ) { note_id }
        }",
        json!({ "noteId": note_id, "tagId": tag_id }),
    )
    .await?;
    println!("tagged {} with #{}", note_id, tag_name);
    Ok(())
}

async fn note_untag(client: &NhostClient, note_id: &str, tag_name: &str) -> Result<()> {
    gql(
        client,
        "mutation Untag($noteId: uuid!, $name: String!) {
            delete_note_tags(where: {note_id: {_eq: $noteId}, tag: {name: {_eq: $name}}}) {
                affected_rows
            }
        }",
        json!({ "noteId": note_id, "name": tag_name }),
    )
    .await?;
    println!("removed #{} from {}", tag_name, note_id);
    Ok(())
}

// --- notebooks & tags -------------------------------------------------------

async fn notebook_new(client: &NhostClient, name: &str) -> Result<()> {
    let data = gql(
        client,
        "mutation NewNotebook($name: String!) { insert_notebooks_one(object: {name: $name}) { id } }",
        json!({ "name": name }),
    )
    .await?;
    println!("created {}", s(&data["insert_notebooks_one"], "id"));
    Ok(())
}

async fn notebook_ls(client: &NhostClient) -> Result<()> {
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

async fn tag_new(client: &NhostClient, name: &str, color: Option<&str>) -> Result<()> {
    let color = color.unwrap_or("#808080");
    println!("created {}", upsert_tag(client, name, Some(color)).await?);
    Ok(())
}

async fn tag_ls(client: &NhostClient) -> Result<()> {
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

/// Creates the tag (or returns the existing one) and returns its id.
async fn upsert_tag(client: &NhostClient, name: &str, color: Option<&str>) -> Result<String> {
    let mut obj = json!({ "name": name });
    // Always update `name` on conflict so the upsert returns the existing row's
    // id (an empty update_columns makes Hasura DO NOTHING and return null).
    let mut update: Vec<&str> = vec!["name"];
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

async fn attach(client: &NhostClient, note_id: &str, file: &str) -> Result<()> {
    let bytes = std::fs::read(file)?;
    let name = PathBuf::from(file)
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
        json!({ "noteId": note_id, "fileId": file_id }),
    )
    .await?;
    println!("attached {} (file {}) to {}", name, file_id, note_id);
    Ok(())
}

async fn download(client: &NhostClient, file_id: &str, out_path: &str) -> Result<()> {
    let resp = client.storage.get_file(file_id, None, None).await?;
    std::fs::write(out_path, &resp.body)?;
    println!("wrote {} bytes to {}", resp.body.len(), out_path);
    Ok(())
}

async fn share(client: &NhostClient, note_id: &str, user_id: &str, role: &str) -> Result<()> {
    gql(
        client,
        "mutation Share($noteId: uuid!, $userId: uuid!, $role: String!) {
            insert_note_collaborators_one(
                object: {note_id: $noteId, user_id: $userId, role: $role}
                on_conflict: {constraint: note_collaborators_pkey, update_columns: [role]}
            ) { note_id role }
        }",
        json!({ "noteId": note_id, "userId": user_id, "role": role }),
    )
    .await?;
    println!("shared {} with {} as {}", note_id, user_id, role);
    Ok(())
}

async fn unshare(client: &NhostClient, note_id: &str, user_id: &str) -> Result<()> {
    gql(
        client,
        "mutation Unshare($noteId: uuid!, $userId: uuid!) {
            delete_note_collaborators_by_pk(note_id: $noteId, user_id: $userId) { note_id }
        }",
        json!({ "noteId": note_id, "userId": user_id }),
    )
    .await?;
    println!("unshared {} from {}", note_id, user_id);
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
