//! Offline unit tests (no backend). HTTP-backed tests use a wiremock server.

use base64::Engine;
use nhost::{
    auth, create_server_client, fetch, generate_service_url, graphql, session, Options, ServiceType,
};
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[test]
fn pkce_rfc7636_vector() {
    // RFC 7636 Appendix B test vector.
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
    assert_eq!(
        generate_service_url(ServiceType::Auth, Some("demo"), Some("eu-central-1"), None),
        "https://demo.auth.eu-central-1.nhost.run/v1"
    );
    assert_eq!(
        generate_service_url(ServiceType::Graphql, None, None, None),
        "https://local.graphql.local.nhost.run/v1"
    );
    assert_eq!(
        generate_service_url(
            ServiceType::Storage,
            None,
            None,
            Some("http://localhost:1337/v1/storage")
        ),
        "http://localhost:1337/v1/storage"
    );
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
    // exp is stored in milliseconds (raw seconds * 1000), matching @nhost/nhost-js.
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
    // The persisted `decodedToken` must match @nhost/nhost-js: exp/iat in
    // milliseconds and Hasura claims keyed under the JWT claim URL.
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
    // The Rust-only field name must not leak into the persisted shape.
    assert!(json.get("hasura_claims").is_none());
}

#[test]
fn jwt_decode_invalid() {
    assert!(session::decode_user_session("not-a-jwt").is_err());
}

#[test]
fn notify_callback_can_reenter_storage_without_deadlock() {
    // A subscriber that touches the storage from within its callback (here,
    // remove()) must not deadlock: notify invokes callbacks outside the
    // subscribers lock. Under the old lock-across-callback code this hangs.
    let payload = serde_json::json!({ "exp": 9_999_999_999_i64, "sub": "u" });
    let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(serde_json::to_vec(&payload).unwrap());
    let token = format!("aaa.{body}.sig");

    let storage = session::SessionStorage::new(Box::<session::MemoryStorage>::default());
    let reentrant = storage.clone();
    let _sub = storage.on_change(move |s| {
        if s.is_some() {
            reentrant.remove();
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

    assert!(storage.get().is_none());
}

#[test]
fn server_client_requires_storage() {
    assert!(create_server_client(Options::default()).is_err());
    assert!(create_server_client(Options {
        storage: Some(Box::<session::MemoryStorage>::default()),
        ..Default::default()
    })
    .is_ok());
}

#[tokio::test]
async fn graphql_request_success() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(
            ResponseTemplate::new(200).set_body_string(r#"{"data":{"__typename":"query_root"}}"#),
        )
        .mount(&server)
        .await;

    let client = graphql::Client::new(server.uri(), vec![], reqwest::Client::new());
    let resp = client
        .request("query { __typename }", None, None, None)
        .await
        .unwrap();

    assert_eq!(resp.body.data.unwrap()["__typename"], "query_root");
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

    let client = graphql::Client::new(server.uri(), vec![], reqwest::Client::new());
    let err = client
        .request("query { nope }", None, None, None)
        .await
        .unwrap_err();

    assert_eq!(err.to_string(), "field not found");
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

    let client = nhost::functions::Client::new(server.uri(), vec![], reqwest::Client::new());
    let resp = client
        .post("/echo", &serde_json::json!({"message": "hello"}), None)
        .await
        .unwrap();

    assert_eq!(resp.body["body"]["message"], "hello");
}

#[tokio::test]
async fn fetch_error_extracts_message() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(400).set_body_string(r#"{"message":"bad input"}"#))
        .mount(&server)
        .await;

    let client = nhost::functions::Client::new(server.uri(), vec![], reqwest::Client::new());
    let err = client
        .post("/x", &serde_json::json!({}), None)
        .await
        .unwrap_err();

    assert_eq!(err.to_string(), "bad input");
    assert_eq!(err.status(), Some(400));
}

#[tokio::test]
async fn with_role_middleware_sets_header() {
    let server = MockServer::start().await;
    // Only matches when the x-hasura-role header is present.
    Mock::given(method("POST"))
        .and(header("x-hasura-role", "editor"))
        .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"data":{"ok":true}}"#))
        .mount(&server)
        .await;

    let mut client = graphql::Client::new(server.uri(), vec![], reqwest::Client::new());
    client.push_chain_function(nhost::middleware::with_role("editor".to_string()));

    let resp = client
        .request("query { ok }", None, None, None)
        .await
        .unwrap();
    assert_eq!(resp.status, 200);
}

#[tokio::test]
async fn graphql_custom_headers_preserve_content_type() {
    // Regression: caller headers must be merged, not replace the whole map, so
    // the `Content-Type: application/json` set by `.json()` survives alongside a
    // custom header like `x-hasura-role`. The mock only matches when BOTH are
    // present.
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("content-type", "application/json"))
        .and(header("x-hasura-role", "editor"))
        .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"data":{"ok":true}}"#))
        .mount(&server)
        .await;

    let client = graphql::Client::new(server.uri(), vec![], reqwest::Client::new());
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("x-hasura-role", "editor".parse().unwrap());

    let resp = client
        .request("query { ok }", None, None, Some(headers))
        .await
        .unwrap();
    assert_eq!(resp.status, 200);
}

#[tokio::test]
async fn functions_post_custom_headers_preserve_content_type() {
    // Regression companion for `functions::Client::post`: custom headers must not
    // wipe `Content-Type`/`Accept` set by the builder.
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

    let client = nhost::functions::Client::new(server.uri(), vec![], reqwest::Client::new());
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("x-custom", "1".parse().unwrap());

    let resp = client
        .post("/echo", &serde_json::json!({"message": "hi"}), Some(headers))
        .await
        .unwrap();
    assert_eq!(resp.status, 200);
}

#[test]
fn error_variant_is_small() {
    // Guards against clippy::result_large_err regressions.
    assert!(std::mem::size_of::<fetch::Error>() <= 32);
}
