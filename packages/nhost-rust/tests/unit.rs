use base64::Engine;
use bytes::Bytes;
use nhost::http::Middleware;
use nhost::middleware::{
    AdminSessionOptions, AttachToken, HeaderPriority, SessionRefresh, SetHeaders,
};
use nhost::session::SessionStorage;
use nhost::{auth, functions, graphql, session, storage, Error, Nhost};
use reqwest::header::{HeaderMap, HeaderValue};
use serde::{Serialize, Serializer};
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use wiremock::matchers::{body_json, header, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

struct AttemptCounter(Arc<AtomicUsize>);

#[async_trait::async_trait]
impl Middleware for AttemptCounter {
    async fn handle(
        &self,
        request: reqwest::Request,
        extensions: &mut http::Extensions,
        next: reqwest_middleware::Next<'_>,
    ) -> reqwest_middleware::Result<reqwest::Response> {
        self.0.fetch_add(1, Ordering::Relaxed);
        next.run(request, extensions).await
    }
}

#[derive(Clone)]
struct RequestExtensionMarker;

struct ExtensionObserver(Arc<AtomicUsize>);

#[async_trait::async_trait]
impl Middleware for ExtensionObserver {
    async fn handle(
        &self,
        request: reqwest::Request,
        extensions: &mut http::Extensions,
        next: reqwest_middleware::Next<'_>,
    ) -> reqwest_middleware::Result<reqwest::Response> {
        if extensions.get::<RequestExtensionMarker>().is_some() {
            self.0.fetch_add(1, Ordering::Relaxed);
        }
        next.run(request, extensions).await
    }
}

fn token_with_claims(iat: Option<i64>, exp: i64) -> String {
    let mut payload = json!({ "exp": exp, "sub": "user-1" });
    if let Some(iat) = iat {
        payload["iat"] = json!(iat);
    }
    let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(serde_json::to_vec(&payload).unwrap());
    format!("aaa.{body}.sig")
}

/// A syntactically valid JWT expiring `in_secs` from now (negative = expired).
fn token(in_secs: i64) -> String {
    let exp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
        + in_secs;
    token_with_claims(None, exp)
}

fn session_with(access_token: &str) -> auth::Session {
    auth::Session {
        access_token: access_token.to_string(),
        access_token_expires_in: 900,
        refresh_token_id: "rid".to_string(),
        refresh_token: "rt".to_string(),
        // Keep the optional user absent so serialized refresh fixtures exercise
        // the spec-valid bare-session shape accepted by response capture.
        user: None,
    }
}

fn session_response_with(
    access_token: &str,
    refresh_token_id: &str,
    refresh_token: &str,
) -> serde_json::Value {
    json!({
        "accessToken": access_token,
        "accessTokenExpiresIn": 900,
        "refreshTokenId": refresh_token_id,
        "refreshToken": refresh_token,
    })
}

struct FailingSetStorage;

struct StoredSessionBackend {
    session: Mutex<Option<session::StoredSession>>,
}

impl StoredSessionBackend {
    fn new(session: session::StoredSession) -> Self {
        Self {
            session: Mutex::new(Some(session)),
        }
    }
}

impl session::Backend for StoredSessionBackend {
    fn get(&self) -> Result<Option<session::StoredSession>, Error> {
        Ok(self.session.lock().unwrap().clone())
    }

    fn set(&self, value: &session::StoredSession) -> Result<(), Error> {
        *self.session.lock().unwrap() = Some(value.clone());
        Ok(())
    }

    fn remove(&self) -> Result<(), Error> {
        *self.session.lock().unwrap() = None;
        Ok(())
    }
}

enum FailingStorageOperation {
    Read,
    Remove,
}

struct FailingStorage {
    operation: FailingStorageOperation,
    reads: Arc<AtomicUsize>,
}

impl FailingStorage {
    fn read(reads: Arc<AtomicUsize>) -> Self {
        Self {
            operation: FailingStorageOperation::Read,
            reads,
        }
    }

    fn remove() -> Self {
        Self {
            operation: FailingStorageOperation::Remove,
            reads: Arc::new(AtomicUsize::new(0)),
        }
    }
}

impl session::Backend for FailingStorage {
    fn get(&self) -> Result<Option<session::StoredSession>, Error> {
        self.reads.fetch_add(1, Ordering::Relaxed);
        match self.operation {
            FailingStorageOperation::Read => Err(Error::Storage("read failed".to_string())),
            FailingStorageOperation::Remove => Ok(None),
        }
    }

    fn set(&self, _value: &session::StoredSession) -> Result<(), Error> {
        Ok(())
    }

    fn remove(&self) -> Result<(), Error> {
        match self.operation {
            FailingStorageOperation::Read => Ok(()),
            FailingStorageOperation::Remove => Err(Error::Storage("remove failed".to_string())),
        }
    }
}

struct FailingSerialize;

impl Serialize for FailingSerialize {
    fn serialize<S>(&self, _serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        Err(serde::ser::Error::custom(
            "deliberate serialization failure",
        ))
    }
}

impl session::Backend for FailingSetStorage {
    fn get(&self) -> Result<Option<session::StoredSession>, Error> {
        Ok(None)
    }

    fn set(&self, _value: &session::StoredSession) -> Result<(), Error> {
        Err(Error::Storage("write failed".to_string()))
    }

    fn remove(&self) -> Result<(), Error> {
        Ok(())
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

fn assert_debug_redacted<T: std::fmt::Debug>(value: &T, secrets: &[&str], useful_values: &[&str]) {
    let output = format!("{value:?}");
    assert!(output.contains("<redacted>"), "{output}");
    for secret in secrets {
        assert!(
            !output.contains(secret),
            "debug output leaked {secret:?}: {output}"
        );
    }
    for useful in useful_values {
        assert!(
            output.contains(useful),
            "debug output omitted useful value {useful:?}: {output}"
        );
    }
}

#[test]
fn handwritten_debug_redacts_credentials_but_keeps_context() {
    let mut session_variables = HashMap::new();
    session_variables.insert("tenant".to_string(), "acme".to_string());
    let admin = AdminSessionOptions {
        admin_secret: "ADMIN-SECRET-04".to_string(),
        role: Some("support".to_string()),
        session_variables,
    };
    assert_debug_redacted(&admin, &["ADMIN-SECRET-04"], &["support", "tenant", "acme"]);

    let pkce = auth::PkcePair {
        verifier: "PKCE-VERIFIER-04".to_string(),
        challenge: "public-challenge".to_string(),
    };
    assert_debug_redacted(&pkce, &["PKCE-VERIFIER-04"], &["public-challenge"]);

    let stored = session::StoredSession {
        session: auth::Session {
            access_token: "ACCESS-TOKEN-04".to_string(),
            access_token_expires_in: 900,
            refresh_token_id: "refresh-id".to_string(),
            refresh_token: "REFRESH-TOKEN-04".to_string(),
            user: None,
        },
        decoded_token: session::DecodedToken {
            exp: Some(1_700_000_000_000),
            iat: Some(1_699_999_100_000),
            iss: Some("https://issuer.example".to_string()),
            sub: Some("user-04".to_string()),
            hasura_claims: Some(json!({ "x-hasura-default-role": "member" })),
            raw: json!({ "private_claim": "RAW-CLAIM-SECRET-04" }),
        },
    };
    assert_debug_redacted(
        &stored,
        &["ACCESS-TOKEN-04", "REFRESH-TOKEN-04", "RAW-CLAIM-SECRET-04"],
        &["900", "refresh-id", "user-04", "member"],
    );

    let serialized = serde_json::to_string(&stored).unwrap();
    assert!(serialized.contains("ACCESS-TOKEN-04"));
    assert!(serialized.contains("REFRESH-TOKEN-04"));
    assert!(serialized.contains("RAW-CLAIM-SECRET-04"));
}

#[test]
fn api_error_debug_redacts_credentials_but_keeps_context() {
    let mut headers = HeaderMap::new();
    headers.insert(
        "set-cookie",
        HeaderValue::from_static("nhostRefreshToken=COOKIE-SECRET-04; HttpOnly"),
    );
    headers.insert(
        "authorization",
        HeaderValue::from_static("Bearer AUTH-SECRET-04"),
    );
    headers.insert(
        "proxy-authorization",
        HeaderValue::from_static("Basic PROXY-SECRET-04"),
    );
    headers.insert(
        "x-hasura-admin-secret",
        HeaderValue::from_static("ADMIN-SECRET-04"),
    );
    headers.insert("x-request-id", HeaderValue::from_static("request-04"));
    let body = json!({
        "message": "request rejected",
        "refreshToken": "BODY-TOKEN-SECRET-04",
        "nested": {"client_secret": "NESTED-SECRET-04"},
        "requestId": "request-04",
    });
    let error = Error::api("request rejected".to_string(), 401, body.clone(), headers);

    assert_debug_redacted(
        &error,
        &[
            "COOKIE-SECRET-04",
            "AUTH-SECRET-04",
            "PROXY-SECRET-04",
            "ADMIN-SECRET-04",
            "BODY-TOKEN-SECRET-04",
            "NESTED-SECRET-04",
        ],
        &[
            "401",
            "request rejected",
            "set-cookie",
            "authorization",
            "proxy-authorization",
            "x-hasura-admin-secret",
            "refreshToken",
            "client_secret",
            "request-04",
        ],
    );

    let Error::Api(api_error) = error else {
        unreachable!("constructed an API error")
    };
    assert_eq!(api_error.body, body);
    assert_eq!(
        api_error.headers["set-cookie"],
        "nhostRefreshToken=COOKIE-SECRET-04; HttpOnly"
    );
}

#[test]
fn graphql_error_debug_redacts_structured_credentials_but_keeps_context() {
    let mut error = graphql::GraphqlError::new("resolver failed");
    error.locations = Some(json!([{"line": 1, "column": 9}]));
    error.path = Some(json!(["viewer", "email"]));
    error.extensions = Some(json!({
        "code": "permission-error",
        "requestId": "graphql-request-04",
        "internal": {"adminSecret": "EXTENSION-SECRET-04"},
    }));

    assert_debug_redacted(
        &error,
        &["EXTENSION-SECRET-04"],
        &[
            "resolver failed",
            "locations",
            "line",
            "viewer",
            "extensions",
            "permission-error",
            "adminSecret",
            "graphql-request-04",
        ],
    );
    assert_eq!(
        error.extensions.as_ref().unwrap()["internal"]["adminSecret"],
        "EXTENSION-SECRET-04"
    );
}

#[test]
fn public_output_constructors_support_downstream_test_fixtures() {
    let mut headers = HeaderMap::new();
    headers.insert("x-request-id", HeaderValue::from_static("request-1"));

    let api = nhost::ApiError::new("rejected", 403, json!({"code": "denied"}), headers.clone());
    assert_eq!(api.message, "rejected");
    assert_eq!(api.status, 403);

    let response = nhost::http::Response::new("ok", 201, headers.clone());
    assert_eq!(response.into_body(), "ok");

    let graphql_error = graphql::GraphqlError::new("resolver failed");
    let graphql_response =
        graphql::GraphqlResponse::new(None::<serde_json::Value>, Some(vec![graphql_error.clone()]));
    assert_eq!(
        graphql_response.errors.as_ref().unwrap()[0].message,
        "resolver failed"
    );

    let operation = nhost::GraphqlOperationError::new(
        vec![graphql::GraphqlError::new("resolver failed")],
        Some(json!({"viewer": null})),
        200,
        headers.clone(),
    );
    assert_eq!(operation.status(), 200);
    assert_eq!(operation.headers(), &headers);

    let Error::GraphQl(operation) = Error::graphql(
        vec![graphql::GraphqlError::new("resolver failed")],
        None,
        200,
        headers,
    ) else {
        unreachable!("constructed a GraphQL error")
    };
    assert_eq!(operation.errors()[0].message, "resolver failed");
}

#[tokio::test]
async fn graphql_operation_error_debug_redacts_credentials_but_keeps_context() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(
            ResponseTemplate::new(401)
                .insert_header(
                    "set-cookie",
                    "nhostRefreshToken=GRAPHQL-COOKIE-SECRET-04; HttpOnly",
                )
                .insert_header(
                    "location",
                    "https://app.example/callback?code=REDIRECT-CODE-SECRET-04",
                )
                .insert_header("x-request-id", "graphql-request-04")
                .set_body_json(json!({
                    "data": {
                        "viewer": {
                            "id": "user-04",
                            "refreshToken": "GRAPHQL-DATA-SECRET-04"
                        }
                    },
                    "errors": [{
                        "message": "resolver failed",
                        "locations": [{"line": 1, "column": 9}],
                        "path": ["viewer", "email"],
                        "extensions": {
                            "code": "permission-error",
                            "clientSecret": "GRAPHQL-EXTENSION-SECRET-04",
                            "requestId": "graphql-request-04"
                        }
                    }]
                })),
        )
        .mount(&server)
        .await;

    let err = mock_client(&server)
        .graphql
        .query("query { viewer { id email } }")
        .send::<serde_json::Value>()
        .await
        .unwrap_err();

    assert_debug_redacted(
        &err,
        &[
            "GRAPHQL-COOKIE-SECRET-04",
            "REDIRECT-CODE-SECRET-04",
            "GRAPHQL-DATA-SECRET-04",
            "GRAPHQL-EXTENSION-SECRET-04",
        ],
        &[
            "GraphqlOperationError",
            "401",
            "resolver failed",
            "permission-error",
            "refreshToken",
            "clientSecret",
            "set-cookie",
            "location",
            "x-request-id",
            "graphql-request-04",
            "user-04",
        ],
    );

    let Error::GraphQl(graphql_error) = err else {
        unreachable!("constructed a GraphQL operation error")
    };
    assert_eq!(
        graphql_error.data().unwrap()["viewer"]["refreshToken"],
        "GRAPHQL-DATA-SECRET-04"
    );
    assert_eq!(
        graphql_error.errors()[0].extensions.as_ref().unwrap()["clientSecret"],
        "GRAPHQL-EXTENSION-SECRET-04"
    );
    assert_eq!(
        graphql_error.headers()["set-cookie"],
        "nhostRefreshToken=GRAPHQL-COOKIE-SECRET-04; HttpOnly"
    );
}

#[test]
fn generated_debug_redacts_every_credential_category() {
    let session = auth::Session {
        access_token: "GENERATED-ACCESS-04".to_string(),
        access_token_expires_in: 900,
        refresh_token_id: "generated-refresh-id".to_string(),
        refresh_token: "GENERATED-REFRESH-04".to_string(),
        user: None,
    };
    assert_debug_redacted(
        &session,
        &["GENERATED-ACCESS-04", "GENERATED-REFRESH-04"],
        &["900", "generated-refresh-id"],
    );

    let password = auth::SignInEmailPasswordRequest {
        email: "debug@example.com".to_string(),
        password: "PASSWORD-04".to_string(),
    };
    assert_debug_redacted(&password, &["PASSWORD-04"], &["debug@example.com"]);

    let mfa = auth::SignInMfaTotpRequest {
        ticket: "MFA-TICKET-04".to_string(),
        otp: "123456-OTP-04".to_string(),
    };
    assert_debug_redacted(&mfa, &["MFA-TICKET-04", "123456-OTP-04"], &[]);

    let exchange = auth::TokenExchangeRequest {
        code: "AUTH-CODE-04".to_string(),
        code_verifier: "CODE-VERIFIER-04".to_string(),
    };
    assert_debug_redacted(&exchange, &["AUTH-CODE-04", "CODE-VERIFIER-04"], &[]);

    let assertion = auth::AuthenticatorAssertionResponse {
        client_data_json: "public-client-data".to_string(),
        authenticator_data: "public-authenticator-data".to_string(),
        signature: "WEBAUTHN-SIGNATURE-04".to_string(),
        user_handle: None,
    };
    assert_debug_redacted(
        &assertion,
        &["WEBAUTHN-SIGNATURE-04"],
        &["public-client-data", "public-authenticator-data"],
    );

    let totp = auth::TotpGenerateResponse {
        image_url: "data:image/png;base64,TOTP-QR-SECRET-04".to_string(),
        totp_secret: "TOTP-TEXT-SECRET-04".to_string(),
    };
    assert_debug_redacted(&totp, &["TOTP-QR-SECRET-04", "TOTP-TEXT-SECRET-04"], &[]);

    let presigned = storage::PresignedUrlResponse {
        url: "https://storage.example/file?X-Amz-Signature=PRESIGNED-SECRET-04".to_string(),
        expiration: 3600,
    };
    assert_debug_redacted(&presigned, &["PRESIGNED-SECRET-04"], &["3600"]);

    let oauth = auth::OAuth2TokenRequest {
        grant_type: "authorization_code".to_string(),
        code: Some("OAUTH-CODE-04".to_string()),
        redirect_uri: Some("https://app.example/callback".to_string()),
        client_id: Some("client-04".to_string()),
        client_secret: Some("CLIENT-SECRET-04".to_string()),
        code_verifier: Some("OAUTH-VERIFIER-04".to_string()),
        refresh_token: Some("OAUTH-REFRESH-04".to_string()),
        resource: None,
    };
    assert_debug_redacted(
        &oauth,
        &[
            "OAUTH-CODE-04",
            "CLIENT-SECRET-04",
            "OAUTH-VERIFIER-04",
            "OAUTH-REFRESH-04",
        ],
        &["authorization_code", "client-04", "app.example"],
    );

    let params = auth::VerifyTicketParams {
        ticket: "QUERY-TICKET-04".to_string(),
        r#type: Some("emailVerify".to_string()),
        redirect_to: "https://app.example/verified".to_string(),
        code_challenge: Some("public-code-challenge".to_string()),
    };
    assert_debug_redacted(
        &params,
        &["QUERY-TICKET-04"],
        &["emailVerify", "app.example", "public-code-challenge"],
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
fn service_url_overrides_remove_trailing_slashes() {
    let custom = Nhost::builder()
        .storage_url("http://localhost:1337/v1/storage///")
        .build()
        .unwrap();

    assert_eq!(custom.storage.base_url, "http://localhost:1337/v1/storage");
}

fn assert_config_error<T>(result: Result<T, Error>, expected: &str) {
    match result {
        Err(Error::Config(message)) => assert!(
            message.contains(expected),
            "expected configuration error containing {expected:?}, got {message:?}"
        ),
        Err(error) => panic!("expected Error::Config, got {error:?}"),
        Ok(_) => panic!("expected configuration error"),
    }
}

fn assert_config_error_without<T>(result: Result<T, Error>, expected: &str, forbidden: &str) {
    match result {
        Err(Error::Config(message)) => {
            assert!(
                message.contains(expected),
                "expected configuration error containing {expected:?}, got {message:?}"
            );
            assert!(
                !message.contains(forbidden),
                "configuration error leaked {forbidden:?}: {message:?}"
            );
        }
        Err(error) => panic!("expected Error::Config, got {error:?}"),
        Ok(_) => panic!("expected configuration error"),
    }
}

#[test]
fn service_urls_reject_incomplete_cloud_configuration() {
    assert_config_error(
        Nhost::builder().subdomain("demo").build(),
        "must be set together",
    );
    assert_config_error(
        Nhost::builder().region("eu-central-1").build(),
        "must be set together",
    );
}

#[test]
fn nhost_new_rejects_empty_cloud_configuration() {
    assert_config_error(Nhost::new("", ""), "subdomain must not be empty");
    assert_config_error(Nhost::new("demo", ""), "region must not be empty");
}

#[test]
fn nhost_new_rejects_invalid_cloud_host_labels() {
    for (subdomain, region, field) in [
        ("evil.example/redirect", "eu-1", "subdomain"),
        ("evil.example\\redirect", "eu-1", "subdomain"),
        ("...", "eu-1", "subdomain"),
        ("ok:80", "eu-1", "subdomain"),
        ("üñî", "eu-1", "subdomain"),
        ("-demo", "eu-1", "subdomain"),
        ("demo-", "eu-1", "subdomain"),
        ("demo", "eu-1/redirect", "region"),
        ("demo", "eu-1\\redirect", "region"),
    ] {
        assert_config_error(Nhost::new(subdomain, region), field);
    }
}

#[test]
fn service_urls_reject_whitespace_cloud_configuration_even_with_overrides() {
    assert_config_error(
        Nhost::builder()
            .subdomain("   ")
            .auth_url("https://example.com/auth")
            .storage_url("https://example.com/storage")
            .graphql_url("https://example.com/graphql")
            .functions_url("https://example.com/functions")
            .build(),
        "subdomain must not be empty",
    );
    assert_config_error(Nhost::new("demo", " \t"), "region must not be empty");
}

#[test]
fn complete_service_overrides_cover_partial_cloud_configuration() {
    let client = Nhost::builder()
        .subdomain("unused")
        .auth_url("https://example.com/auth")
        .storage_url("https://example.com/storage")
        .graphql_url("https://example.com/graphql")
        .functions_url("https://example.com/functions")
        .build()
        .unwrap();

    assert_eq!(client.auth.base_url, "https://example.com/auth");
    assert_eq!(client.storage.base_url, "https://example.com/storage");
    assert_eq!(client.graphql.url, "https://example.com/graphql");
    assert_eq!(client.functions.base_url, "https://example.com/functions");
}

#[test]
fn service_urls_reject_non_append_safe_overrides() {
    for (url, expected) in [
        ("localhost:1337/v1", "scheme must be http or https"),
        ("ftp://example.com/v1", "scheme must be http or https"),
        ("https://user:password@example.com/v1", "userinfo"),
        ("https://example.com/v1?tenant=demo", "query strings"),
        ("https://example.com/v1#token", "fragments"),
        ("http://[", "invalid auth service URL"),
    ] {
        assert_config_error(Nhost::builder().auth_url(url).build(), expected);
    }
}

#[test]
fn service_url_rejection_errors_do_not_echo_credentials() {
    for (url, secret, reason) in [
        (
            "https://user:USERINFO-PASSWORD@example.com/v1",
            "USERINFO-PASSWORD",
            "userinfo",
        ),
        (
            "https://example.com/v1?token=QUERY-TOKEN",
            "QUERY-TOKEN",
            "query strings",
        ),
        (
            "https://example.com/v1#FRAGMENT-TOKEN",
            "FRAGMENT-TOKEN",
            "fragments",
        ),
    ] {
        match Nhost::builder().storage_url(url).build() {
            Err(Error::Config(message)) => {
                assert!(message.contains("storage service URL"), "{message}");
                assert!(message.contains(reason), "{message}");
                assert!(
                    !message.contains(secret),
                    "configuration error leaked {secret:?}: {message}"
                );
            }
            Err(error) => panic!("expected Error::Config, got {error:?}"),
            Ok(_) => panic!("expected configuration error"),
        }
    }
}

#[test]
fn query_bearing_auth_url_is_rejected_at_construction() {
    assert_config_error(
        Nhost::builder()
            .auth_url("http://localhost:1337/v1/auth?x=1")
            .build(),
        "query strings",
    );
}

#[tokio::test]
async fn generated_multipart_rejects_invalid_content_type_as_config_error() {
    let client = storage::Client::new(
        "https://example.invalid/v1/storage",
        reqwest::Client::new(),
        Vec::new(),
    );

    let result = client
        .upload_files(storage::UploadFilesBody {
            bucket_id: None,
            metadata: None,
            file: vec![storage::FilePart {
                file_name: "test.txt".to_string(),
                content: b"test".to_vec(),
                content_type: Some("not a mime".to_string()),
            }],
        })
        .await;

    match result {
        Err(Error::Config(message)) => {
            assert_eq!(message, r#"invalid multipart content type "not a mime""#);
        }
        Err(error) => panic!("expected Error::Config, got {error:?}"),
        Ok(_) => panic!("expected invalid multipart content type to fail"),
    }
}

#[tokio::test]
async fn generated_clients_percent_encode_path_parameters() {
    let server = MockServer::start().await;
    let client = Nhost::builder()
        .auth_url(format!("{}/v1", server.uri()))
        .storage_url(format!("{}/v1", server.uri()))
        .build()
        .unwrap();

    let provider_url = client.auth.sign_in_provider_url("google", None).unwrap();
    assert_eq!(
        provider_url,
        format!("{}/v1/signin/provider/google", server.uri())
    );

    let traversal_url = client
        .auth
        .sign_in_provider_url("google/../../evil?x=1", None)
        .unwrap();
    assert_eq!(
        traversal_url,
        format!(
            "{}/v1/signin/provider/google%2F..%2F..%2Fevil%3Fx=1",
            server.uri()
        )
    );
    let parsed = reqwest::Url::parse(&traversal_url).unwrap();
    assert_eq!(
        parsed.path(),
        "/v1/signin/provider/google%2F..%2F..%2Fevil%3Fx=1"
    );
    assert_eq!(parsed.query(), None);

    const FILE_ID: &str = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    Mock::given(method("GET"))
        .and(path(format!("/v1/files/{FILE_ID}")))
        .respond_with(ResponseTemplate::new(200))
        .mount(&server)
        .await;

    client.storage.get_file(FILE_ID, None).await.unwrap();
    let requests = server.received_requests().await.unwrap();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].url.path(), format!("/v1/files/{FILE_ID}"));
}

#[tokio::test]
async fn generated_clients_encode_dots_only_path_parameters() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&server)
        .await;
    let client = Nhost::builder()
        .storage_url(format!("{}/v1", server.uri()))
        .without_session_management()
        .build()
        .unwrap();

    client.storage.get_file(".", None).await.unwrap();
    client.storage.get_file("..", None).await.unwrap();

    let requests = server.received_requests().await.unwrap();
    assert_eq!(requests.len(), 2);
    assert_eq!(requests[0].url.path(), "/v1/files/%252E");
    assert_eq!(requests[1].url.path(), "/v1/files/%252E%252E");
}

#[tokio::test]
async fn generated_clients_require_required_query_bundles() {
    let server = MockServer::start().await;
    let client = Nhost::builder()
        .auth_url(format!("{}/v1", server.uri()))
        .build()
        .unwrap();

    let verify_url = client
        .auth
        .verify_ticket_url(&auth::VerifyTicketParams {
            ticket: "ticket".to_string(),
            r#type: None,
            redirect_to: "https://example.com/done".to_string(),
            code_challenge: None,
        })
        .unwrap();
    let verify_query = reqwest::Url::parse(&verify_url)
        .unwrap()
        .query_pairs()
        .into_owned()
        .collect::<HashMap<_, _>>();
    assert_eq!(
        verify_query.get("ticket").map(String::as_str),
        Some("ticket")
    );
    assert_eq!(
        verify_query.get("redirectTo").map(String::as_str),
        Some("https://example.com/done")
    );

    let authorize_url = client
        .auth
        .oauth2_authorize_url(&auth::Oauth2AuthorizeParams {
            client_id: "client".to_string(),
            redirect_uri: "https://example.com/callback".to_string(),
            response_type: "code".to_string(),
            scope: None,
            state: None,
            nonce: None,
            code_challenge: None,
            code_challenge_method: None,
            resource: None,
            prompt: None,
        })
        .unwrap();
    let authorize_query = reqwest::Url::parse(&authorize_url)
        .unwrap()
        .query_pairs()
        .into_owned()
        .collect::<HashMap<_, _>>();
    assert_eq!(
        authorize_query.get("client_id").map(String::as_str),
        Some("client")
    );
    assert_eq!(
        authorize_query.get("redirect_uri").map(String::as_str),
        Some("https://example.com/callback")
    );
    assert_eq!(
        authorize_query.get("response_type").map(String::as_str),
        Some("code")
    );

    Mock::given(method("GET"))
        .and(path("/v1/oauth2/login"))
        .and(query_param("request_id", "request"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "requestId": "request",
            "clientId": "client",
            "scopes": [],
            "redirectUri": "https://example.com/callback"
        })))
        .mount(&server)
        .await;

    let response = client
        .auth
        .oauth2_login_get(auth::Oauth2LoginGetParams {
            request_id: "request".to_string(),
        })
        .await
        .unwrap();
    assert_eq!(response.body.request_id, "request");
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
fn jwt_decode_rejects_timestamp_overflow() {
    for payload in [json!({ "exp": i64::MAX }), json!({ "iat": i64::MAX })] {
        let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(serde_json::to_vec(&payload).unwrap());
        let token = format!("aaa.{body}.sig");

        assert!(matches!(
            session::decode_user_session(&token),
            Err(Error::InvalidToken(_))
        ));
    }
}

