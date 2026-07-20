use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use nhost_run::RunService;
use tower::ServiceExt; // for `oneshot`

async fn healthz_status(app: Router) -> StatusCode {
    app.oneshot(
        Request::builder()
            .uri("/healthz")
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .unwrap()
    .status()
}

#[tokio::test]
async fn healthz_defaults_to_ok_without_a_check() {
    let app = RunService::new(Router::new()).into_router();
    assert_eq!(healthz_status(app).await, StatusCode::OK);
}

#[tokio::test]
async fn healthz_ok() {
    let app = RunService::new(Router::new())
        .health(|| async { Ok::<(), String>(()) })
        .into_router();
    assert_eq!(healthz_status(app).await, StatusCode::OK);
}

#[tokio::test]
async fn healthz_unhealthy() {
    let app = RunService::new(Router::new())
        .health(|| async { Err::<(), String>("db down".to_owned()) })
        .into_router();
    assert_eq!(healthz_status(app).await, StatusCode::SERVICE_UNAVAILABLE);
}
