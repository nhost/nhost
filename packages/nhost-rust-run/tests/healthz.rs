use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt; // for `oneshot`

#[tokio::test]
async fn healthz_ok() {
    let app = nhost_run::healthz_router(|| async { Ok::<(), String>(()) });

    let res = app
        .oneshot(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn healthz_unhealthy() {
    let app = nhost_run::healthz_router(|| async { Err::<(), String>("db down".to_owned()) });

    let res = app
        .oneshot(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);
}
