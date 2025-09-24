#/usr/bin/env bash

# using cookies (URL encoded session), test by extracting from browser dev tools
curl \
    -X POST \
    -b "nhostSession=%7B%22accessToken%22%3A%22eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTY3MzcwMzUsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIiwibWUiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiI1ZDA0Y2ZmMS0yMDZjLTQ4ZTgtODYzYy1iZWM3YzMyNGVjZTciLCJ4LWhhc3VyYS11c2VyLWlzLWFub255bW91cyI6ImZhbHNlIn0sImlhdCI6MTc1NjczNjk3MCwiaXNzIjoiaGFzdXJhLWF1dGgiLCJzdWIiOiI1ZDA0Y2ZmMS0yMDZjLTQ4ZTgtODYzYy1iZWM3YzMyNGVjZTcifQ.53LbshT0SRc9ur3zHh9vI4-1w18iE77RYrsK0eP2RYc%22%2C%22accessTokenExpiresIn%22%3A65%2C%22refreshToken%22%3A%22631a6313-cd97-4e41-8dc9-32ceeab67df1%22%2C%22refreshTokenId%22%3A%2265e7003a-1031-41ed-9df9-647f5c303455%22%2C%22user%22%3A%7B%22activeMfaType%22%3Anull%2C%22avatarUrl%22%3A%22https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F6246622%3Fv%3D4%22%2C%22createdAt%22%3A%222025-09-01T13%3A50%3A30.312877Z%22%2C%22defaultRole%22%3A%22user%22%2C%22displayName%22%3A%22David%20Barroso%22%2C%22email%22%3A%22dbarrosop%40dravetech.com%22%2C%22emailVerified%22%3Atrue%2C%22id%22%3A%225d04cff1-206c-48e8-863c-bec7c324ece7%22%2C%22isAnonymous%22%3Afalse%2C%22locale%22%3A%22en%22%2C%22metadata%22%3Anull%2C%22phoneNumberVerified%22%3Afalse%2C%22roles%22%3A%5B%22user%22%2C%22me%22%5D%7D%2C%22decodedToken%22%3A%7B%22exp%22%3A1756737035000%2C%22https%3A%2F%2Fhasura.io%2Fjwt%2Fclaims%22%3A%7B%22x-hasura-allowed-roles%22%3A%5B%22user%22%2C%22me%22%5D%2C%22x-hasura-default-role%22%3A%22user%22%2C%22x-hasura-user-id%22%3A%225d04cff1-206c-48e8-863c-bec7c324ece7%22%2C%22x-hasura-user-is-anonymous%22%3A%22false%22%7D%2C%22iat%22%3A1756736970000%2C%22iss%22%3A%22hasura-auth%22%2C%22sub%22%3A%225d04cff1-206c-48e8-863c-bec7c324ece7%22%7D%7D" \
    http://localhost:4000/cookies

# using Authorization header with the access token, test by extracting from browser dev tools
curl \
    -X POST \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTY3MzY3NDUsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIiwibWUiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiI1ZDA0Y2ZmMS0yMDZjLTQ4ZTgtODYzYy1iZWM3YzMyNGVjZTciLCJ4LWhhc3VyYS11c2VyLWlzLWFub255bW91cyI6ImZhbHNlIn0sImlhdCI6MTc1NjczNjY4MCwiaXNzIjoiaGFzdXJhLWF1dGgiLCJzdWIiOiI1ZDA0Y2ZmMS0yMDZjLTQ4ZTgtODYzYy1iZWM3YzMyNGVjZTcifQ.0vhBD7vZ0OYxFlpiTelt0mZw5NSYvO26EcWbD3Wk3_M" \
    http://localhost:4000/auth-header
