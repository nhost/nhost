// Package error provides the interface for Twilio specific errors.
package client

import (
	"encoding/json"
	"fmt"
)

// TwilioRestError provides information about an unsuccessful request.
type TwilioRestError struct {
	Code     int                    `json:"code"`
	Details  map[string]interface{} `json:"details"`
	Message  string                 `json:"message"`
	MoreInfo string                 `json:"more_info"`
	Status   int                    `json:"status"`
}

func (err *TwilioRestError) Error() string {
	detailsJSON, _ := json.Marshal(err.Details)
	return fmt.Sprintf("Status: %d - ApiError %d: %s (%s) More info: %s",
		err.Status, err.Code, err.Message, detailsJSON, err.MoreInfo)
}
