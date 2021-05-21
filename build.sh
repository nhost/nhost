go get github.com/labstack/echo
go build -o bin/artifact main.go
GOOS=linux GOARCH=amd64 go build -o bin/artifact -ldflags="-s -w"
