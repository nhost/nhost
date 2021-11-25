# Tests

## init

1. Check whether all required directories (funcs + web) have been created with correct permissions or not.
2. required files created (.gitignore, .env.development)

## dev

1. all required containers are created or not
2. health-checks are cleared
3. seeds are getting applied
4. migrations and metadata is getting applied
5. all required environment variables are available correctly
6. workflow based tests: [TODO]
7. git ops tests: [TODO]
8. cleanup tests:
    1. containers are getting deleted
    2. all HTTP servers launched during runtime are shutting down properly (funcs + reverse proxy)