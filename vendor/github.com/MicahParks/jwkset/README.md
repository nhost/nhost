[![Go Reference](https://pkg.go.dev/badge/github.com/MicahParks/jwkset.svg)](https://pkg.go.dev/github.com/MicahParks/jwkset)

# JWK Set (JSON Web Key Set)

This is a JWK Set (JSON Web Key Set) implementation written in Golang.

The goal of this project is to provide a complete implementation of JWK and JWK Sets within the constraints of the
Golang standard library, without implementing any cryptographic algorithms. For example, `Ed25519` is supported, but
`Ed448` is not, because the Go standard library does not have a high level implementation of `Ed448`.

If you would like to generate or validate a JWK without writing any Golang code, please visit
the [Generate a JWK Set](#generate-a-jwk-set) section.

If you would like to have a JWK Set client to help verify JWTs without writing any Golang code, you can use the
[JWK Set Client Proxy (JCP) project](https://github.com/MicahParks/jcp) perform JWK Set client operations in the
language of your choice using an OpenAPI interface.

# Generate a JWK Set

If you would like to generate a JWK Set without writing Golang code, this project publishes utilities to generate a JWK
Set from:

* PEM encoded X.509 Certificates
* PEM encoded public keys
* PEM encoded private keys

The PEM block type is used to infer which key type to decode. Reference the [Supported keys](#supported-keys) section
for a list of supported cryptographic key types.

## Website

Visit [https://jwkset.com](https://jwkset.com) to use the web interface for this project. You can self-host this website
by following the instructions in the `README.md` in
the [website](https://github.com/MicahParks/jwkset/tree/master/website) directory.

## Command line

Gather your PEM encoded keys or certificates and use the `cmd/jwkset` command line tool to generate a JWK Set.

**Install**

```
go install github.com/MicahParks/jwkset/cmd/jwkset@latest
```

**Usage**

```
jwkset mykey.pem mycert.crt
```

## Custom server

This project can be used in creating a custom JWK Set server. A good place to start is `examples/http_server/main.go`.

# Golang JWK Set client

If you are using [`github.com/golang-jwt/jwt/v5`](https://github.com/golang-jwt/jwt) take a look
at [`github.com/MicahParks/keyfunc/v3`](https://github.com/MicahParks/keyfunc).

This project can be used to create JWK Set clients. An HTTP client is provided. See a snippet of the usage
from `examples/default_http_client/main.go` below.

## Create a JWK Set client from the server's HTTP URL.

```go
jwks, err := jwkset.NewDefaultHTTPClient([]string{server.URL})
if err != nil {
	log.Fatalf("Failed to create client JWK set. Error: %s", err)
}
```

## Read a key from the client.

```go
jwk, err = jwks.KeyRead(ctx, myKeyID)
if err != nil {
	log.Fatalf("Failed to read key from client JWK set. Error: %s", err)
}
```

# Supported keys

This project supports the following key types:

* [Edwards-curve Digital Signature Algorithm (EdDSA)](https://en.wikipedia.org/wiki/EdDSA) (Ed25519 only)
    * Go Types: `ed25519.PrivateKey` and `ed25519.PublicKey`
* [Elliptic-curve Diffie–Hellman (ECDH)](https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman) (X25519
  only)
    * Go Types: `*ecdh.PrivateKey` and `*ecdh.PublicKey`
* [Elliptic Curve Digital Signature Algorithm (ECDSA)](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm)
    * Go Types: `*ecdsa.PrivateKey` and `*ecdsa.PublicKey`
* [Rivest–Shamir–Adleman (RSA)](https://en.wikipedia.org/wiki/RSA_(cryptosystem))
    * Go Types: `*rsa.PrivateKey` and `*rsa.PublicKey`
* [HMAC](https://en.wikipedia.org/wiki/HMAC), [AES Key Wrap](https://en.wikipedia.org/wiki/Key_Wrap), and other
  symmetric keys
    * Go Type: `[]byte`

Cryptographic keys can be added, deleted, and read from the JWK Set. A JSON representation of the JWK Set can be created
for hosting via HTTPS. This project includes an in-memory storage implementation, but an interface is provided for more
advanced use cases.

# Notes

This project aims to implement the relevant RFCs to the fullest extent possible using the Go standard library, but does
not implement any cryptographic algorithms itself.

* RFC 8037 adds support for `Ed448`, `X448`, and `secp256k1`, but there is no Golang standard library support for these
  key types.
* In order to be compatible with non-RFC compliant JWK Set providers, this project does not strictly enforce JWK
  parameters that are integers and have extra or missing leading padding. See the release notes
  of [`v0.5.15`](https://github.com/MicahParks/jwkset/releases/tag/v0.5.15) for details.
* `Base64url Encoding` requires that all trailing `=` characters be removed. This project automatically strips any
  trailing `=` characters in an attempt to be compatible with improper implementations of JWK.
* This project does not currently support JWK Set encryption using JWE. This would involve implementing the relevant JWE
  specifications. It may be implemented in the future if there is interest. Open a GitHub issue to express interest.

# Related projects

## [`github.com/MicahParks/keyfunc`](https://github.com/MicahParks/keyfunc)

A JWK Set client for the [`github.com/golang-jwt/jwt/v5`](https://github.com/golang-jwt/jwt) project.