#[test]
fn jwt_decode_preserves_representable_expiry_boundaries() {
    for seconds in [i64::MIN / 1000, -1, 0, i64::MAX / 1000] {
        let payload = json!({ "exp": seconds });
        let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(serde_json::to_vec(&payload).unwrap());
        let token = format!("aaa.{body}.sig");

        let decoded = session::decode_user_session(&token).unwrap();
        assert_eq!(decoded.exp, seconds.checked_mul(1000));
        assert_eq!(
            serde_json::to_value(decoded).unwrap()["exp"],
            json!(seconds * 1000)
        );
    }
}

#[test]
fn notify_callback_can_reenter_storage_without_deadlock() {
    let storage = session::SessionStorage::new(Box::<session::MemoryStorage>::default());
    let reentrant = storage.clone();
    let _sub = storage.on_change(move |s| {
        if s.is_some() {
            let _ = reentrant.remove();
        }
    });

    storage.set(session_with(&token(900))).unwrap();

    assert!(storage.get().unwrap().is_none());
}

#[test]
fn dropping_subscription_stops_notifications() {
    let storage = session::SessionStorage::new(Box::<session::MemoryStorage>::default());
    let notifications = Arc::new(Mutex::new(Vec::new()));
    let recorded = Arc::clone(&notifications);
    let subscription = storage.on_change(move |session| {
        recorded.lock().unwrap().push(session.is_some());
    });

    storage.set(session_with(&token(900))).unwrap();
    assert_eq!(*notifications.lock().unwrap(), vec![true]);

    drop(subscription);
    storage.remove().unwrap();
    assert_eq!(*notifications.lock().unwrap(), vec![true]);
}

