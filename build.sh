go build -o bin/nhost main.go
GOOS=linux GOARCH=amd64 go build -o bin/nhost -ldflags="-s -w"
GOOS=linux GOARCH=386 go build -o bin/nhost -ldflags="-s -w"
GOOS=linux GOARCH=arm64 go build -o bin/nhost -ldflags="-s -w"
