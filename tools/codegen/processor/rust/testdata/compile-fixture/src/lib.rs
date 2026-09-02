pub mod error {
    pub type Error = Box<dyn std::error::Error + Send + Sync>;
}

pub mod session {
    #[derive(Clone)]
    pub struct SessionStorage;
}

pub mod http {
    use std::sync::Arc;

    use crate::error::Error;
    use crate::session::SessionStorage;

    pub struct Response<T> {
        pub body: T,
        pub status: reqwest::StatusCode,
        pub headers: reqwest::header::HeaderMap,
    }

    pub trait Middleware: Send + Sync {}

    pub struct ClientWithMiddleware(reqwest::Client);

    impl ClientWithMiddleware {
        pub fn request(&self, method: reqwest::Method, url: String) -> reqwest::RequestBuilder {
            self.0.request(method, url)
        }
    }

    pub fn build_client(
        client: reqwest::Client,
        _middleware: &[Arc<dyn Middleware>],
    ) -> ClientWithMiddleware {
        ClientWithMiddleware(client)
    }

    pub async fn send(
        _request: reqwest::RequestBuilder,
        _session_sink: Option<&SessionStorage>,
    ) -> Result<(reqwest::StatusCode, reqwest::header::HeaderMap, Vec<u8>), Error> {
        unimplemented!("compile-only runtime contract")
    }
}

pub mod middleware {
    use std::collections::HashMap;

    use crate::http::Middleware;

    pub struct SetRole {
        pub role: String,
    }

    impl Middleware for SetRole {}

    pub struct SetHeaders {
        pub headers: HashMap<String, String>,
    }

    impl Middleware for SetHeaders {}
}

pub mod generated;