#[test]
fn panicking_subscriber_does_not_prevent_other_subscribers() {
    let storage = session::SessionStorage::new(Box::<session::MemoryStorage>::default());
    let notifications = Arc::new(Mutex::new(Vec::new()));
    let _panicking = storage.on_change(|_| panic!("intentional subscriber panic"));
    let recorded = Arc::clone(&notifications);
    let _recording = storage.on_change(move |session| {
        recorded.lock().unwrap().push(session.is_some());
    });

    let result = storage.set(session_with(&token(900)));

    assert!(result.is_ok());
    assert_eq!(*notifications.lock().unwrap(), vec![true]);
}

#[test]
fn subscription_dropped_inside_callback_does_not_deadlock() {
    let storage = session::SessionStorage::new(Box::<session::MemoryStorage>::default());
    let subscription_to_drop = Arc::new(Mutex::new(None));
    let drop_from_callback = Arc::clone(&subscription_to_drop);
    let _dropping = storage.on_change(move |_| {
        drop_from_callback.lock().unwrap().take();
    });
    *subscription_to_drop.lock().unwrap() = Some(storage.on_change(|_| {}));

    storage.set(session_with(&token(900))).unwrap();

    assert!(subscription_to_drop.lock().unwrap().is_none());
}

#[cfg(all(feature = "wasm", not(target_arch = "wasm32")))]
#[test]
fn native_wasm_feature_retains_file_storage() {
    let storage = session::FileStorage::new(std::env::temp_dir().join("nhost-session.json"));
    let _: &dyn session::Backend = &storage;
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

#[test]
fn builder_rejects_invalid_refresh_margins() {
    for margin in [-1, i64::MAX] {
        assert_config_error(
            Nhost::builder().refresh_margin(margin).build(),
            "refresh margin",
        );
    }
}

#[test]
fn builder_rejects_invalid_default_headers() {
    assert_config_error(
        Nhost::builder().role("editor\nadmin").build(),
        "x-hasura-role",
    );
    assert_config_error(
        Nhost::builder().header("bad header name", "value").build(),
        "bad header name",
    );
    assert_config_error_without(
        Nhost::builder()
            .header("x-api-key", "SECRET\nHEADER-VALUE")
            .build(),
        "x-api-key",
        "SECRET",
    );
}

#[test]
fn builder_rejects_invalid_admin_headers() {
    assert_config_error(
        Nhost::builder()
            .admin(AdminSessionOptions {
                admin_secret: "valid".to_string(),
                role: Some("support\nadmin".to_string()),
                session_variables: HashMap::new(),
            })
            .build(),
        "x-hasura-role",
    );
    assert_config_error(
        Nhost::builder()
            .admin(AdminSessionOptions {
                admin_secret: "valid".to_string(),
                role: None,
                session_variables: HashMap::from([(
                    "bad variable".to_string(),
                    "value".to_string(),
                )]),
            })
            .build(),
        "x-hasura-bad variable",
    );
    assert_config_error_without(
        Nhost::builder()
            .admin(AdminSessionOptions {
                admin_secret: "valid".to_string(),
                role: None,
                session_variables: HashMap::from([(
                    "user-id".to_string(),
                    "SECRET\nSESSION-VALUE".to_string(),
                )]),
            })
            .build(),
        "x-hasura-user-id",
        "SECRET",
    );
}

#[tokio::test]
async fn builder_admin_secret_is_isolated_from_auth_requests() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/.well-known/jwks.json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"keys": []})))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .graphql_url(server.uri())
        .without_session_management()
        .admin_secret("admin-secret")
        .build()
        .unwrap();

    let data: serde_json::Value = client.graphql.query("query { ok }").send().await.unwrap();
    assert_eq!(data["ok"], true);
    client.auth.get_jw_ks().await.unwrap();

    let requests = server.received_requests().await.unwrap();
    let graphql_request = requests
        .iter()
        .find(|request| request.url.path() == "/")
        .unwrap();
    assert_eq!(
        graphql_request.headers["x-hasura-admin-secret"],
        "admin-secret"
    );
    let auth_request = requests
        .iter()
        .find(|request| request.url.path() == "/.well-known/jwks.json")
        .unwrap();
    assert!(auth_request.headers.get("x-hasura-admin-secret").is_none());
}

#[tokio::test]
async fn builder_admin_session_identity_reaches_graphql_requests() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/"))
        .and(header("x-hasura-admin-secret", "admin-secret"))
        .and(header("x-hasura-role", "support"))
        .and(header("x-hasura-user-id", "user-123"))
        .and(header("x-hasura-tenant-id", "tenant-456"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .graphql_url(server.uri())
        .without_session_management()
        .admin(AdminSessionOptions {
            admin_secret: "admin-secret".to_string(),
            role: Some("support".to_string()),
            session_variables: HashMap::from([
                ("user-id".to_string(), "user-123".to_string()),
                ("tenant-id".to_string(), "tenant-456".to_string()),
            ]),
        })
        .build()
        .unwrap();

    let data: serde_json::Value = client.graphql.query("query { ok }").send().await.unwrap();
    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn admin_session_variable_role_overrides_declared_role() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/"))
        .and(header("x-hasura-admin-secret", "admin-secret"))
        .and(header("x-hasura-role", "session-variable-role"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .graphql_url(server.uri())
        .without_session_management()
        .admin(AdminSessionOptions {
            admin_secret: "admin-secret".to_string(),
            role: Some("declared-role".to_string()),
            session_variables: HashMap::from([(
                "role".to_string(),
                "session-variable-role".to_string(),
            )]),
        })
        .build()
        .unwrap();

    let data: serde_json::Value = client.graphql.query("query { ok }").send().await.unwrap();
    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn builder_role_and_headers_reach_graphql_and_auth_requests() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/.well-known/jwks.json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"keys": []})))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .graphql_url(server.uri())
        .without_session_management()
        .role("editor")
        .headers(HashMap::from([(
            "x-builder-map".to_string(),
            "mapped".to_string(),
        )]))
        .header("x-builder-single", "single")
        .build()
        .unwrap();

    client
        .graphql
        .query("query { ok }")
        .send::<serde_json::Value>()
        .await
        .unwrap();
    client.auth.get_jw_ks().await.unwrap();

    let requests = server.received_requests().await.unwrap();
    for request in &requests {
        assert_eq!(request.headers["x-hasura-role"], "editor");
        assert_eq!(request.headers["x-builder-map"], "mapped");
        assert_eq!(request.headers["x-builder-single"], "single");
    }
    assert_eq!(requests.len(), 2);
}

#[tokio::test]
async fn server_mode_attaches_expired_token_without_refreshing() {
    let server = MockServer::start().await;
    let stale = token(-60);
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(session_with(&refreshed)))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .graphql_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .server()
        .build()
        .unwrap();
    client.sessions.set(session_with(&stale)).unwrap();

    client
        .graphql
        .query("query { ok }")
        .send::<serde_json::Value>()
        .await
        .unwrap();

    let requests = server.received_requests().await.unwrap();
    assert_eq!(
        requests
            .iter()
            .filter(|request| request.url.path() == "/token")
            .count(),
        0
    );
    assert_eq!(requests.len(), 1);
    assert_eq!(
        requests[0].headers["authorization"],
        format!("Bearer {stale}")
    );
}

#[tokio::test]
async fn builder_zero_refresh_margin_refreshes_valid_session() {
    let server = MockServer::start().await;
    let stale = token(120);
    let refreshed = token(900);
    assert_ne!(stale, refreshed);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(session_with(&refreshed)))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/"))
        .and(header(
            "authorization",
            format!("Bearer {refreshed}").as_str(),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .graphql_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .refresh_margin(0)
        .build()
        .unwrap();
    client.sessions.set(session_with(&stale)).unwrap();

    let response = client
        .graphql
        .query("query { ok }")
        .send::<serde_json::Value>()
        .await;

    let requests = server.received_requests().await.unwrap();
    assert_eq!(
        requests
            .iter()
            .filter(|request| request.url.path() == "/token")
            .count(),
        1
    );
    assert_eq!(response.unwrap()["ok"], true);
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
async fn sign_out_clears_session_even_when_request_fails() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/signout"))
        .respond_with(ResponseTemplate::new(500).set_body_json(json!({"message": "failed"})))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(900))).unwrap();
    let changes = Arc::new(Mutex::new(Vec::new()));
    let recorded_changes = changes.clone();
    let _subscription = client.sessions.on_change(move |session| {
        recorded_changes.lock().unwrap().push(session.is_some());
    });

    let error = client
        .auth
        .sign_out(auth::SignOutRequest {
            refresh_token: None,
            all: None,
        })
        .await
        .unwrap_err();

    assert_eq!(error.status(), Some(500));
    assert!(client.session().unwrap().is_none());
    assert_eq!(*changes.lock().unwrap(), vec![false]);
}

