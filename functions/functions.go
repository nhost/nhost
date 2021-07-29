package main

// rename this func to "serve"
func main() {

}

func contains(list []string, a string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}
