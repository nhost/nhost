package client

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Takes a limit on the max number of records to read and a max pageSize and calculates the max number of pages to read.
func ReadLimits(pageSize *int, limit *int) int {
	//don't care about pageSize
	if pageSize == nil {
		if limit == nil {
			//don't care about the limit either
			return 50 //default
		}
		//return the most efficient pageSize
		return min(*limit, 1000)
	} else {
		if limit == nil {
			//we care about the pageSize but not the limit
			return *pageSize
		}
		return min(*pageSize, *limit)
	}
}

func GetNext(baseUrl string, response interface{}, getNextPage func(nextPageUri string) (interface{}, error)) (interface{}, error) {
	nextPageUrl, err := getNextPageUrl(baseUrl, response)
	if err != nil {
		return nil, err
	}

	return getNextPage(nextPageUrl)
}

func toMap(s interface{}) (map[string]interface{}, error) {
	var payload map[string]interface{}
	data, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, &payload)
	if err != nil {
		return nil, err
	}

	return payload, err
}

func getNextPageUrl(baseUrl string, response interface{}) (string, error) {
	payload, err := toMap(response)
	if err != nil {
		return "", err
	}

	if payload != nil && payload["meta"] != nil && payload["meta"].(map[string]interface{})["next_page_url"] != nil {
		return payload["meta"].(map[string]interface{})["next_page_url"].(string), nil
	}

	if payload != nil && payload["next_page_uri"] != nil {
		// remove any leading and trailing '/'
		return fmt.Sprintf("%s/%s", strings.Trim(baseUrl, "/"), strings.Trim(payload["next_page_uri"].(string), "/")), nil
	}

	return "", nil
}

func min(a int, b int) int {
	if a > b {
		return b
	}
	return a
}
