pub mod error {
    #[derive(Debug)]
    pub enum Error {
        Config(String),
        Other(Box<dyn std::error::Error + Send + Sync>),
    }

    impl std::fmt::Display for Error {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                Self::Config(message) => write!(f, "configuration error: {message}"),
                Self::Other(error) => error.fmt(f),
            }
        }
    }

    impl std::error::Error for Error {}

    impl From<reqwest::Error> for Error {
        fn from(error: reqwest::Error) -> Self {
            Self::Other(Box::new(error))
        }
    }

    impl From<serde_json::Error> for Error {
        fn from(error: serde_json::Error) -> Self {
            Self::Other(Box::new(error))
        }
    }

    impl From<url::ParseError> for Error {
        fn from(error: url::ParseError) -> Self {
            Self::Other(Box::new(error))
        }
    }
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

    pub type RequestBuilder = reqwest::RequestBuilder;

    pub struct ClientWithMiddleware(reqwest::Client);

    impl ClientWithMiddleware {
        pub fn request<U: reqwest::IntoUrl>(
            &self,
            method: reqwest::Method,
            url: U,
        ) -> reqwest::RequestBuilder {
            self.0.request(method, url)
        }
    }

    pub fn append_path(base_url: &str, segments: &[&str]) -> Result<url::Url, Error> {
        let mut url = url::Url::parse(base_url)?;
        let mut path = url
            .path_segments_mut()
            .map_err(|()| Error::Config("base URL cannot accept path segments".to_string()))?;
        path.pop_if_empty();
        for &segment in segments {
            path.push(match segment {
                "." => "%2E",
                ".." => "%2E%2E",
                other => other,
            });
        }
        drop(path);
        Ok(url)
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
    ) -> Result<
        (
            reqwest::StatusCode,
            reqwest::header::HeaderMap,
            bytes::Bytes,
        ),
        Error,
    > {
        unimplemented!("compile-only runtime contract")
    }
}

pub mod middleware {
    use std::collections::HashMap;

    use crate::http::Middleware;

    pub enum HeaderPriority {
        Scoped,
    }

    pub struct SetRole {
        pub role: String,
        pub priority: HeaderPriority,
    }

    impl Middleware for SetRole {}

    pub struct SetHeaders {
        pub headers: HashMap<String, String>,
        pub priority: HeaderPriority,
    }

    impl Middleware for SetHeaders {}
}

pub mod generated;
