package util

import (
	"net"
)

func PortAvailable(port string) bool {
	conn, err := net.Dial("tcp", "localhost:"+port)

	defer func() {
		if conn != nil {
			conn.Close()
		}
	}()

	if err != nil {
		return true
	}

	return false
}
