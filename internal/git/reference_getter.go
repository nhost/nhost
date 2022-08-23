package git

type ReferenceGetter interface {
	RefName() (string, error)
}
