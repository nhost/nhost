# resp=$(curl \
#     -H "Content-Type: application/json" \
#     -X POST -d '{"email":"asd@asd.com", "password":"asd123"}' \
#     http://localhost:4000/signup/email-password)

# echo $resp


# resp=$(curl \
#     -H "Content-Type: application/json" \
#     -X POST -d '{"mail":"asd@asd.com", "password":"asd123"}' \
#     http://localhost:4000/signup/email-password)

# echo $resp

# wrong params
resp=$(curl \
    -H "Content-Type: application/json" \
    -X POST -d '{"email":"asdasd.com", "password":"asd123"}' \
     http://localhost:4000/signup/email-password)

echo $resp


# # wrong security
# resp=$(curl \
#     -H "Content-Type: application/json" \
#     -X POST -d '{"mail":"asd@asd.com", "password":"asd123"}' \
#     http://localhost:4000/pat)

# echo $resp
