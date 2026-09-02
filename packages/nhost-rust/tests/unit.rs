use base64::Engine;
use nhost::http::Middleware;
use nhost::middleware::{AttachToken, SessionRefresh};
use nhost::session::SessionStorage;
use nhost::{auth, functions, graphql, session, storage, Error, Nhost};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

/// A syntactically valid JWT expiring `in_secs` from now (negative = expired).
fn token(in_secs: i64) -> String {
    let exp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
        + in_secs;
    let payload = json!({ "exp": exp, "sub": "user-1" });
    let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(serde_json::to_vec(&payload).unwrap());
    format!("aaa.{body}.sig")
}

fn session_with(access_token: &str) -> auth::Session {
    auth::Session {
        access_token: access_token.to_string(),
        access_token_expires_in: 900,
        refresh_token_id: "rid".to_string(),
        refresh_token: "rt".to_string(),
        user: None,
    }
}

#[test]
fn pkce_rfc7636_vector() {
    assert_eq!(
        auth::generate_code_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
        "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );

    let pair = auth::generate_pkce_pair();
    assert_eq!(pair.verifier.len(), 43);
    assert_eq!(
        auth::generate_code_challenge(&pair.verifier),
        pair.challenge
    );
}

#[test]
fn service_urls() {
    let cloud = Nhost::builder()
        .subdomain("demo")
        .region("eu-central-1")
        .build()
        .unwrap();
    assert_eq!(
        cloud.auth.base_url,
        "https://demo.auth.eu-central-1.nhost.run/v1"
    );
    assert_eq!(
        cloud.graphql.url,
        "https://demo.graphql.eu-central-1.nhost.run/v1"
    );

    let local = Nhost::builder().build().unwrap();
    assert_eq!(
        local.graphql.url,
        "https://local.graphql.local.nhost.run/v1"
    );

    let custom = Nhost::builder()
        .storage_url("http://localhost:1337/v1/storage")
        .build()
        .unwrap();
    assert_eq!(custom.storage.base_url, "http://localhost:1337/v1/storage");
}

#[test]
fn jwt_decode_postgres_array_claims() {
    let payload = serde_json::json!({
        "exp": 9_999_999_999_i64,
        "sub": "user-1",
        "https://hasura.io/jwt/claims": {
            "x-hasura-default-role": "user",
            "x-hasura-allowed-roles": "{user,me}",
        },
    });
    let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(serde_json::to_vec(&payload).unwrap());
    let token = format!("aaa.{body}.sig");

    let decoded = session::decode_user_session(&token).unwrap();
    assert_eq!(decoded.sub.as_deref(), Some("user-1"));
    assert_eq!(decoded.exp, Some(9_999_999_999_000));

    let claims = decoded.hasura_claims.unwrap();
    assert_eq!(
        claims["x-hasura-allowed-roles"],
        serde_json::json!(["user", "me"])
    );
    assert_eq!(claims["x-hasura-default-role"], "user");
}

#[test]
fn decoded_token_serializes_interop_shape() {
    let payload = serde_json::json!({
        "exp": 9_999_999_999_i64,
        "iat": 1_700_000_000_i64,
        "sub": "user-1",
        "https://hasura.io/jwt/claims": { "x-hasura-default-role": "user" },
    });
    let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(serde_json::to_vec(&payload).unwrap());
    let token = format!("aaa.{body}.sig");

    let decoded = session::decode_user_session(&token).unwrap();
    let json = serde_json::to_value(&decoded).unwrap();
    assert_eq!(json["exp"], serde_json::json!(9_999_999_999_000_i64));
    assert_eq!(json["iat"], serde_json::json!(1_700_000_000_000_i64));
    assert_eq!(
        json["https://hasura.io/jwt/claims"]["x-hasura-default-role"],
        "user"
    );
    assert!(json.get("hasura_claims").is_none());
}

#[test]
fn jwt_decode_invalid() {
    assert!(matches!(
        session::decode_user_session("not-a-jwt"),
        Err(Error::InvalidToken(_))
    ));
}

#[test]
fn notify_callback_can_reenter_storage_without_deadlock() {
    let payload = serde_json::json!({ "exp": 9_999_999_999_i64, "sub": "u" });
    let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(serde_json::to_vec(&payload).unwrap());
    let token = format!("aaa.{body}.sig");

    let storage = session::SessionStorage::new(Box::<session::MemoryStorage>::default());
    let reentrant = storage.clone();
    let _sub = storage.on_change(move |s| {
        if s.is_some() {
            let _ = reentrant.remove();
        }
    });

    storage
        .set(auth::Session {
            access_token: token,
            access_token_expires_in: 900,
            refresh_token_id: "rid".to_string(),
            refresh_token: "rt".to_string(),
            user: None,
        })
        .unwrap();

    assert!(storage.get().unwrap().is_none());
}

#[test]
fn server_mode_requires_storage() {
    assert!(Nhost::builder().server().build().is_err());
    assert!(Nhost::builder()
        .server()
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .is_ok());
}

fn mock_client(server: &MockServer) -> Nhost {
    Nhost::builder()
        .graphql_url(server.uri())
        .functions_url(server.uri())
        .without_session_management()
        .build()
        .unwrap()
}

#[tokio::test]
async fn graphql_send_decodes_data() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(
            ResponseTemplate::new(200).set_body_string(r#"{"data":{"__typename":"query_root"}}"#),
        )
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let data: serde_json::Value = client
        .graphql
        .query("query { __typename }")
        .send()
        .await
        .unwrap();

    assert_eq!(data["__typename"], "query_root");
}

#[tokio::test]
async fn graphql_errors_map_to_error() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_string(r#"{"errors":[{"message":"field not found"}]}"#),
        )
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let err = client
        .graphql
        .query("query { nope }")
        .send::<serde_json::Value>()
        .await
        .unwrap_err();

    assert!(matches!(err, Error::GraphQl(_)));
    assert!(err.to_string().contains("field not found"));
}

