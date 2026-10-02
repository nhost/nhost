# gin-contrib/cors

[![Run Tests](https://github.com/gin-contrib/cors/actions/workflows/go.yml/badge.svg)](https://github.com/gin-contrib/cors/actions/workflows/go.yml)
[![codecov](https://codecov.io/gh/gin-contrib/cors/branch/master/graph/badge.svg)](https://codecov.io/gh/gin-contrib/cors)
[![Go Report Card](https://goreportcard.com/badge/github.com/gin-contrib/cors)](https://goreportcard.com/report/github.com/gin-contrib/cors)
[![GoDoc](https://godoc.org/github.com/gin-contrib/cors?status.svg)](https://godoc.org/github.com/gin-contrib/cors)

- [gin-contrib/cors](#gin-contribcors)
  - [Overview](#overview)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Advanced Usage](#advanced-usage)
    - [Custom Configuration](#custom-configuration)
    - [DefaultConfig Reference](#defaultconfig-reference)
    - [Default() Convenience](#default-convenience)
  - [Configuration Reference](#configuration-reference)
    - [Notes on Configuration](#notes-on-configuration)
    - [Examples](#examples)
      - [Advanced Options](#advanced-options)
      - [Custom Origin Validation](#custom-origin-validation)
      - [With Gin Context](#with-gin-context)
  - [Helper Methods](#helper-methods)
  - [Validation \& Error Handling](#validation--error-handling)
  - [Important Notes](#important-notes)

---

## Overview

**CORS (Cross-Origin Resource Sharing)** middleware for [Gin](https://github.com/gin-gonic/gin).

- Enables flexible CORS handling for your Gin-based APIs.
- Highly configurable: origins, methods, headers, credentials, and more.

---

## Installation

```sh
go get github.com/gin-contrib/cors
```

Import in your Go code:

```go
import "github.com/gin-contrib/cors"
```

---

## Quick Start

Allow all origins (default):

```go
import (
  "github.com/gin-contrib/cors"
  "github.com/gin-gonic/gin"
)

func main() {
  router := gin.Default()
  router.Use(cors.Default()) // All origins allowed by default
  router.Run()
}
```

> ⚠️ **Warning:** Allowing all origins disables cookies for clients. For credentialed requests, **do not** allow all origins.

---

## Advanced Usage

### Custom Configuration

Configure allowed origins, methods, headers, and more:

```go
import (
  "time"
  "github.com/gin-contrib/cors"
  "github.com/gin-gonic/gin"
)

func main() {
  router := gin.Default()
  router.Use(cors.New(cors.Config{
    AllowOrigins:     []string{"https://foo.com"},
    AllowMethods:     []string{"PUT", "PATCH"},
    AllowHeaders:     []string{"Origin"},
    ExposeHeaders:    []string{"Content-Length"},
    AllowCredentials: true,
    AllowOriginFunc: func(origin string) bool {
      return origin == "https://github.com"
    },
    MaxAge: 12 * time.Hour,
  }))
  router.Run()
}
```

---

### DefaultConfig Reference

Start with library defaults and customize as needed:

```go
import (
  "github.com/gin-contrib/cors"
  "github.com/gin-gonic/gin"
)

func main() {
  router := gin.Default()
  config := cors.DefaultConfig()
  config.AllowOrigins = []string{"http://google.com"}
  // config.AllowOrigins = []string{"http://google.com", "http://facebook.com"}
  // config.AllowAllOrigins = true

  router.Use(cors.New(config))
  router.Run()
}
```

> **Note:** `Default()` allows all origins, but `DefaultConfig()` does **not**. To allow all origins, set `AllowAllOrigins = true`.

---

### Default() Convenience

Enable all origins with a single call:

```go
router.Use(cors.Default()) // Equivalent to AllowAllOrigins = true
```

---

## Configuration Reference

The middleware is controlled via the `cors.Config` struct. All fields are optional unless otherwise stated.

| Field                         | Type                        | Default                                                   | Description                                                                                   |
|-------------------------------|-----------------------------|-----------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `AllowAllOrigins`             | `bool`                      | `false`                                                   | If true, allows all origins. Credentials **cannot** be used.                                  |
| `AllowOrigins`                | `[]string`                  | `[]`                                                      | List of allowed origins. Supports exact match, `*`, and wildcards.                            |
| `AllowOriginFunc`             | `func(string) bool`         | `nil`                                                     | Custom function to validate origin. If set, `AllowOrigins` is ignored.                        |
| `AllowOriginWithContextFunc`  | `func(*gin.Context,string)bool` | `nil`                                               | Like `AllowOriginFunc`, but with request context.                                             |
| `AllowMethods`                | `[]string`                  | `[]string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}` | Allowed HTTP methods.                                   |
| `AllowPrivateNetwork`         | `bool`                      | `false`                                                   | Adds [Private Network Access](https://wicg.github.io/private-network-access/) CORS header.    |
| `AllowHeaders`                | `[]string`                  | `[]`                                                      | List of non-simple headers permitted in requests.                                             |
| `AllowCredentials`            | `bool`                      | `false`                                                   | Allow cookies, HTTP auth, or client certs. Only if precise origins are used.                  |
| `ExposeHeaders`               | `[]string`                  | `[]`                                                      | Headers exposed to the browser.                                                               |
| `MaxAge`                      | `time.Duration`             | `12 * time.Hour`                                          | Cache time for preflight requests.                                                            |
| `AllowWildcard`               | `bool`                      | `false`                                                   | Enables wildcards in origins (e.g. `https://*.example.com`).                                  |
| `AllowBrowserExtensions`      | `bool`                      | `false`                                                   | Allow browser extension schemes as origins (e.g. `chrome-extension://`).                      |
| `CustomSchemas`               | `[]string`                  | `nil`                                                     | Additional allowed URI schemes (e.g. `tauri://`).                                             |
| `AllowWebSockets`             | `bool`                      | `false`                                                   | Allow `ws://` and `wss://` schemas.                                                           |
| `AllowFiles`                  | `bool`                      | `false`                                                   | Allow `file://` origins (dangerous; use only if necessary).                                   |
| `OptionsResponseStatusCode`   | `int`                       | `204`                                                     | Custom status code for `OPTIONS` responses.                                                   |

---

### Notes on Configuration

- Only one of `AllowAllOrigins`, `AllowOrigins`, `AllowOriginFunc`, or `AllowOriginWithContextFunc` should be set.
- If `AllowAllOrigins` is true, other origin settings are ignored and credentialed requests are not allowed.
- If `AllowWildcard` is enabled, only one `*` is allowed per origin string.
- Use `AllowBrowserExtensions`, `AllowWebSockets`, or `AllowFiles` to permit non-HTTP(s) protocols as origins.
- Custom schemas allow, for example, usage in desktop apps via custom URI schemes (`tauri://`, etc.).
- If both `AllowOriginFunc` and `AllowOriginWithContextFunc` are set, the context-specific function is preferred.

---

### Examples

#### Advanced Options

```go
config := cors.Config{
  AllowOrigins:           []string{"https://*.foo.com", "https://bar.com"},
  AllowWildcard:          true,
  AllowMethods:           []string{"GET", "POST"},
  AllowHeaders:           []string{"Authorization", "Content-Type"},
  AllowCredentials:       true,
  AllowBrowserExtensions: true,
  AllowWebSockets:        true,
  AllowFiles:             false,
  CustomSchemas:          []string{"tauri://"},
  MaxAge:                 24 * time.Hour,
  ExposeHeaders:          []string{"X-Custom-Header"},
  AllowPrivateNetwork:    true,
}
```

#### Custom Origin Validation

```go
config := cors.Config{
  AllowOriginFunc: func(origin string) bool {
    // Allow any github.com subdomain or a custom rule
    return strings.HasSuffix(origin, "github.com")
  },
}
```

#### With Gin Context

```go
config := cors.Config{
  AllowOriginWithContextFunc: func(c *gin.Context, origin string) bool {
    // Allow only if a certain header is present
    return c.Request.Header.Get("X-Allow-CORS") == "yes"
  },
}
```

---

## Helper Methods

Dynamically add methods or headers to the config:

```go
config.AddAllowMethods("DELETE", "OPTIONS")
config.AddAllowHeaders("X-My-Header")
config.AddExposeHeaders("X-Other-Header")
```

---

## Validation & Error Handling

- Calling `Validate()` on a `Config` checks for misconfiguration (called internally).
- If `AllowAllOrigins` is set, you cannot also set `AllowOrigins` or any `AllowOriginFunc`.
- If neither `AllowAllOrigins`, `AllowOriginFunc`, nor `AllowOrigins` is set, an error is raised.
- If an `AllowOrigin` contains a wildcard but `AllowWildcard` is not enabled, or more than one `*` is present, a panic is triggered.
- Invalid origin schemas or unsupported wildcards are rejected.

---

## Important Notes

- **Enabling all origins disables cookies:** When `AllowAllOrigins` is enabled, Gin cannot set cookies for clients. If you need credential sharing (cookies, authentication headers), **do not** allow all origins.
- For detailed documentation and configuration options, see the [GoDoc](https://godoc.org/github.com/gin-contrib/cors).