#[tokio::test]
async fn sign_out_storage_error_takes_precedence_over_http_error() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/signout"))
        .respond_with(ResponseTemplate::new(500).set_body_json(json!({"message": "failed"})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::new(FailingStorage::remove()))
        .build()
        .unwrap();

    let error = client
        .auth
        .sign_out(auth::SignOutRequest {
            refresh_token: None,
            all: None,
        })
        .await
        .unwrap_err();

    assert!(matches!(error, Error::Storage(ref message) if message == "remove failed"));
    server.verify().await;
}

#[tokio::test]
async fn sign_out_redirect_clears_session_from_original_request_path() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/signout"))
        .respond_with(ResponseTemplate::new(302).insert_header("location", "/signed-out"))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/signed-out"))
        .respond_with(ResponseTemplate::new(200).set_body_json("OK"))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(900))).unwrap();

    client
        .auth
        .sign_out(auth::SignOutRequest {
            refresh_token: None,
            all: None,
        })
        .await
        .unwrap();

    assert!(client.session().unwrap().is_none());
}

#[tokio::test]
async fn successful_password_change_clears_session() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/user/password"))
        .respond_with(ResponseTemplate::new(200).set_body_json("OK"))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(900))).unwrap();
    let changes = Arc::new(Mutex::new(Vec::new()));
    let recorded_changes = changes.clone();
    let _subscription = client.sessions.on_change(move |session| {
        recorded_changes.lock().unwrap().push(session.is_some());
    });

    client
        .auth
        .change_user_password(auth::UserPasswordRequest {
            new_password: "new-password".to_string(),
            ticket: None,
        })
        .await
        .unwrap();

    assert!(client.session().unwrap().is_none());
    assert_eq!(*changes.lock().unwrap(), vec![false]);
}

#[tokio::test]
async fn failed_password_change_preserves_session() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/user/password"))
        .respond_with(ResponseTemplate::new(401).set_body_json(json!({"message": "unauthorized"})))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    let original_access_token = token(900);
    client
        .sessions
        .set(session_with(&original_access_token))
        .unwrap();

    let error = client
        .auth
        .change_user_password(auth::UserPasswordRequest {
            new_password: "new-password".to_string(),
            ticket: None,
        })
        .await
        .unwrap_err();

    assert_eq!(error.status(), Some(401));
    assert_eq!(
        client.session().unwrap().unwrap().session.access_token,
        original_access_token
    );
}

#[tokio::test]
async fn session_capture_stores_enveloped_session() {
    let server = MockServer::start().await;
    let access_token = token(900);
    Mock::given(method("POST"))
        .and(path("/signin/email-password"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "session": session_with(&access_token),
        })))
        .mount(&server)
        .await;

    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new())
        .with_session_capture(sessions.clone());

    let response = auth
        .sign_in_email_password(auth::SignInEmailPasswordRequest {
            email: "person@example.com".to_string(),
            password: "password".to_string(),
        })
        .await
        .unwrap();

    assert!(response.body.session.is_some());
    let stored = sessions.get().unwrap().unwrap();
    assert_eq!(stored.session.access_token, access_token);
    assert_eq!(stored.decoded_token.sub.as_deref(), Some("user-1"));
}

#[tokio::test]
async fn session_capture_stores_bare_session_without_user() {
    let server = MockServer::start().await;
    let access_token = token(900);
    let session = session_with(&access_token);
    let body = serde_json::to_value(&session).unwrap();
    assert!(body.get("user").is_none());
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(body))
        .mount(&server)
        .await;

    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new())
        .with_session_capture(sessions.clone());

    let response = auth
        .refresh_token(auth::RefreshTokenRequest {
            refresh_token: "request-refresh-token".to_string(),
        })
        .await
        .unwrap();

    assert!(response.body.user.is_none());
    let stored = sessions.get().unwrap().unwrap();
    assert_eq!(stored.session.access_token, access_token);
    assert_eq!(stored.decoded_token.sub.as_deref(), Some("user-1"));
}

#[tokio::test]
async fn session_capture_stores_bare_session_from_non_allowlisted_auth_path() {
    let server = MockServer::start().await;
    let access_token = token(900);
    Mock::given(method("POST"))
        .and(path("/user/mfa"))
        .respond_with(ResponseTemplate::new(200).set_body_json(session_with(&access_token)))
        .mount(&server)
        .await;

    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new())
        .with_session_capture(sessions.clone());

    // `/user/mfa` is intentionally outside the JS SDK's capture allowlist. Its
    // generated response type is a string, so parsing this synthetic bare
    // session fails after response capture has already stored it.
    let error = auth
        .verify_change_user_mfa(auth::UserMfaRequest {
            code: "123456".to_string(),
            active_mfa_type: None,
        })
        .await
        .unwrap_err();

    assert!(matches!(error, Error::Json(_)));
    let stored = sessions.get().unwrap().unwrap();
    assert_eq!(stored.session.access_token, access_token);
    assert_eq!(stored.decoded_token.sub.as_deref(), Some("user-1"));
}

#[tokio::test]
async fn session_capture_leaves_store_untouched_for_mfa_challenge() {
    let server = MockServer::start().await;
    let original_access_token = token(600);
    Mock::given(method("POST"))
        .and(path("/signin/email-password"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "session": null,
            "mfa": { "ticket": "mfaTotp:challenge" },
        })))
        .mount(&server)
        .await;

    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&original_access_token)).unwrap();
    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new())
        .with_session_capture(sessions.clone());

    let response = auth
        .sign_in_email_password(auth::SignInEmailPasswordRequest {
            email: "person@example.com".to_string(),
            password: "password".to_string(),
        })
        .await
        .unwrap();

    assert!(response.body.session.is_none());
    assert!(response.body.mfa.is_some());
    assert_eq!(
        sessions.get().unwrap().unwrap().session.access_token,
        original_access_token
    );
}

#[tokio::test]
async fn session_capture_mfa_null_session_does_not_fall_through_to_bare_fields() {
    let server = MockServer::start().await;
    let original_access_token = token(600);
    let decoy_access_token = token(900);
    // Generated response types accept unknown fields. Include a decoy bare
    // session to prove an explicit null envelope remains authoritative instead
    // of falling through to the bare-session heuristic.
    let mut body = serde_json::to_value(session_with(&decoy_access_token)).unwrap();
    let object = body.as_object_mut().unwrap();
    object.insert("session".to_string(), serde_json::Value::Null);
    object.insert("mfa".to_string(), json!({ "ticket": "mfaTotp:challenge" }));
    Mock::given(method("POST"))
        .and(path("/signin/email-password"))
        .respond_with(ResponseTemplate::new(200).set_body_json(body))
        .mount(&server)
        .await;

    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&original_access_token)).unwrap();
    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new())
        .with_session_capture(sessions.clone());

    let response = auth
        .sign_in_email_password(auth::SignInEmailPasswordRequest {
            email: "person@example.com".to_string(),
            password: "password".to_string(),
        })
        .await
        .unwrap();

    assert!(response.body.session.is_none());
    assert!(response.body.mfa.is_some());
    assert_eq!(
        sessions.get().unwrap().unwrap().session.access_token,
        original_access_token
    );
}

#[tokio::test]
async fn session_capture_leaves_store_untouched_for_non_success_response() {
    let server = MockServer::start().await;
    let original_access_token = token(600);
    let rejected_access_token = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(401).set_body_json(session_with(&rejected_access_token)),
        )
        .mount(&server)
        .await;

    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&original_access_token)).unwrap();
    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new())
        .with_session_capture(sessions.clone());

    let error = auth
        .refresh_token(auth::RefreshTokenRequest {
            refresh_token: "rejected-refresh-token".to_string(),
        })
        .await
        .unwrap_err();

    assert_eq!(error.status(), Some(401));
    assert_eq!(
        sessions.get().unwrap().unwrap().session.access_token,
        original_access_token
    );
}

#[tokio::test]
async fn session_capture_propagates_storage_errors() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/signin/email-password"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "session": session_with(&token(900)),
        })))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::new(FailingSetStorage))
        .build()
        .unwrap();
    let error = client
        .auth
        .sign_in_email_password(auth::SignInEmailPasswordRequest {
            email: "person@example.com".to_string(),
            password: "password".to_string(),
        })
        .await
        .unwrap_err();

    assert!(matches!(error, Error::Storage(ref message) if message == "write failed"));
    assert!(client.session().unwrap().is_none());
}

#[tokio::test]
async fn storage_head_error_uses_only_non_blank_x_error_header() {
    let cases = [
        (
            "message",
            "you are not authorized",
            "you are not authorized",
        ),
        (
            "padded message",
            "  permission denied  ",
            "permission denied",
        ),
        ("empty", "", "An unexpected error occurred"),
        ("whitespace", "   ", "An unexpected error occurred"),
    ];

    for (name, header_value, expected_message) in cases {
        let server = MockServer::start().await;
        Mock::given(method("HEAD"))
            .and(path("/files/abc"))
            .respond_with(ResponseTemplate::new(403).insert_header("X-Error", header_value))
            .mount(&server)
            .await;

        let client = Nhost::builder()
            .storage_url(server.uri())
            .without_session_management()
            .build()
            .unwrap();
        let error = client
            .storage
            .get_file_metadata_headers("abc", None)
            .await
            .unwrap_err();

        assert_eq!(error.status(), Some(403), "case: {name}");
        assert_eq!(
            error.to_string(),
            format!("{expected_message} (HTTP 403)"),
            "case: {name}"
        );
        let Error::Api(api_error) = error else {
            panic!("expected Error::Api for {name}, got {error:?}");
        };
        assert_eq!(api_error.message, expected_message, "case: {name}");
        assert_eq!(api_error.body, serde_json::Value::Null, "case: {name}");
    }
}

#[tokio::test]
async fn storage_error_body_message_takes_precedence_over_x_error_header() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/files/abc"))
        .respond_with(
            ResponseTemplate::new(403)
                .insert_header("X-Error", "header reason")
                .set_body_json(json!({"message": "body reason"})),
        )
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .storage_url(server.uri())
        .without_session_management()
        .build()
        .unwrap();
    let error = client.storage.get_file("abc", None).await.unwrap_err();

    assert_eq!(error.status(), Some(403));
    let Error::Api(api_error) = error else {
        panic!("expected Error::Api, got {error:?}");
    };
    assert_eq!(api_error.message, "body reason");
    assert_eq!(api_error.body, json!({"message": "body reason"}));
}

#[tokio::test]
async fn storage_not_modified_preserves_status_and_headers() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/files/abc"))
        .and(header("if-none-match", "\"version-1\""))
        .respond_with(ResponseTemplate::new(304).insert_header("etag", "\"version-1\""))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .storage_url(server.uri())
        .without_session_management()
        .build()
        .unwrap();
    let response = client
        .storage
        .get_file(
            "abc",
            Some(storage::GetFileParams {
                if_none_match: Some("\"version-1\"".to_string()),
                ..Default::default()
            }),
        )
        .await
        .unwrap();

    assert_eq!(response.status, 304);
    assert!(response.body.is_empty());
    assert_eq!(
        response.headers.get("etag").unwrap().to_str().unwrap(),
        "\"version-1\""
    );
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
async fn graphql_request_payload_includes_variables_and_operation_name() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/"))
        .and(body_json(json!({
            "query": "query A($offset: Int!, $limit: Int!) { items(offset: $offset, limit: $limit) { id } }",
            "variables": {"offset": 5, "limit": 10},
            "operationName": "A"
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"items": []}})))
        .expect(1)
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let data: serde_json::Value = client
        .graphql
        .query(
            "query A($offset: Int!, $limit: Int!) { items(offset: $offset, limit: $limit) { id } }",
        )
        .variables(json!({"offset": 5}))
        .variable("limit", 10)
        .operation_name("A")
        .send()
        .await
        .unwrap();

    assert_eq!(data["items"], json!([]));
}

