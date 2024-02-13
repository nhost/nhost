package urn

type ParsingMode int

const (
	All ParsingMode = iota // Fallback mode
	RFC2141Only
	RFC7643Only
)

const DefaultParsingMode = RFC2141Only
