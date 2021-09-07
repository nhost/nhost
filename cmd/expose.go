/*
Copyright © 2021 NAME HERE <EMAIL ADDRESS>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package cmd

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"path/filepath"

	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
	"golang.org/x/crypto/ssh"
)

// ssh -f -N -T -R 3000:localhost:3000 root@128.199.25.110 -i ./id_rsa

type Endpoint struct {
	Host string
	Port int
}

// local service to be forwarded
var localEndpoint = Endpoint{
	Host: "localhost",
	Port: 8080,
}

// remote SSH server
var serverEndpoint = Endpoint{
	Host: "128.199.25.110",
	Port: 22,
}

// remote forwarding port (on remote SSH server network)
var remoteEndpoint = Endpoint{
	Host: "localhost",
	Port: 8080,
}

// whoamiCmd represents the whoami command
var exposeCmd = &cobra.Command{
	Use:     "expose",
	Aliases: []string{"ex"},
	Hidden:  true,
	Short:   "Expose your local dev environment to the outside world",
	Long: `Spawns a reverse access tunnel to let you expose
services running on your localhost to the public internet,
for both, testing and show-off.`,
	Run: func(cmd *cobra.Command, args []string) {

		/*
			savePrivateFileTo := "./id_rsa_test"
			savePublicFileTo := "./id_rsa_test.pub"
			bitSize := 4096

			privateKey, err := generatePrivateKey(bitSize)
			if err != nil {
				log.Fatal(err.Error())
			}

			publicKeyBytes, err := generatePublicKey(&privateKey.PublicKey)
			if err != nil {
				log.Fatal(err.Error())
			}

			privateKeyBytes := encodePrivateKeyToPEM(privateKey)

			err = writeKeyToFile(privateKeyBytes, savePrivateFileTo)
			if err != nil {
				log.Fatal(err.Error())
			}

			err = writeKeyToFile([]byte(publicKeyBytes), savePublicFileTo)
			if err != nil {
				log.Fatal(err.Error())
			}
		*/

		// refer to https://godoc.org/golang.org/x/crypto/ssh for other authentication types
		sshConfig := &ssh.ClientConfig{
			// SSH connection username
			User: "root",
			Auth: []ssh.AuthMethod{
				// put here your private key path
				publicKeyFile(filepath.Join(nhost.WORKING_DIR, "id_rsa")),
			},
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		}

		// Connect to SSH remote server using serverEndpoint
		serverConn, err := ssh.Dial("tcp", serverEndpoint.String(), sshConfig)
		if err != nil {
			log.Fatalln(fmt.Printf("Dial INTO remote server error: %s", err))
		}

		// Listen on remote server port
		listener, err := serverConn.Listen("tcp", remoteEndpoint.String())
		if err != nil {
			log.Fatalln(fmt.Printf("Listen open port ON remote server error: %s", err))
		}
		defer listener.Close()

		// handle incoming connections on reverse forwarded tunnel
		for {
			// Open a (local) connection to localEndpoint whose content will be forwarded so serverEndpoint
			local, err := net.Dial("tcp", localEndpoint.String())
			if err != nil {
				log.Fatalln(fmt.Printf("Dial INTO local service error: %s", err))
			}

			fmt.Println("done")

			client, err := listener.Accept()
			if err != nil {
				log.Fatalln(err)
			}

			handleClient(client, local)
		}

	},
}

func (endpoint *Endpoint) String() string {
	return fmt.Sprintf("%s:%d", endpoint.Host, endpoint.Port)
}

// From https://sosedoff.com/2015/05/25/ssh-port-forwarding-with-go.html
// Handle local client connections and tunnel data to the remote server
// Will use io.Copy - http://golang.org/pkg/io/#Copy
func handleClient(client net.Conn, remote net.Conn) {
	defer client.Close()
	chDone := make(chan bool)

	// Start remote -> local data transfer
	go func() {
		_, err := io.Copy(client, remote)
		if err != nil {
			log.Println(fmt.Sprintf("error while copy remote->local: %s", err))
		}
		chDone <- true
	}()

	// Start local -> remote data transfer
	go func() {
		_, err := io.Copy(remote, client)
		if err != nil {
			log.Println(fmt.Sprintf("error while copy local->remote: %s", err))
		}
		chDone <- true
	}()

	<-chDone
}

func publicKeyFile(file string) ssh.AuthMethod {
	buffer, err := ioutil.ReadFile(file)
	if err != nil {
		log.Debug(err)
		log.Fatalln(fmt.Sprintf("Cannot read SSH public key file %s", file))
		return nil
	}

	key, err := ssh.ParsePrivateKey(buffer)
	if err != nil {
		log.Fatalln(fmt.Sprintf("Cannot parse SSH public key file %s", file))
		return nil
	}
	return ssh.PublicKeys(key)
}

// generatePrivateKey creates a RSA Private Key of specified byte size
func generatePrivateKey(bitSize int) (*rsa.PrivateKey, error) {
	// Private Key generation
	privateKey, err := rsa.GenerateKey(rand.Reader, bitSize)
	if err != nil {
		return nil, err
	}

	// Validate Private Key
	err = privateKey.Validate()
	if err != nil {
		return nil, err
	}

	log.Println("Private Key generated")
	return privateKey, nil
}

// encodePrivateKeyToPEM encodes Private Key from RSA to PEM format
func encodePrivateKeyToPEM(privateKey *rsa.PrivateKey) []byte {
	// Get ASN.1 DER format
	privDER := x509.MarshalPKCS1PrivateKey(privateKey)

	// pem.Block
	privBlock := pem.Block{
		Type:    "RSA PRIVATE KEY",
		Headers: nil,
		Bytes:   privDER,
	}

	// Private key in PEM format
	privatePEM := pem.EncodeToMemory(&privBlock)

	return privatePEM
}

// generatePublicKey take a rsa.PublicKey and return bytes suitable for writing to .pub file
// returns in the format "ssh-rsa ..."
func generatePublicKey(privatekey *rsa.PublicKey) ([]byte, error) {
	publicRsaKey, err := ssh.NewPublicKey(privatekey)
	if err != nil {
		return nil, err
	}

	pubKeyBytes := ssh.MarshalAuthorizedKey(publicRsaKey)

	log.Println("Public key generated")
	return pubKeyBytes, nil
}

// writePemToFile writes keys to a file
func writeKeyToFile(keyBytes []byte, saveFileTo string) error {
	err := ioutil.WriteFile(saveFileTo, keyBytes, 0600)
	if err != nil {
		return err
	}

	log.Printf("Key saved to: %s", saveFileTo)
	return nil
}

func init() {
	rootCmd.AddCommand(exposeCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// whoamiCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// whoamiCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