#[tokio::test]
async fn graphql_request_payload_omits_unset_optional_fields() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/"))
        .and(body_json(json!({"query": "query { ok }"})))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let data: serde_json::Value = mock_client(&server)
        .graphql
        .query("query { ok }")
        .send()
        .await
        .unwrap();

    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn graphql_execute_preserves_transport_metadata() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(
            ResponseTemplate::new(201)
                .insert_header("x-request-id", "request-123")
                .set_body_string(r#"{"data":{"__typename":"query_root"},"errors":[]}"#),
        )
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let response = client
        .graphql
        .query("query { __typename }")
        .execute::<serde_json::Value>()
        .await
        .unwrap();

    assert_eq!(response.status, 201);
    assert_eq!(response.headers["x-request-id"], "request-123");
    assert!(response.body.errors.is_none());
    assert_eq!(response.body.data.unwrap()["__typename"], "query_root");
}

#[derive(Debug, serde::Deserialize)]
struct TypedViewerData {
    #[serde(rename = "viewer")]
    _viewer: Vec<serde_json::Value>,
}

#[tokio::test]
async fn graphql_execute_partial_errors_precede_typed_data_decode() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(
            ResponseTemplate::new(200)
                .insert_header("x-request-id", "partial-request-1")
                .set_body_json(json!({
                    "data": {"viewer": null},
                    "errors": [{
                        "message": "not allowed",
                        "extensions": {"code": "permission-error"}
                    }]
                })),
        )
        .mount(&server)
        .await;

    let err = mock_client(&server)
        .graphql
        .query("query { viewer { id } }")
        .execute::<TypedViewerData>()
        .await
        .unwrap_err();

    assert_eq!(err.to_string(), "GraphQL error: not allowed");
    let Error::GraphQl(graphql_error) = err else {
        panic!("expected Error::GraphQl, got {err:?}");
    };
    assert_eq!(graphql_error.status(), 200);
    assert_eq!(graphql_error.headers()["x-request-id"], "partial-request-1");
    assert_eq!(graphql_error.data(), Some(&json!({"viewer": null})));
    assert_eq!(graphql_error.errors()[0].code(), Some("permission-error"));
}

#[tokio::test]
async fn graphql_execute_reports_errors_even_when_typed_data_decodes() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": {"viewer": [{"refreshToken": "EXECUTE-PARTIAL-SECRET"}]},
            "errors": [{"message": "degraded result"}]
        })))
        .mount(&server)
        .await;

    let err = mock_client(&server)
        .graphql
        .query("query { viewer { id } }")
        .execute::<TypedViewerData>()
        .await
        .unwrap_err();

    let Error::GraphQl(graphql_error) = err else {
        panic!("expected Error::GraphQl, got {err:?}");
    };
    assert_eq!(
        graphql_error.data(),
        Some(&json!({
            "viewer": [{"refreshToken": "EXECUTE-PARTIAL-SECRET"}]
        }))
    );
    assert_eq!(graphql_error.errors()[0].message, "degraded result");
    assert!(!format!("{graphql_error:?}").contains("EXECUTE-PARTIAL-SECRET"));
}

#[tokio::test]
async fn graphql_execute_without_errors_keeps_typed_decode_failures() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"viewer": null}})))
        .mount(&server)
        .await;

    let err = mock_client(&server)
        .graphql
        .query("query { viewer { id } }")
        .execute::<TypedViewerData>()
        .await
        .unwrap_err();

    assert!(matches!(err, Error::Json(_)));
    assert!(err.to_string().contains("invalid type: null"));
}

#[tokio::test]
async fn graphql_empty_success_response_preserves_status_and_reports_no_data() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(2)
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let response = client
        .graphql
        .query("query { __typename }")
        .execute::<serde_json::Value>()
        .await
        .unwrap();

    assert_eq!(response.status, 200);
    assert!(response.body.data.is_none());
    assert!(response.body.errors.is_none());

    let err = client
        .graphql
        .query("query { __typename }")
        .send::<serde_json::Value>()
        .await
        .unwrap_err();

    assert_eq!(err.to_string(), "GraphQL error: response contained no data");
    let Error::GraphQl(graphql_error) = err else {
        panic!("expected Error::GraphQl, got {err:?}");
    };
    assert_eq!(graphql_error.status(), 200);
    assert!(graphql_error.errors().is_empty());
}

#[tokio::test]
async fn graphql_nonempty_success_envelope_without_data_reports_no_data() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_string("{}"))
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let err = client
        .graphql
        .query("query { __typename }")
        .send::<serde_json::Value>()
        .await
        .unwrap_err();

    assert_eq!(err.to_string(), "GraphQL error: response contained no data");
    let Error::GraphQl(graphql_error) = err else {
        panic!("expected Error::GraphQl, got {err:?}");
    };
    assert_eq!(graphql_error.status(), 200);
    assert!(graphql_error.errors().is_empty());
}

#[tokio::test]
async fn graphql_errors_map_to_error() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_string(
            r#"{
                "data":{"viewer":{"id":"user-1"}},
                "errors":[{
                    "message":"field not found",
                    "locations":[{"line":1,"column":9}],
                    "path":["viewer","missing"],
                    "extensions":{"code":"validation-failed"}
                },{
                    "message":"resolver failed",
                    "extensions":{"code":"unexpected"}
                }]
            }"#,
        ))
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let err = client
        .graphql
        .query("query { viewer { id missing } }")
        .send::<serde_json::Value>()
        .await
        .unwrap_err();

    assert_eq!(
        err.to_string(),
        "GraphQL error: field not found, resolver failed"
    );
    let Error::GraphQl(graphql_error) = &err else {
        panic!("expected Error::GraphQl, got {err:?}");
    };
    assert_eq!(graphql_error.status(), 200);
    assert_eq!(
        graphql_error.data(),
        Some(&json!({"viewer":{"id":"user-1"}}))
    );
    assert_eq!(graphql_error.errors().len(), 2);
    assert_eq!(graphql_error.errors()[0].code(), Some("validation-failed"));
    assert_eq!(graphql_error.errors()[1].code(), Some("unexpected"));
    assert_eq!(
        graphql_error.errors()[0].locations,
        Some(json!([{"line":1,"column":9}]))
    );
    assert_eq!(
        graphql_error.errors()[0].path,
        Some(json!(["viewer", "missing"]))
    );
}

#[tokio::test]
async fn graphql_errors_take_precedence_over_non_success_status() {
    // Pin this precedence for both an ordinary client error and precondition
    // failure; neither status may hide a structured GraphQL error envelope.
    for status in [400, 412] {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(status).set_body_string(
                r#"{
                    "data":{"viewer":null},
                    "errors":[{
                        "message":"not allowed",
                        "extensions":{"code":"permission-error"}
                    }]
                }"#,
            ))
            .mount(&server)
            .await;

        let client = mock_client(&server);
        let err = client
            .graphql
            .query("query { viewer { id } }")
            .execute::<serde_json::Value>()
            .await
            .unwrap_err();

        let Error::GraphQl(graphql_error) = &err else {
            panic!("GraphQL body errors should take precedence over HTTP status, got {err:?}");
        };
        assert_eq!(graphql_error.status(), status);
        assert_eq!(err.status(), Some(status));
        assert_eq!(graphql_error.data(), Some(&json!({"viewer":null})));
        assert_eq!(graphql_error.errors()[0].code(), Some("permission-error"));
    }
}

#[test]
fn api_error_unstructured_bodies_do_not_become_log_messages() {
    let long_body = format!("<html>{}</html>", "proxy failure".repeat(500));
    let mut headers = HeaderMap::new();
    headers.insert("x-error", HeaderValue::from_static("upstream unavailable"));
    let error = Error::from_response(502, headers, Bytes::from(long_body.clone()));
    let Error::Api(api_error) = error else {
        unreachable!("constructed an API error")
    };
    assert_eq!(api_error.message, "upstream unavailable");
    assert_eq!(api_error.to_string(), "upstream unavailable (HTTP 502)");
    assert_eq!(api_error.body, json!(long_body));

    let binary = Bytes::from_static(&[0xff, 0xfe, 0x00, b'A']);
    let error = Error::from_response(502, HeaderMap::new(), binary);
    let Error::Api(api_error) = error else {
        unreachable!("constructed an API error")
    };
    assert_eq!(api_error.message, "An unexpected error occurred");
    assert!(!api_error.to_string().contains('\0'));
    assert_eq!(api_error.body, json!("��\0A"));
}

#[test]
fn api_error_messages_are_single_line_and_bounded() {
    let original_message = format!("upstream\0failure {}\nignored", "x".repeat(500));
    let body = json!({"message": original_message});
    let error = Error::from_response(
        502,
        HeaderMap::new(),
        Bytes::from(serde_json::to_vec(&body).unwrap()),
    );
    let Error::Api(api_error) = error else {
        unreachable!("constructed an API error")
    };

    assert!(api_error.message.ends_with('…'), "{}", api_error.message);
    assert!(api_error.message.chars().count() <= 201);
    assert!(!api_error.message.chars().any(char::is_control));
    assert_eq!(api_error.body, body);
}

