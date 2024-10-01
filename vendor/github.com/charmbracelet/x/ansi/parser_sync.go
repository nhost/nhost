package ansi

import (
	"sync"

	"github.com/charmbracelet/x/ansi/parser"
)

var parserPool = sync.Pool{
	New: func() any {
		return NewParser(parser.MaxParamsSize, 1024*4) // 4MB data buffer
	},
}

// GetParser returns a parser from a sync pool.
func GetParser() *Parser {
	return parserPool.Get().(*Parser)
}

// PutParser returns a parser to a sync pool. The parser is reset
// automatically.
func PutParser(p *Parser) {
	p.Reset()
	p.DataLen = 0
	parserPool.Put(p)
}
