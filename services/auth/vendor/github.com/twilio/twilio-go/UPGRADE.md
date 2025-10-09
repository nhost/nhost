# Upgrade Guide

_All `MAJOR` version bumps will have upgrade notes posted here._

[2022-10-05] 0.26.x to 1.x.x
-----------------------------
### NEW FEATURE - Added Support for Twiml Building
The twilio-go library now supports building Twiml elements for applications.
#### Send a message and redirect with twiml programmable messaging
```go
package main

import (
	"fmt"
	"github.com/twilio/twilio-go/twiml"
)

func main() {
	//Create Verbs
	message := &twiml.MessagingMessage{
		To: "+15017122661",
		From: "+15558675310",
		OptionalAttributes: map[string]string{"community": "user"},
	}
	redirect := &twiml.MessagingRedirect{
		Url: "https://demo.twilio.com/welcome/sms",
	}

	//Create Noun
	body := &twiml.MessagingBody{
		Message: "Hello World!",
	}
	
	//Adding Body element to the Message Verb
	message.InnerElements = []twiml.Element{body}

	//Adding all Verbs to twiml.Messages
	verbList := []twiml.Element{message, redirect}
	twimlResult, err := twiml.Messages(verbList)
	if err == nil {
		fmt.Println(twimlResult)
	} else {
		fmt.Println(err)
	}
}

```
This will output XML that looks like this:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message to="+15017122661" from="+15558675310" community="user">
        <Body>Hello World!</Body>
    </Message>
    <Redirect>https://demo.twilio.com/welcome/sms</Redirect>
</Response>
```
The following example shows `Gather` with a nested `Say`. This will read some text to the caller, and allows the caller to enter input at any time while that text is read to them.
```go
package main

import (
	"fmt"
	"github.com/twilio/twilio-go/twiml"
)

func main() {
	//Create Verbs
	gather := &twiml.VoiceGather{
		Input:     "speech dtmf",
		Timeout:   "2",
		NumDigits: "1",
	}
	say := &twiml.VoiceSay{
		Message: "Please press 1 or say sales for sales.",
	}
	
	//Adding Say element to Gather
	gather.InnerElements = []twiml.Element{say}
	
	//Adding all Verbs to twiml.Voice
	verbList := []twiml.Element{gather}
	twimlResult, err := twiml.Voice(verbList)
	if err == nil {
		fmt.Println(twimlResult)
	} else {
		fmt.Println(err)
	}
}
```
This will output XML that looks like this:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech dtmf" timeout="2" numDigits="1">
        <Say>Please press 1 or say sales for sales.</Say>
    </Gather>
</Response>
```
### NEW VERSION - Added support for version 1.19 of Go
### FIXED - Fixed request validator key sorting logic and added support for validating x-www-form-urlencoded requests.
The twilio-go library now supports validating x-www-form-urlencoded requests and has fixed the key sorting logic for validating requests.
Checkout the [PR](https://github.com/twilio/twilio-go/pull/173) for more details.

[2022-05-18] 0.25.x to 0.26.x
-----------------------------
### CHANGED - Renamed ApiV2010 to Api.
ApiV2010 has now been renamed to Api. This has caused a breaking change for all endpoints located under `rest/api/2010`.

#### Send a SMS
```go
//0.2.x 
client := twilio.NewRestClient()

params := &api.CreateMessageParams{}
params.SetFrom("+15017122661")
params.SetBody("body")
params.SetTo("+15558675310")

resp, err := client.ApiV2010.CreateMessage(params)
```
```go
//1.x.xrc
client := twilio.NewRestClient()

params := &api.CreateMessageParams{}
params.SetFrom("+15017122661")
params.SetBody("body")
params.SetTo("+15558675310")

resp, err := client.Api.CreateMessage(params)
```