#[tokio::test]
async fn graphql_non_success_without_graphql_errors_stays_api_error() {
    let cases = [
        (
            "empty errors",
            Some(r#"{"errors":[]}"#),
            json!({"errors": []}),
            "An unexpected error occurred",
        ),
        (
            "message object",
            Some(r#"{"message":"bad request"}"#),
            json!({"message": "bad request"}),
            "bad request",
        ),
        (
            "nested error object",
            Some(r#"{"error":{"message":"request rejected"}}"#),
            json!({"error": {"message": "request rejected"}}),
            "request rejected",
        ),
        (
            "JSON array",
            Some(r#"["unexpected","shape"]"#),
            json!(["unexpected", "shape"]),
            "An unexpected error occurred",
        ),
        (
            "HTML",
            Some("<html>upstream failure</html>"),
            json!("<html>upstream failure</html>"),
            "An unexpected error occurred",
        ),
        (
            "empty body",
            None,
            serde_json::Value::Null,
            "An unexpected error occurred",
        ),
    ];

    for (name, body, expected_body, expected_message) in cases {
        let server = MockServer::start().await;
        let response = match body {
            Some(body) => ResponseTemplate::new(400).set_body_string(body),
            None => ResponseTemplate::new(400),
        };
        Mock::given(method("POST"))
            .respond_with(response)
            .mount(&server)
            .await;

        let error = mock_client(&server)
            .graphql
            .query("query { viewer { id } }")
            .send::<serde_json::Value>()
            .await
            .unwrap_err();

        let Error::Api(api_error) = error else {
            panic!("{name}: expected Error::Api, got {error:?}");
        };
        assert_eq!(api_error.status, 400, "{name}");
        assert_eq!(api_error.body, expected_body, "{name}");
        assert_eq!(api_error.message, expected_message, "{name}");
        assert_eq!(
            api_error.to_string(),
            format!("{expected_message} (HTTP 400)"),
            "{name}"
        );
    }
}

#[tokio::test]
async fn graphql_variables_serialization_error_prevents_request() {
    let server = MockServer::start().await;
    let client = mock_client(&server);

    let error = client
        .graphql
        .query("query ($id: uuid!) { item_by_pk(id: $id) { id } }")
        .variables(FailingSerialize)
        .variable("limit", 10)
        .send::<serde_json::Value>()
        .await
        .unwrap_err();

    assert!(matches!(error, Error::Json(_)));
    assert!(error
        .to_string()
        .contains("deliberate serialization failure"));
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn graphql_variable_serialization_error_prevents_request() {
    let server = MockServer::start().await;
    let client = mock_client(&server);

    let error = client
        .graphql
        .query("query ($id: uuid!) { item_by_pk(id: $id) { id } }")
        .variable("id", FailingSerialize)
        .variable("limit", 10)
        .execute::<serde_json::Value>()
        .await
        .unwrap_err();

    assert!(matches!(error, Error::Json(_)));
    assert!(error
        .to_string()
        .contains("deliberate serialization failure"));
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn graphql_named_variable_after_non_object_variables_errors() {
    let server = MockServer::start().await;
    let client = mock_client(&server);

    let error = client
        .graphql
        .query("query ($limit: Int!) { items(limit: $limit) { id } }")
        .variables(json!([1, 2, 3]))
        .variable("limit", 10)
        .send::<serde_json::Value>()
        .await
        .unwrap_err();

    assert!(matches!(error, Error::Json(_)));
    assert!(error
        .to_string()
        .contains("cannot add a named variable after setting non-object variables"));
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn functions_paths_are_appended_and_encoded() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": true})))
        .mount(&server)
        .await;
    let client = Nhost::builder()
        .functions_url(format!("{}/v1", server.uri()))
        .without_session_management()
        .build()
        .unwrap();

    for path in ["echo", "/echo", "nested/echo", "../admin", "?x=1"] {
        let response = client
            .functions
            .get::<serde_json::Value>(path)
            .await
            .unwrap();
        assert_eq!(response.body["ok"], true);
    }

    let requests = server.received_requests().await.unwrap();
    let paths = requests
        .iter()
        .map(|request| request.url.path())
        .collect::<Vec<_>>();
    assert_eq!(
        paths,
        [
            "/v1/echo",
            "/v1/echo",
            "/v1/nested/echo",
            "/v1/%252E%252E/admin",
            "/v1/%3Fx=1",
        ]
    );
    assert!(requests.iter().all(|request| request.url.query().is_none()));
}

#[tokio::test]
async fn functions_send_preserves_request_extensions_for_middleware() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/echo"))
        .respond_with(ResponseTemplate::new(200).set_body_string("OK"))
        .expect(1)
        .mount(&server)
        .await;
    let observations = Arc::new(AtomicUsize::new(0));
    let functions = functions::Client::new(
        server.uri(),
        reqwest::Client::new(),
        vec![Arc::new(ExtensionObserver(observations.clone()))],
    );
    let request = functions
        .request(reqwest::Method::GET, "/echo")
        .unwrap()
        .with_extension(RequestExtensionMarker);

    let response = functions.send(request).await.unwrap();

    assert_eq!(response.body, "OK");
    assert_eq!(observations.load(Ordering::Relaxed), 1);
    server.verify().await;
}

#[tokio::test]
async fn functions_post_decodes_json() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/echo"))
        .respond_with(
            ResponseTemplate::new(201)
                .insert_header("content-type", "application/json")
                .insert_header("x-function-version", "v2")
                .set_body_string(r#"{"body":{"message":"hello"},"method":"POST"}"#),
        )
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let response = client
        .functions
        .post::<_, serde_json::Value>("/echo", &json!({"message": "hello"}))
        .await
        .unwrap();

    assert_eq!(response.status, 201);
    assert_eq!(response.headers["x-function-version"], "v2");
    assert_eq!(response.body["body"]["message"], "hello");
}

#[tokio::test]
async fn functions_empty_json_response_retains_metadata() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/empty-204"))
        .respond_with(ResponseTemplate::new(204))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/null-200"))
        .respond_with(ResponseTemplate::new(200).set_body_string("null"))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/empty-200"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/body-204"))
        .respond_with(ResponseTemplate::new(204).set_body_json(json!({"present": true})))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/not-modified"))
        .respond_with(ResponseTemplate::new(304).insert_header("etag", "\"version-1\""))
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let empty_204 = client
        .functions
        .get::<Option<serde_json::Value>>("/empty-204")
        .await
        .unwrap();
    let null_200 = client
        .functions
        .get::<Option<serde_json::Value>>("/null-200")
        .await
        .unwrap();
    let empty_200 = client
        .functions
        .get::<Option<serde_json::Value>>("/empty-200")
        .await
        .unwrap();
    let body_204 = client
        .functions
        .get::<Option<serde_json::Value>>("/body-204")
        .await
        .unwrap();
    let not_modified = client
        .functions
        .get::<Option<serde_json::Value>>("/not-modified")
        .await
        .unwrap();

    assert_eq!(empty_204.status, 204);
    assert_eq!(empty_204.body, None);
    assert_eq!(null_200.status, 200);
    assert_eq!(null_200.body, None);
    assert_eq!(empty_200.status, 200);
    assert_eq!(empty_200.body, None);
    assert_eq!(body_204.status, 204);
    // reqwest presents a 204 as bodyless even when the mock supplies a payload.
    assert_eq!(body_204.body, None);
    assert_eq!(not_modified.status, 304);
    assert_eq!(not_modified.body, None);
    assert_eq!(not_modified.headers["etag"], "\"version-1\"");
}

#[tokio::test]
async fn api_error_preserves_non_empty_412_body() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/x"))
        .respond_with(
            ResponseTemplate::new(412).set_body_json(json!({"message": "precondition failed"})),
        )
        .mount(&server)
        .await;

    let client = mock_client(&server);
    let error = client
        .functions
        .post::<_, serde_json::Value>("/x", &json!({}))
        .await
        .unwrap_err();

    assert_eq!(error.status(), Some(412));
    let Error::Api(api_error) = error else {
        panic!("expected Error::Api, got {error:?}");
    };
    assert_eq!(api_error.message, "precondition failed");
    assert_eq!(api_error.body, json!({"message": "precondition failed"}));
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
async fn scoped_role_overrides_builder_role() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("x-hasura-role", "scoped"))
        .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"data":{"ok":true}}"#))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .graphql_url(server.uri())
        .without_session_management()
        .role("builder")
        .build()
        .unwrap();
    let data: serde_json::Value = client
        .graphql
        .with_role("scoped")
        .query("query { ok }")
        .send()
        .await
        .unwrap();
    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn typed_header_overrides_scoped_header() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(header("if-none-match", "typed"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(Vec::new()))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .storage_url(server.uri())
        .without_session_management()
        .build()
        .unwrap();
    let scoped = client.storage.with_headers(HashMap::from([(
        "if-none-match".to_string(),
        "scoped".to_string(),
    )]));
    scoped
        .get_file(
            "file-id",
            Some(storage::GetFileParams {
                if_none_match: Some("typed".to_string()),
                ..Default::default()
            }),
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn scoped_header_overrides_builder_header() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(header("if-none-match", "scoped"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(Vec::new()))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .storage_url(server.uri())
        .without_session_management()
        .header("if-none-match", "builder")
        .build()
        .unwrap();
    client
        .storage
        .with_headers(HashMap::from([(
            "if-none-match".to_string(),
            "scoped".to_string(),
        )]))
        .get_file("file-id", None)
        .await
        .unwrap();
}

#[tokio::test]
async fn typed_header_overrides_builder_header() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(header("if-none-match", "typed"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(Vec::new()))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .storage_url(server.uri())
        .without_session_management()
        .header("if-none-match", "builder")
        .build()
        .unwrap();
    client
        .storage
        .get_file(
            "file-id",
            Some(storage::GetFileParams {
                if_none_match: Some("typed".to_string()),
                ..Default::default()
            }),
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn typed_header_wins_over_scoped_and_builder_headers() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(header("if-none-match", "typed"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(Vec::new()))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .storage_url(server.uri())
        .without_session_management()
        .header("if-none-match", "builder")
        .build()
        .unwrap();
    client
        .storage
        .with_headers(HashMap::from([(
            "if-none-match".to_string(),
            "scoped".to_string(),
        )]))
        .get_file(
            "file-id",
            Some(storage::GetFileParams {
                if_none_match: Some("typed".to_string()),
                ..Default::default()
            }),
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn later_scoped_header_overrides_earlier_scope_and_builder_default() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("x-precedence", "scoped-2"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .graphql_url(server.uri())
        .header("x-precedence", "builder")
        .build()
        .unwrap();
    let data: serde_json::Value = client
        .graphql
        .with_headers(HashMap::from([(
            "x-precedence".to_string(),
            "scoped-1".to_string(),
        )]))
        .with_headers(HashMap::from([(
            "x-precedence".to_string(),
            "scoped-2".to_string(),
        )]))
        .query("query { ok }")
        .send()
        .await
        .unwrap();

    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn scoped_identity_overrides_admin_session_identity() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("x-hasura-admin-secret", "secret"))
        .and(header("x-hasura-role", "scoped-editor"))
        .and(header("x-hasura-user-id", "scoped-uid"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .graphql_url(server.uri())
        .admin(AdminSessionOptions {
            admin_secret: "secret".to_string(),
            role: Some("admin-impersonated".to_string()),
            session_variables: HashMap::from([("user-id".to_string(), "admin-uid".to_string())]),
        })
        .build()
        .unwrap();
    let data: serde_json::Value = client
        .graphql
        .with_role("scoped-editor")
        .with_headers(HashMap::from([(
            "x-hasura-user-id".to_string(),
            "scoped-uid".to_string(),
        )]))
        .query("query { ok }")
        .send()
        .await
        .unwrap();

    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn scoped_authorization_wins_and_suppresses_session_refresh() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("authorization", "Bearer scoped-override"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .graphql_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    let data: serde_json::Value = client
        .graphql
        .with_headers(HashMap::from([(
            "authorization".to_string(),
            "Bearer scoped-override".to_string(),
        )]))
        .query("query { ok }")
        .send()
        .await
        .unwrap();
    assert_eq!(data["ok"], true);

    let requests = server.received_requests().await.unwrap();
    assert_eq!(
        requests
            .iter()
            .filter(|request| request.url.path() == "/token")
            .count(),
        0
    );
}

#[tokio::test]
async fn scoped_authorization_suppresses_refresh_for_all_clients() {
    let mut token_hits = Vec::new();

    {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/.well-known/jwks.json"))
            .and(header("authorization", "Bearer scoped-override"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({"keys": []})))
            .expect(1)
            .mount(&server)
            .await;
        Mock::given(method("POST"))
            .and(path("/token"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&server)
            .await;

        let client = Nhost::builder()
            .auth_url(server.uri())
            .storage(Box::<session::MemoryStorage>::default())
            .build()
            .unwrap();
        client.sessions.set(session_with(&token(-60))).unwrap();
        client
            .auth
            .with_headers(HashMap::from([(
                "authorization".to_string(),
                "Bearer scoped-override".to_string(),
            )]))
            .get_jw_ks()
            .await
            .unwrap();
        token_hits.push(
            server
                .received_requests()
                .await
                .unwrap()
                .iter()
                .filter(|request| request.url.path() == "/token")
                .count(),
        );
    }

    {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/files/file-id"))
            .and(header("authorization", "Bearer scoped-override"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(Vec::new()))
            .expect(1)
            .mount(&server)
            .await;
        Mock::given(method("POST"))
            .and(path("/token"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&server)
            .await;

        let client = Nhost::builder()
            .auth_url(server.uri())
            .storage_url(server.uri())
            .storage(Box::<session::MemoryStorage>::default())
            .build()
            .unwrap();
        client.sessions.set(session_with(&token(-60))).unwrap();
        client
            .storage
            .with_headers(HashMap::from([(
                "authorization".to_string(),
                "Bearer scoped-override".to_string(),
            )]))
            .get_file("file-id", None)
            .await
            .unwrap();
        token_hits.push(
            server
                .received_requests()
                .await
                .unwrap()
                .iter()
                .filter(|request| request.url.path() == "/token")
                .count(),
        );
    }

    {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/"))
            .and(header("authorization", "Bearer scoped-override"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
            .expect(1)
            .mount(&server)
            .await;
        Mock::given(method("POST"))
            .and(path("/token"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&server)
            .await;

        let client = Nhost::builder()
            .auth_url(server.uri())
            .graphql_url(server.uri())
            .storage(Box::<session::MemoryStorage>::default())
            .build()
            .unwrap();
        client.sessions.set(session_with(&token(-60))).unwrap();
        let _: serde_json::Value = client
            .graphql
            .with_headers(HashMap::from([(
                "authorization".to_string(),
                "Bearer scoped-override".to_string(),
            )]))
            .query("query { ok }")
            .send()
            .await
            .unwrap();
        token_hits.push(
            server
                .received_requests()
                .await
                .unwrap()
                .iter()
                .filter(|request| request.url.path() == "/token")
                .count(),
        );
    }

    {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/echo"))
            .and(header("authorization", "Bearer scoped-override"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": true})))
            .expect(1)
            .mount(&server)
            .await;
        Mock::given(method("POST"))
            .and(path("/token"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&server)
            .await;

        let client = Nhost::builder()
            .auth_url(server.uri())
            .functions_url(server.uri())
            .storage(Box::<session::MemoryStorage>::default())
            .build()
            .unwrap();
        client.sessions.set(session_with(&token(-60))).unwrap();
        client
            .functions
            .with_headers(HashMap::from([(
                "authorization".to_string(),
                "Bearer scoped-override".to_string(),
            )]))
            .post::<_, serde_json::Value>("/echo", &json!({}))
            .await
            .unwrap();
        token_hits.push(
            server
                .received_requests()
                .await
                .unwrap()
                .iter()
                .filter(|request| request.url.path() == "/token")
                .count(),
        );
    }

    println!(
        "scoped authorization /token hits [auth, storage, graphql, functions] = {token_hits:?}"
    );
    assert_eq!(token_hits, [0, 0, 0, 0]);
}

#[tokio::test]
async fn builder_authorization_wins_and_suppresses_session_refresh() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("authorization", "Bearer builder-default"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .graphql_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .header("authorization", "Bearer builder-default")
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    let data: serde_json::Value = client.graphql.query("query { ok }").send().await.unwrap();
    assert_eq!(data["ok"], true);

    let requests = server.received_requests().await.unwrap();
    assert_eq!(
        requests
            .iter()
            .filter(|request| request.url.path() == "/token")
            .count(),
        0
    );
}

#[tokio::test]
async fn request_authorization_wins_and_suppresses_session_refresh() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/echo"))
        .and(header("authorization", "Bearer request-token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": true})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .functions_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    let body = client
        .functions
        .send(
            client
                .functions
                .request(reqwest::Method::POST, "/echo")
                .unwrap()
                .header("authorization", "Bearer request-token"),
        )
        .await
        .unwrap()
        .into_body();
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&body).unwrap()["ok"],
        true
    );

    let requests = server.received_requests().await.unwrap();
    assert_eq!(
        requests
            .iter()
            .filter(|request| request.url.path() == "/token")
            .count(),
        0
    );
}

#[tokio::test]
async fn request_json_content_type_wins_over_scoped_and_builder_headers() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("content-type", "application/json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .graphql_url(server.uri())
        .header("content-type", "text/plain")
        .build()
        .unwrap();
    let data: serde_json::Value = client
        .graphql
        .with_headers(HashMap::from([(
            "content-type".to_string(),
            "application/graphql".to_string(),
        )]))
        .query("query { ok }")
        .send()
        .await
        .unwrap();

    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn from_clients_can_express_builder_default_header_priority() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(header("x-priority", "scoped"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let http = reqwest::Client::new();
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    let middleware: Vec<Arc<dyn Middleware>> = vec![Arc::new(SetHeaders {
        headers: HashMap::from([("x-priority".to_string(), "default".to_string())]),
        priority: HeaderPriority::Default,
    })];
    let client = Nhost::from_clients(
        auth::Client::new(server.uri(), http.clone(), middleware.clone()),
        Arc::new(auth::Client::new(server.uri(), http.clone(), Vec::new())),
        storage::Client::new(server.uri(), http.clone(), middleware.clone()),
        graphql::Client::new(server.uri(), http.clone(), middleware.clone()),
        functions::Client::new(server.uri(), http, middleware),
        sessions,
    );

    let data: serde_json::Value = client
        .graphql
        .with_headers(HashMap::from([(
            "x-priority".to_string(),
            "scoped".to_string(),
        )]))
        .query("query { ok }")
        .send()
        .await
        .unwrap();
    assert_eq!(data["ok"], true);
}

#[test]
fn invalid_admin_secret_returns_config_error_without_exposing_value() {
    assert_config_error_without(
        Nhost::builder().admin_secret("s3cret\n").build(),
        "x-hasura-admin-secret",
        "s3cret",
    );
}

#[tokio::test]
async fn invalid_scoped_graphql_header_returns_middleware_error_without_exposing_value() {
    let server = MockServer::start().await;
    let client = mock_client(&server).graphql.with_headers(HashMap::from([(
        "x-api-key".to_string(),
        "SCOPED-SECRET-04\n".to_string(),
    )]));

    let error = client
        .query("query { ok }")
        .send::<serde_json::Value>()
        .await
        .unwrap_err();
    let Error::Middleware(error) = error else {
        panic!("expected Error::Middleware, got {error:?}")
    };
    let message = error.to_string();
    assert!(message.contains("x-api-key"), "{message}");
    assert!(!message.contains("SCOPED-SECRET-04"), "{message}");
    assert!(server.received_requests().await.unwrap().is_empty());
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
    let response = client
        .functions
        .with_headers(headers)
        .post::<_, serde_json::Value>("/echo", &json!({"message": "hi"}))
        .await
        .unwrap();
    assert_eq!(response.body["ok"], true);
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
        Arc::new(auth::Client::new(server.uri(), http.clone(), Vec::new())),
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
async fn zero_and_negative_expiries_are_rejected_before_scheduling() {
    let server = MockServer::start().await;
    for seconds in [-1, 0] {
        let payload = json!({ "exp": seconds });
        let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(serde_json::to_vec(&payload).unwrap());
        let invalid = format!("aaa.{body}.sig");
        let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());

        assert!(matches!(
            sessions.set(session_with(&invalid)),
            Err(Error::InvalidToken(_))
        ));
        assert!(sessions.get().unwrap().is_none());
    }
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn representable_far_future_expiry_is_safely_scheduled() {
    let server = MockServer::start().await;
    let seconds = i64::MAX / 1000;
    let payload = json!({ "exp": seconds });
    let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(serde_json::to_vec(&payload).unwrap());
    let access_token = format!("aaa.{body}.sig");
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());

    sessions.set(session_with(&access_token)).unwrap();
    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new());
    assert!(session::refresh_session(&auth, &sessions, 60)
        .await
        .unwrap()
        .is_some());
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn issuer_lifetime_caps_huge_advertised_lifetime() {
    let server = MockServer::start().await;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let expired = token_with_claims(Some(now - 1_800), now - 900);
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(session_response_with(
                &refreshed,
                "rotated-id",
                "rotated-token",
            )),
        )
        .expect(1)
        .mount(&server)
        .await;

    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new());
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    let mut raw = session_with(&expired);
    raw.access_token_expires_in = 9_220_000_000_000_000;
    sessions.set(raw).unwrap();

    let returned = session::refresh_session(&auth, &sessions, 901)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(returned.session.access_token, refreshed);
    server.verify().await;
}

#[tokio::test]
async fn issuer_lifetime_prevents_expired_bearer_attachment() {
    let server = MockServer::start().await;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let expiring = token_with_claims(Some(now), now + 10);
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(session_response_with(
                &refreshed,
                "rotated-id",
                "rotated-token",
            )),
        )
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/"))
        .and(header(
            "authorization",
            format!("Bearer {refreshed}").as_str(),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"data": {"ok": true}})))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .graphql_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&expiring)).unwrap();

    let data: serde_json::Value = client.graphql.query("query { ok }").send().await.unwrap();
    assert_eq!(data["ok"], true);
    server.verify().await;
}

#[tokio::test]
async fn iatless_token_under_fast_clock_refreshes_once_without_looping() {
    let server = MockServer::start().await;
    let fast_clock_token = token(-12 * 60 * 60);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(session_response_with(
                &fast_clock_token,
                "rotated-id",
                "rotated-token",
            )),
        )
        .expect(1)
        .mount(&server)
        .await;

    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new());
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&fast_clock_token)).unwrap();

    for _ in 0..5 {
        assert!(session::refresh_session(&auth, &sessions, 60)
            .await
            .unwrap()
            .is_some());
    }
    server.verify().await;
}

#[tokio::test]
async fn server_issued_session_survives_large_clock_skew_in_both_directions() {
    const CLOCK_SKEW_SECONDS: i64 = 12 * 60 * 60;

    for skew in [-CLOCK_SKEW_SECONDS, CLOCK_SKEW_SECONDS] {
        let server = MockServer::start().await;
        let server_now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64
            + skew;
        let payload = json!({ "iat": server_now, "exp": server_now + 900, "sub": "user-1" });
        let body = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(serde_json::to_vec(&payload).unwrap());
        let access_token = format!("aaa.{body}.sig");
        Mock::given(method("POST"))
            .and(path("/signin/email-password"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "session": session_with(&access_token),
            })))
            .mount(&server)
            .await;

        let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
        let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new())
            .with_session_capture(sessions.clone());
        auth.sign_in_email_password(auth::SignInEmailPasswordRequest {
            email: "person@example.com".to_string(),
            password: "password".to_string(),
        })
        .await
        .unwrap();

        assert_eq!(
            sessions.get().unwrap().unwrap().session.access_token,
            access_token
        );
        assert!(session::refresh_session(&auth, &sessions, 60)
            .await
            .unwrap()
            .is_some());
        assert_eq!(server.received_requests().await.unwrap().len(), 1);
    }
}

#[test]
fn invalid_access_token_lifetimes_are_rejected() {
    let access_token = token(900);
    for lifetime in [i64::MIN, -1, 0, i64::MAX] {
        let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
        let mut raw = session_with(&access_token);
        raw.access_token_expires_in = lifetime;
        assert!(matches!(sessions.set(raw), Err(Error::InvalidToken(_))));
    }
}

#[test]
fn unrepresentable_issuer_lifetime_is_rejected() {
    let access_token = token_with_claims(Some(i64::MIN / 1000), i64::MAX / 1000);
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());

    assert!(matches!(
        sessions.set(session_with(&access_token)),
        Err(Error::InvalidToken(_))
    ));
}

#[tokio::test]
async fn extreme_refresh_margin_returns_a_config_error() {
    let server = MockServer::start().await;
    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new());
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&token(900))).unwrap();

    assert_config_error(
        session::refresh_session(&auth, &sessions, i64::MAX).await,
        "refresh margin",
    );
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn persisted_extreme_expiry_is_redecoded_before_scheduling() {
    let server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(session_response_with(
                &refreshed,
                "rotated-id",
                "rotated-token",
            )),
        )
        .expect(2)
        .mount(&server)
        .await;

    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new());
    for persisted_exp in [i64::MIN, i64::MAX] {
        let expired = token(-60);
        let mut stored = session::StoredSession {
            session: session_with(&expired),
            decoded_token: session::decode_user_session(&expired).unwrap(),
        };
        stored.decoded_token.exp = Some(persisted_exp);
        let sessions = SessionStorage::new(Box::new(StoredSessionBackend::new(stored)));

        let returned = session::refresh_session(&auth, &sessions, 60)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(returned.session.access_token, refreshed);
        assert_eq!(
            sessions.get().unwrap().unwrap().decoded_token.exp,
            session::decode_user_session(&refreshed).unwrap().exp
        );
    }
}