#[tokio::test]
async fn functions_post_decodes_json() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/echo"))
        .respond_with(
            ResponseTemplate::new(200)
                .insert_header("content-type", "application/json")
                .set_body_string(r#"{"body":{"message":"hello"},"method":"POST"}"#),
        )
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let resp: serde_json::Value = client
        .functions
        .post("/echo", &json!({"message": "hello"}))
        .await
        .unwrap();

    assert_eq!(resp["body"]["message"], "hello");
}

#[tokio::test]
async fn api_error_extracts_message_and_status() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(400).set_body_string(r#"{"message":"bad input"}"#))
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let err = client
        .functions
        .post::<_, serde_json::Value>("/x", &json!({}))
        .await
        .unwrap_err();

    assert!(matches!(err, Error::Api(_)));
    assert!(err.to_string().contains("bad input"));
    assert_eq!(err.status(), Some(400));
}

#[tokio::test]
async fn with_role_sets_header() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("x-hasura-role", "editor"))
        .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"data":{"ok":true}}"#))
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let data: serde_json::Value = client
        .graphql
        .with_role("editor")
        .query("query { ok }")
        .send()
        .await
        .unwrap();
    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn graphql_with_headers_preserves_content_type() {
    // A scoped header must not wipe the `Content-Type: application/json` set by
    // `.json()`; the mock only matches when BOTH headers are present.
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("content-type", "application/json"))
        .and(header("x-hasura-role", "editor"))
        .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"data":{"ok":true}}"#))
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let headers = HashMap::from([("x-hasura-role".to_string(), "editor".to_string())]);
    let data: serde_json::Value = client
        .graphql
        .with_headers(headers)
        .query("query { ok }")
        .send()
        .await
        .unwrap();
    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn functions_with_headers_preserves_content_type() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/echo"))
        .and(header("content-type", "application/json"))
        .and(header("x-custom", "1"))
        .respond_with(
            ResponseTemplate::new(200)
                .insert_header("content-type", "application/json")
                .set_body_string(r#"{"ok":true}"#),
        )
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let headers = HashMap::from([("x-custom".to_string(), "1".to_string())]);
    let resp: serde_json::Value = client
        .functions
        .with_headers(headers)
        .post("/echo", &json!({"message": "hi"}))
        .await
        .unwrap();
    assert_eq!(resp["ok"], true);
}

