# Dockerfile to create a go-getter container with smbclient dependency that is used by the get_smb.go tests
FROM golang:1.19.13

COPY . /go-getter
WORKDIR /go-getter

RUN go mod download
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq install smbclient