#[tokio::test]
async fn refresh_session_notifies_once_and_requests_once() {
    let server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(session_response_with(
                &refreshed,
                "rotated-id",
                "rotated-token",
            )),
        )
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();
    let notifications = Arc::new(AtomicUsize::new(0));
    let recorded_notifications = notifications.clone();
    let _subscription = client.sessions.on_change(move |_| {
        recorded_notifications.fetch_add(1, Ordering::Relaxed);
    });

    client.refresh_session().await.unwrap().unwrap();

    assert_eq!(notifications.load(Ordering::Relaxed), 1);
    let requests = server.received_requests().await.unwrap();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].url.path(), "/token");
}

#[tokio::test]
async fn refresh_session_persists_rotated_refresh_token() {
    let server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(session_response_with(
                &refreshed,
                "rotated-id",
                "rotated-refresh-token",
            )),
        )
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    let refreshed_session = client.refresh_session().await.unwrap().unwrap();

    assert_eq!(
        refreshed_session.session.refresh_token,
        "rotated-refresh-token"
    );
    let persisted = client.session().unwrap().unwrap();
    assert_eq!(persisted.session.refresh_token_id, "rotated-id");
    assert_eq!(persisted.session.refresh_token, "rotated-refresh-token");
}

#[tokio::test]
async fn generated_and_session_refresh_requests_do_not_drift() {
    let server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(session_response_with(
                &refreshed,
                "rotated-id",
                "rotated-refresh-token",
            )),
        )
        .expect(2)
        .mount(&server)
        .await;

    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), vec![]);
    auth.refresh_token(auth::RefreshTokenRequest {
        refresh_token: "rt".to_string(),
    })
    .await
    .unwrap();

    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&token(-60))).unwrap();
    session::refresh_session(&auth, &sessions, 60)
        .await
        .unwrap()
        .unwrap();

    let requests = server.received_requests().await.unwrap();
    assert_eq!(requests.len(), 2);
    assert_eq!(requests[0].method, requests[1].method);
    assert_eq!(requests[0].url, requests[1].url);
    assert_eq!(requests[0].headers, requests[1].headers);
    assert_eq!(requests[0].body, requests[1].body);
    assert_eq!(requests[0].method.as_str(), "POST");
    assert_eq!(requests[0].url.path(), "/token");
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&requests[0].body).unwrap(),
        json!({ "refreshToken": "rt" })
    );
}

#[tokio::test]
async fn refresh_session_does_not_retry_after_token_is_accepted() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(session_response_with(
                "not-a-jwt",
                "rotated-id",
                "rotated-refresh-token",
            )),
        )
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    let result = client.refresh_session().await;

    let requests = server.received_requests().await.unwrap();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].url.path(), "/token");
    assert!(matches!(result, Err(Error::InvalidToken(_))));
}

#[tokio::test]
async fn refresh_session_does_not_retry_an_undecodable_200() {
    for body in ["{", r#"{"unexpected":true}"#] {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/token"))
            .respond_with(ResponseTemplate::new(200).set_body_raw(body, "application/json"))
            .mount(&server)
            .await;

        let client = Nhost::builder()
            .auth_url(server.uri())
            .storage(Box::<session::MemoryStorage>::default())
            .build()
            .unwrap();
        client.sessions.set(session_with(&token(-60))).unwrap();

        let result = client.refresh_session().await;

        let requests = server.received_requests().await.unwrap();
        assert_eq!(requests.len(), 1, "response body: {body}");
        assert_eq!(requests[0].url.path(), "/token");
        assert!(
            matches!(result, Err(Error::Json(_))),
            "response body: {body}"
        );
    }
}

