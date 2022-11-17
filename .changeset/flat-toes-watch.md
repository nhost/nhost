---
'hasura-auth': minor
---

Allow patterns in allowed urls

`AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS` now accepts wildcard and other [micromatch patterns](https://github.com/micromatch/micromatch#matching-features) in `AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS`.

To match `https://(random-subdomain).vercel.app`:

```
AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS=https://*.vercel.app
```

As a result:

```sh
# Correct
https://bob.vercel.app
https://anything.vercel.app

# Incorrect
https://sub.bob.vercel.app
http://bob.vercel.app
https://vercel.app

```

It is possible to use other patterns, for instance:

- to allow both http and https:

```
AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS=http?(s)://website.com
```

- to allow any port:

```
AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS=http://website.com?(:{1..65536})
```
