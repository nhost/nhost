# OpenSSL 3.0.10 1 Aug 2023 (Library: OpenSSL 3.0.10 1 Aug 2023)
openssl req -newkey EC -pkeyopt ec_paramgen_curve:P-521 -noenc -keyout ec521.pem -x509 -out ec521.crt -subj "/C=US/ST=Virginia/L=Richmond/O=Micah Parks/OU=Self/CN=example.com"
openssl req -newkey ED25519 -noenc -keyout ed25519.pem -x509 -out ed25519.crt -subj "/C=US/ST=Virginia/L=Richmond/O=Micah Parks/OU=Self/CN=example.com"
openssl req -newkey RSA:4096 -noenc -keyout rsa4096.pem -x509 -out rsa4096.crt -subj "/C=US/ST=Virginia/L=Richmond/O=Micah Parks/OU=Self/CN=example.com"

openssl pkey -in ec521.pem -pubout -out ec521pub.pem
openssl pkey -in ed25519.pem -pubout -out ed25519pub.pem
openssl pkey -in rsa4096.pem -pubout -out rsa4096pub.pem

# For the "RSA PRIVATE KEY" (PKCS#1) and "EC PRIVATE KEY" (SEC1) formats, the PEM files are generated using the
# cmd/gen_pkcs1 and cmd/gen_ec Golang programs, respectively.

openssl dsaparam -out dsaparam.pem 2048
openssl gendsa -out dsa.pem dsaparam.pem
openssl dsa -in dsa.pem -pubout -out dsa_pub.pem