#[tokio::test]
async fn refresh_session_does_not_retry_a_body_read_failure_after_200() {
    use std::io::{Read, Write};

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let auth_url = format!("http://{}", listener.local_addr().unwrap());
    let server = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let mut request = [0_u8; 4096];
        let _ = stream.read(&mut request).unwrap();
        stream
            .write_all(
                b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 100\r\nConnection: close\r\n\r\n{",
            )
            .unwrap();
    });

    let attempts = Arc::new(AtomicUsize::new(0));
    let auth = auth::Client::new(
        auth_url,
        reqwest::Client::new(),
        vec![Arc::new(AttemptCounter(attempts.clone()))],
    );
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&token(-60))).unwrap();

    let result = session::refresh_session(&auth, &sessions, 60).await;

    server.join().unwrap();
    assert!(matches!(result, Err(Error::Http(_))));
    assert_eq!(attempts.load(Ordering::Relaxed), 1);
}

#[tokio::test]
async fn refresh_session_unauthorized_clears_the_stored_session() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(401))
        .expect(2)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    let result = client.refresh_session().await;

    assert!(matches!(result, Ok(None)));
    assert!(client.session().unwrap().is_none());
}

#[tokio::test]
async fn refresh_session_retries_when_token_is_not_accepted() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    let original_access_token = token(-60);
    client
        .sessions
        .set(session_with(&original_access_token))
        .unwrap();

    let result = client.refresh_session().await;

    let requests = server.received_requests().await.unwrap();
    assert_eq!(requests.len(), 2);
    assert!(requests
        .iter()
        .all(|request| request.url.path() == "/token"));
    assert!(matches!(result, Ok(None)));
    assert_eq!(
        client.session().unwrap().unwrap().session.access_token,
        original_access_token
    );
}

#[tokio::test]
async fn refresh_session_soft_failure_with_zero_margin_keeps_expired_session() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(500))
        .expect(1)
        .mount(&server)
        .await;

    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new());
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    let original_access_token = token(-60);
    sessions.set(session_with(&original_access_token)).unwrap();

    let returned = session::refresh_session(&auth, &sessions, 0)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(returned.session.access_token, original_access_token);
    assert_eq!(
        sessions.get().unwrap().unwrap().session.access_token,
        original_access_token
    );
}

#[tokio::test]
async fn refresh_session_soft_failure_inside_margin_keeps_valid_session() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(500))
        .expect(1)
        .mount(&server)
        .await;

    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new());
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    let original_access_token = token(30);
    sessions.set(session_with(&original_access_token)).unwrap();

    let returned = session::refresh_session(&auth, &sessions, 60)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(returned.session.access_token, original_access_token);
    assert_eq!(
        sessions.get().unwrap().unwrap().session.access_token,
        original_access_token
    );
}

#[tokio::test]
async fn refresh_session_retries_connection_refused() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let auth_url = format!("http://{}", listener.local_addr().unwrap());
    drop(listener);

    let attempts = Arc::new(AtomicUsize::new(0));
    let auth = auth::Client::new(
        auth_url,
        reqwest::Client::new(),
        vec![Arc::new(AttemptCounter(attempts.clone()))],
    );
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&token(-60))).unwrap();

    let result = session::refresh_session(&auth, &sessions, 60).await;

    assert!(matches!(result, Ok(None)));
    assert_eq!(attempts.load(Ordering::Relaxed), 2);
}

#[tokio::test]
async fn refresh_session_retries_dns_failure() {
    let attempts = Arc::new(AtomicUsize::new(0));
    let reqwest = reqwest::Client::builder().no_proxy().build().unwrap();
    let auth = auth::Client::new(
        "http://refresh-must-not-exist.invalid",
        reqwest,
        vec![Arc::new(AttemptCounter(attempts.clone()))],
    );
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&token(-60))).unwrap();

    let result = session::refresh_session(&auth, &sessions, 60).await;

    assert!(matches!(result, Ok(None)));
    assert_eq!(attempts.load(Ordering::Relaxed), 2);
}

#[tokio::test]
async fn refresh_session_retries_timeout() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(200).set_delay(std::time::Duration::from_millis(100)))
        .mount(&server)
        .await;

    let attempts = Arc::new(AtomicUsize::new(0));
    let reqwest = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(20))
        .build()
        .unwrap();
    let auth = auth::Client::new(
        server.uri(),
        reqwest,
        vec![Arc::new(AttemptCounter(attempts.clone()))],
    );
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&token(-60))).unwrap();

    let result = session::refresh_session(&auth, &sessions, 60).await;

    assert!(matches!(result, Ok(None)));
    assert_eq!(attempts.load(Ordering::Relaxed), 2);
}

#[tokio::test]
async fn public_auth_refresh_token_does_not_trigger_recursive_pre_refresh() {
    // The public auth client still carries SessionRefresh. Its exact endpoint
    // guard prevents a direct refresh_token call from first rotating the stored
    // token through the middleware and then submitting that stale token again.
    let server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(session_response_with(
                &refreshed,
                "rotated-id",
                "rotated-token",
            )),
        )
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    let response = tokio::time::timeout(
        std::time::Duration::from_secs(2),
        client.auth.refresh_token(auth::RefreshTokenRequest {
            refresh_token: "rt".to_string(),
        }),
    )
    .await
    .expect("the public refresh endpoint must not re-enter automatic refresh")
    .unwrap();

    assert_eq!(response.body.access_token, refreshed);
    assert_eq!(server.received_requests().await.unwrap().len(), 1);
}

#[tokio::test]
async fn functions_token_path_still_refreshes_the_session() {
    let auth_server = MockServer::start().await;
    let functions_server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(session_with(&refreshed)))
        .expect(1)
        .mount(&auth_server)
        .await;
    Mock::given(method("POST"))
        .and(path("/token"))
        .and(header(
            "authorization",
            format!("Bearer {refreshed}").as_str(),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": true})))
        .expect(1)
        .mount(&functions_server)
        .await;

    let client = Nhost::builder()
        .auth_url(auth_server.uri())
        .functions_url(functions_server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    let response = client
        .functions
        .post::<_, serde_json::Value>("/token", &json!({}))
        .await
        .unwrap();

    assert_eq!(response.body["ok"], true);
    assert_eq!(
        client.session().unwrap().unwrap().session.access_token,
        refreshed
    );
}

#[tokio::test]
async fn same_origin_auth_and_storage_token_paths_still_refresh_the_session() {
    let server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(session_with(&refreshed)))
        .expect(2)
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/oauth2/token"))
        .and(header(
            "authorization",
            format!("Bearer {refreshed}").as_str(),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "access_token": "oauth-access-token",
            "token_type": "bearer",
            "expires_in": 900
        })))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("DELETE"))
        .and(path("/files/token"))
        .and(header(
            "authorization",
            format!("Bearer {refreshed}").as_str(),
        ))
        .respond_with(ResponseTemplate::new(204))
        .expect(1)
        .mount(&server)
        .await;

    let client = Nhost::builder()
        .auth_url(server.uri())
        .storage_url(server.uri())
        .storage(Box::<session::MemoryStorage>::default())
        .build()
        .unwrap();
    client.sessions.set(session_with(&token(-60))).unwrap();

    client
        .auth
        .oauth2_token(auth::OAuth2TokenRequest {
            grant_type: "refresh_token".to_string(),
            code: None,
            redirect_uri: None,
            client_id: None,
            client_secret: None,
            code_verifier: None,
            refresh_token: Some("oauth-refresh-token".to_string()),
            resource: None,
        })
        .await
        .unwrap();

    client.sessions.set(session_with(&token(-60))).unwrap();
    client.storage.delete_file("token").await.unwrap();

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
            auth: refresh_auth.clone(),
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
        refresh_auth,
        storage::Client::new(server.uri(), http.clone(), middleware.clone()),
        graphql::Client::new(format!("{}/graphql", server.uri()), http, middleware),
        functions::Client::new(server.uri(), reqwest::Client::new(), Vec::new()),
        sessions,
    );

    let data: serde_json::Value = client.graphql.query("query { ok }").send().await.unwrap();
    assert_eq!(data["ok"], true);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_requests_share_one_session_refresh() {
    let server = MockServer::start().await;
    let refreshed = token(900);
    Mock::given(method("POST"))
        .and(path("/token"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_delay(std::time::Duration::from_millis(50))
                .set_body_json(session_with(&refreshed)),
        )
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
        .expect(8)
        .mount(&server)
        .await;

    let http = reqwest::Client::new();
    let sessions = SessionStorage::new(Box::<session::MemoryStorage>::default());
    sessions.set(session_with(&token(-60))).unwrap();
    let refresh_auth = Arc::new(auth::Client::new(server.uri(), http.clone(), Vec::new()));
    let middleware: Vec<Arc<dyn Middleware>> = vec![
        Arc::new(SessionRefresh {
            auth: refresh_auth.clone(),
            storage: sessions.clone(),
            margin: nhost::DEFAULT_REFRESH_MARGIN_SECONDS,
        }),
        Arc::new(AttachToken {
            storage: sessions.clone(),
        }),
    ];
    let client = Arc::new(Nhost::from_clients(
        auth::Client::new(server.uri(), http.clone(), middleware.clone())
            .with_session_capture(sessions.clone()),
        refresh_auth,
        storage::Client::new(server.uri(), http.clone(), middleware.clone()),
        graphql::Client::new(format!("{}/graphql", server.uri()), http, middleware),
        functions::Client::new(server.uri(), reqwest::Client::new(), Vec::new()),
        sessions,
    ));

    let requests: Vec<_> = (0..8)
        .map(|_| {
            let client = client.clone();
            tokio::spawn(async move {
                client
                    .graphql
                    .query("query { ok }")
                    .send::<serde_json::Value>()
                    .await
            })
        })
        .collect();

    tokio::time::timeout(std::time::Duration::from_secs(2), async {
        for request in requests {
            let data = request.await.expect("query task must not panic").unwrap();
            assert_eq!(data["ok"], true);
        }
    })
    .await
    .expect("concurrent refresh requests must not deadlock");
    server.verify().await;
}

#[tokio::test]
async fn session_storage_read_error_fails_request_without_sending_it() {
    let server = MockServer::start().await;
    let reads = Arc::new(AtomicUsize::new(0));
    let client = Nhost::builder()
        .auth_url(server.uri())
        .graphql_url(server.uri())
        .storage(Box::new(FailingStorage::read(reads.clone())))
        .build()
        .unwrap();

    let err = client
        .graphql
        .query("query { ok }")
        .send::<serde_json::Value>()
        .await
        .unwrap_err();

    assert!(matches!(err, Error::Middleware(_)));
    assert!(err.to_string().contains("session storage error"));
    assert_eq!(reads.load(Ordering::Relaxed), 1);
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn server_mode_storage_read_error_fails_request() {
    let server = MockServer::start().await;
    let reads = Arc::new(AtomicUsize::new(0));
    let client = Nhost::builder()
        .auth_url(server.uri())
        .graphql_url(server.uri())
        .storage(Box::new(FailingStorage::read(reads.clone())))
        .server()
        .build()
        .unwrap();

    let err = client
        .graphql
        .query("query { ok }")
        .send::<serde_json::Value>()
        .await
        .unwrap_err();

    assert!(matches!(err, Error::Middleware(_)));
    assert!(err.to_string().contains("session storage error"));
    assert_eq!(reads.load(Ordering::Relaxed), 1);
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn caller_authorization_skips_failed_session_storage_read() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/echo"))
        .and(header("authorization", "Bearer caller-token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": true})))
        .expect(1)
        .mount(&server)
        .await;
    let reads = Arc::new(AtomicUsize::new(0));
    let client = Nhost::builder()
        .auth_url(server.uri())
        .functions_url(server.uri())
        .storage(Box::new(FailingStorage::read(reads.clone())))
        .build()
        .unwrap();

    let body = client
        .functions
        .send(
            client
                .functions
                .request(reqwest::Method::POST, "/echo")
                .unwrap()
                .header("authorization", "Bearer caller-token"),
        )
        .await
        .unwrap()
        .into_body();

    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&body).unwrap()["ok"],
        true
    );
    assert_eq!(reads.load(Ordering::Relaxed), 0);
}

#[tokio::test]
async fn refresh_session_does_not_retry_storage_read_errors() {
    let server = MockServer::start().await;
    let reads = Arc::new(AtomicUsize::new(0));
    let storage = SessionStorage::new(Box::new(FailingStorage::read(reads.clone())));
    let auth = auth::Client::new(server.uri(), reqwest::Client::new(), Vec::new());

    let err = session::refresh_session(&auth, &storage, 60)
        .await
        .unwrap_err();

    assert!(matches!(err, Error::Storage(_)));
    assert_eq!(reads.load(Ordering::Relaxed), 1);
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[test]
fn error_variant_is_small() {
    // Guards against clippy::result_large_err regressions.
    assert!(std::mem::size_of::<Error>() <= 32);
}
