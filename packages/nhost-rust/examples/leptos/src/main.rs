//! A minimal client-side (WASM) Leptos app driving the Nhost SDK against the
//! example backend in `packages/nhost-rust/build/backend` (start it with
//! `./dev-env.sh up`). It demonstrates the SDK's `wasm` feature: email/password
//! sign-in, session display, sign-out, and a real GraphQL query against the
//! seeded `movies` table.
//!
//! The client is shared via `Rc` (single-threaded in the browser) and its
//! `!Send` futures are driven with `leptos::task::spawn_local`. The session is
//! persisted in `localStorage` automatically.

use leptos::prelude::*;
use leptos::task::spawn_local;
use nhost::auth::{SignInEmailPasswordRequest, SignOutRequest};
use nhost::{create_client, NhostClient, Options};
use serde::Deserialize;
use std::rc::Rc;

/// The `movies` table is seeded by the example backend's migration and exposed
/// to the `public` role, so this query works with or without a session.
const MOVIES_QUERY: &str = "query { \
    movies(order_by: {rating: desc}) { id title director release_year genre rating } \
}";

/// A row of the example backend's `movies` table.
#[derive(Debug, Clone, Deserialize)]
struct Movie {
    title: String,
    director: Option<String>,
    release_year: Option<i64>,
    genre: Option<String>,
    rating: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
struct MoviesData {
    movies: Vec<Movie>,
}

/// Builds a client pointed at the local example backend (`./dev-env.sh up`).
/// For a cloud project, set `subdomain` and `region` (or the per-service
/// `*_url`s) instead.
fn make_client() -> NhostClient {
    create_client(Options {
        subdomain: Some("local".to_string()),
        region: Some("local".to_string()),
        ..Default::default()
    })
}

/// Renders a human-readable label for the current session.
fn session_label(client: &NhostClient) -> String {
    match client.get_user_session() {
        Some(s) => match s.session.user.and_then(|u| u.email) {
            Some(email) => format!("Signed in as {email}"),
            None => "Signed in".to_string(),
        },
        None => "Not signed in".to_string(),
    }
}

/// Runs the movies query and pushes the result into the signals.
fn load_movies(
    client: Rc<NhostClient>,
    set_movies: WriteSignal<Vec<Movie>>,
    set_query_status: WriteSignal<String>,
) {
    set_query_status.set("Loading movies…".to_string());
    spawn_local(async move {
        match client
            .graphql
            .request(MOVIES_QUERY, None, None, None)
            .await
        {
            Ok(resp) => match resp
                .body
                .data
                .and_then(|d| serde_json::from_value::<MoviesData>(d).ok())
            {
                Some(data) => {
                    set_movies.set(data.movies);
                    set_query_status.set(String::new());
                }
                None => set_query_status.set("No data returned".to_string()),
            },
            Err(e) => set_query_status.set(format!("Query failed: {e}")),
        }
    });
}

#[component]
fn App() -> impl IntoView {
    let client = Rc::new(make_client());

    let (session, set_session) = signal(session_label(&client));
    let (email, set_email) = signal(String::new());
    let (password, set_password) = signal(String::new());
    let (status, set_status) = signal(String::new());
    let (movies, set_movies) = signal(Vec::<Movie>::new());
    let (query_status, set_query_status) = signal(String::new());

    // Load the seeded movies immediately (the public role can read them).
    load_movies(Rc::clone(&client), set_movies, set_query_status);

    let sign_in = {
        let client = Rc::clone(&client);
        move |ev: leptos::ev::SubmitEvent| {
            ev.prevent_default();
            let client = Rc::clone(&client);
            let email = email.get();
            let password = password.get();
            set_status.set("Signing in…".to_string());
            spawn_local(async move {
                match client
                    .auth
                    .sign_in_email_password(SignInEmailPasswordRequest { email, password }, None)
                    .await
                {
                    Ok(_) => {
                        set_session.set(session_label(&client));
                        set_status.set(String::new());
                    }
                    Err(e) => set_status.set(format!("Sign-in failed: {e}")),
                }
            });
        }
    };

    let sign_out = {
        let client = Rc::clone(&client);
        move |_| {
            let client = Rc::clone(&client);
            spawn_local(async move {
                let refresh_token = client.get_user_session().map(|s| s.session.refresh_token);
                let _ = client
                    .auth
                    .sign_out(
                        SignOutRequest {
                            refresh_token,
                            all: None,
                        },
                        None,
                    )
                    .await;
                client.clear_session();
                set_session.set(session_label(&client));
            });
        }
    };

    let reload_movies = {
        let client = Rc::clone(&client);
        move |_| load_movies(Rc::clone(&client), set_movies, set_query_status)
    };

    view! {
        <main>
            <h1>"Nhost + Leptos (client-side / WASM)"</h1>

            <section>
                <h2>"Session"</h2>
                <p>{move || session.get()}</p>
                <button on:click=sign_out>"Sign out"</button>
            </section>

            <section>
                <h2>"Sign in"</h2>
                <form on:submit=sign_in>
                    <input
                        type="email"
                        placeholder="email"
                        prop:value=move || email.get()
                        on:input=move |ev| set_email.set(event_target_value(&ev))
                    />
                    <input
                        type="password"
                        placeholder="password"
                        prop:value=move || password.get()
                        on:input=move |ev| set_password.set(event_target_value(&ev))
                    />
                    <button type="submit">"Sign in"</button>
                </form>
                <p>{move || status.get()}</p>
            </section>

            <section>
                <h2>"Movies (from the example backend)"</h2>
                <button on:click=reload_movies>"Reload"</button>
                <p>{move || query_status.get()}</p>
                <table>
                    <thead>
                        <tr>
                            <th>"Title"</th>
                            <th>"Director"</th>
                            <th>"Year"</th>
                            <th>"Genre"</th>
                            <th>"Rating"</th>
                        </tr>
                    </thead>
                    <tbody>
                        {move || {
                            movies
                                .get()
                                .into_iter()
                                .map(|m| {
                                    view! {
                                        <tr>
                                            <td>{m.title}</td>
                                            <td>{m.director.unwrap_or_default()}</td>
                                            <td>
                                                {m.release_year
                                                    .map(|y| y.to_string())
                                                    .unwrap_or_default()}
                                            </td>
                                            <td>{m.genre.unwrap_or_default()}</td>
                                            <td>
                                                {m.rating.map(|r| r.to_string()).unwrap_or_default()}
                                            </td>
                                        </tr>
                                    }
                                })
                                .collect::<Vec<_>>()
                        }}
                    </tbody>
                </table>
            </section>
        </main>
    }
}

fn main() {
    console_error_panic_hook::set_once();
    leptos::mount::mount_to_body(App);
}
