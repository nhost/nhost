package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

//	The first exported "Handler" function will be attached to the router.
//	Multiple Handler functions are not allowed.
//	Handler funcs with any other name than "Handler" are also not allowed
//	"Handler" func should be exported, it cannot be "handler".

type Body struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	body, _ := ioutil.ReadAll(r.Body)
	var payload Body
	json.Unmarshal(body, &payload)
	fmt.Fprintf(w, "Nhost pays it's respects to %s, %s!", payload.LastName, payload.FirstName)
}

