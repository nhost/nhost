package util

import (
	"fmt"
	"math/rand"
	"net"
	"runtime"
	"strconv"
	"time"
)

//
//	Returns preferred local address value
//	for accessing resources throughout docker containers,
//	depending on the Operating System.
//
//	For Mac and Windows, the address value is "host.docker.internal".
//	And for Linux, we are using the Outbound IP of host machine.
//
func GetLocalhost() string {
	switch runtime.GOOS {
	case "darwin", "windows":
		return "host.docker.internal"
	default:
		return fmt.Sprint(getOutboundIP())
	}
}

//  Get preferred outbound IP of host machine
func getOutboundIP() net.IP {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return nil
	}
	defer conn.Close()

	localAddr := conn.LocalAddr().(*net.UDPAddr)

	return localAddr.IP
}

func GetPort(low, hi int) int {

	//
	//  Initialize the seed
	//
	//  This is done to prevent Go from choosing pseudo-random numbers
	rand.Seed(time.Now().UnixNano())

	//  generate a random port value
	port := strconv.Itoa(low + rand.Intn(hi-low))

	//  validate whether the port is available
	if !PortAvailable(port) {
		return GetPort(low, hi)
	}

	//  return the value, if it's available
	response, _ := strconv.Atoi(port)
	return response
}

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
