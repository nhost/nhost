package subscription

func assignAlignedVars(
	varArrays map[string][]any,
	vars map[string]any,
	subscriberIndex int,
	subscriberCount int,
) {
	for varName, varValue := range vars {
		arr, exists := varArrays[varName]
		if !exists {
			arr = make([]any, subscriberCount)
			varArrays[varName] = arr
		}

		arr[subscriberIndex] = varValue
	}
}
