package model

type Secrets []*ConfigEnvironmentVariable

func (ce Secrets) Clone() Secrets {
	clone := make(Secrets, len(ce))
	for i, v := range ce {
		clone[i] = v.Clone()
	}

	return clone
}
