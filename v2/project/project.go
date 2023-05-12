package project

func ptr[T any](t T) *T {
	return &t
}