#[tokio::test]
async fn from_clients_shares_store_and_applies_middleware() {
    let server = MockServer::start().await;
    let access_token = token(900);
    Mock::given(method("POST"))
        .and(header(
            "authorization",
            format!("Bearer {access_token}").as_str(),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"data":{"ok":true}}"#))
        .mount(&server)
        .await;

    let http = reqwest::Client::new();
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&access_token)).unwrap();

    let middleware: Vec<Arc<dyn Middleware>> = vec![Arc::new(AttachToken {
        storage: sessions.clone(),
    })];

    let client = Nhost::from_clients(
        auth::Client::new(server.uri(), http.clone(), middleware.clone())
            .with_session_capture(sessions.clone()),
        storage::Client::new(server.uri(), http.clone(), middleware.clone()),
        graphql::Client::new(server.uri(), http.clone(), middleware.clone()),
        functions::Client::new(server.uri(), http, middleware),
        sessions.clone(),
    );

    // The store handed to the constructor is the one the client reports.
    assert_eq!(
        client.session().unwrap().unwrap().session.access_token,
        access_token
    );

    // The caller-supplied middleware is in force on the data services (the mock
    // only matches when the token was attached).
    let data: serde_json::Value = client.graphql.query("query { ok }").send().await.unwrap();
    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn refresh_session_does_not_recurse_through_auth_middleware() {
    // `Nhost::refresh_session` refreshes through `nhost.auth`, so the refresh
    // middleware must skip the token endpoint — including on a custom auth URL
    // that does not end in `/v1` — or the refresh deadlocks on the storage lock.
    let server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(session_with(&refreshed)))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    let session = client.refresh_session().await.unwrap().unwrap();
    assert_eq!(session.session.access_token, refreshed);
    assert_eq!(
        client.session().unwrap().unwrap().session.access_token,
        refreshed
    );
}

#[tokio::test]
async fn session_refresh_middleware_refreshes_before_a_request() {
    let server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(session_with(&refreshed)))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/graphql"))
        .and(header(
            "authorization",
            format!("Bearer {refreshed}").as_str(),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"data":{"ok":true}}"#))
        .expect(1)
        .mount(&server)
        .await;

    let http = reqwest::Client::new();
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&token(-60))).unwrap();

    // The refresh middleware gets a bare auth client, as `Nhost::builder` does.
    let refresh_auth = Arc::new(auth::Client::new(server.uri(), http.clone(), Vec::new()));
    let middleware: Vec<Arc<dyn Middleware>> = vec![
        Arc::new(SessionRefresh {
            auth: refresh_auth,
            storage: sessions.clone(),
            margin: nhost::DEFAULT_REFRESH_MARGIN_SECONDS,
        }),
        Arc::new(AttachToken {
            storage: sessions.clone(),
        }),
    ];

    let client = Nhost::from_clients(
        auth::Client::new(server.uri(), http.clone(), middleware.clone())
            .with_session_capture(sessions.clone()),
        storage::Client::new(server.uri(), http.clone(), middleware.clone()),
        graphql::Client::new(format!("{}/graphql", server.uri()), http, middleware),
        functions::Client::new(server.uri(), reqwest::Client::new(), Vec::new()),
        sessions,
    );

    let data: serde_json::Value = client.graphql.query("query { ok }").send().await.unwrap();
    assert_eq!(data["ok"], true);
}

#[test]
fn error_variant_is_small() {
    // Guards against clippy::result_large_err regressions.
    assert!(std::mem::size_of::<Error>() <= 32);
}
