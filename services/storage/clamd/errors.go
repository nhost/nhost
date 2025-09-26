package clamd

type VirusFoundError struct {
	Name string
}

func (e *VirusFoundError) Error() string {
	return "virus found: " + e.Name
}
