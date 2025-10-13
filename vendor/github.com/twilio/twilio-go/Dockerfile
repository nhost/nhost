FROM golang:1.19

RUN mkdir /twilio
WORKDIR /twilio

COPY client ./client
COPY rest ./rest
COPY twilio.go .
COPY twilio_test.go .

# Fetch dependencies
COPY go.mod .
COPY go.sum .
RUN go mod download
