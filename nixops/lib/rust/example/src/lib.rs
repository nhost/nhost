//! Minimal crate exercising `nixops-lib.rust.check`.

/// Greets `name`.
#[must_use]
pub fn hello(name: &str) -> String {
    format!("Hello, {name}!")
}

#[cfg(test)]
mod tests {
    use super::hello;

    #[test]
    fn greets_by_name() {
        assert_eq!(hello("World"), "Hello, World!");
    }
}
