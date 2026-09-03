//! Integration tests against a local Nhost backend (`./dev-env.sh up`). They
//! are no-ops unless NHOST_LOCAL_BACKEND is set, mirroring the other SDKs.

use nhost::{auth, storage, Nhost};
use std::time::{SystemTime, UNIX_EPOCH};

fn enabled() -> bool {
    let on = std::env::var("NHOST_LOCAL_BACKEND").is_ok();
    if !on {
        // Emit a visible, once-only notice so a skipped run is distinguishable
        // from a real pass (the tests otherwise report `ok` having done nothing).
        use std::sync::Once;
        static WARN: Once = Once::new();
        WARN.call_once(|| {
            eprintln!("integration tests skipped: NHOST_LOCAL_BACKEND unset (run ./dev-env.sh up)");
        });
    }
    on
}

fn local_client() -> Nhost {
    // The local dev backend serves a valid, publicly-trusted Let's Encrypt cert
    // for *.local.nhost.run, so the default TLS trust store verifies it.
    Nhost::new("local", "local").expect("static local project configuration is valid")
}

fn unique(prefix: &str) -> String {
    let n = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{prefix}{n}")
}

#[tokio::test]
async fn integration_signup_decodes_role() {
    if !enabled() {
        return;
    }

    let client = local_client();
    client
        .auth
        .sign_up_email_password(auth::SignUpEmailPasswordRequest {
            email: format!("{}@example.com", unique("ada-")),
            password: unique("pw-"),
            options: None,
            code_challenge: None,
        })
        .await
        .expect("signup");

    let stored = client
        .session()
        .expect("session lookup")
        .expect("session after signup");
    let role = stored
        .decoded_token
        .hasura_claims
        .as_ref()
        .and_then(|c| c.get("x-hasura-default-role").and_then(|v| v.as_str()));
    assert_eq!(role, Some("user"));
}

#[tokio::test]
async fn integration_graphql_typename() {
    if !enabled() {
        return;
    }

    let client = local_client();
    let data: serde_json::Value = client
        .graphql
        .query("query { __typename }")
        .send()
        .await
        .expect("graphql");

    assert_eq!(data["__typename"], "query_root");
}

#[tokio::test]
async fn integration_storage_upload_with_metadata() {
    if !enabled() {
        return;
    }

    // Uploading a file with a chosen name sends a `metadata[]` multipart part;
    // hasura-storage rejects it unless the part is `application/json`.
    let client = local_client();
    client
        .auth
        .sign_up_email_password(auth::SignUpEmailPasswordRequest {
            email: format!("{}@example.com", unique("cat-")),
            password: unique("pw-"),
            options: None,
            code_challenge: None,
        })
        .await
        .expect("signup");

    let name = format!("{}.txt", unique("rs-cat-"));
    let resp = client
        .storage
        .upload_files(storage::UploadFilesBody {
            bucket_id: None,
            metadata: Some(vec![storage::UploadFileMetadata {
                id: None,
                name: Some(name.clone()),
                metadata: None,
            }]),
            file: vec![storage::FilePart {
                file_name: name.clone(),
                content: b"meow meow meow".to_vec(),
                content_type: Some("text/plain".to_string()),
            }],
        })
        .await
        .expect("upload");

    let file = &resp.body.processed_files[0];
    assert_eq!(file.name, name);
    assert!(file.is_uploaded);
    assert_eq!(file.size, 14);
}

#[tokio::test]
async fn integration_storage_upload_and_replace_without_metadata() {
    if !enabled() {
        return;
    }

    let client = local_client();
    client
        .auth
        .sign_up_email_password(auth::SignUpEmailPasswordRequest {
            email: format!("{}@example.com", unique("fox-")),
            password: unique("pw-"),
            options: None,
            code_challenge: None,
        })
        .await
        .expect("signup");

    let name = format!("{}.txt", unique("rs-fox-"));
    let uploaded = client
        .storage
        .upload_files(storage::UploadFilesBody {
            bucket_id: None,
            metadata: None,
            file: vec![storage::FilePart {
                file_name: name.clone(),
                content: b"initial contents".to_vec(),
                content_type: Some("text/plain".to_string()),
            }],
        })
        .await
        .expect("upload without metadata");

    let uploaded_file = &uploaded.body.processed_files[0];
    assert_eq!(uploaded_file.name, name);
    let file_id = uploaded_file.id.clone();

    let replaced = client
        .storage
        .replace_file(
            &file_id,
            storage::ReplaceFileBody {
                metadata: None,
                file: Some(storage::FilePart {
                    file_name: name.clone(),
                    content: b"new contents".to_vec(),
                    content_type: Some("text/plain".to_string()),
                }),
            },
        )
        .await
        .expect("replace without metadata");

    assert_eq!(replaced.body.name, name);
    assert_eq!(replaced.body.size, 12);

    let downloaded = client
        .storage
        .get_file(&file_id, None)
        .await
        .expect("download replaced file");
    assert_eq!(downloaded.body.as_ref(), b"new contents");
}

#[tokio::test]
async fn integration_functions_echo() {
    if !enabled() {
        return;
    }

    let client = local_client();
    let response = client
        .functions
        .post::<_, serde_json::Value>("/echo", &serde_json::json!({"message": "hello"}))
        .await
        .expect("functions");

    assert_eq!(response.body["body"]["message"], "hello");
}
