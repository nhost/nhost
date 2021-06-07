version=v1.0.0
go build -o nhost -v -ldflags="-X cmd.BuildVersion=$version"
