package urn

import (
	"fmt"

	scimschema "github.com/leodido/go-urn/scim/schema"
)

var (
	errPrefix              = "expecting the prefix to be the \"urn\" string (whatever case) [col %d]"
	errIdentifier          = "expecting the identifier to be string (1..31 alnum chars, also containing dashes but not at its beginning) [col %d]"
	errSpecificString      = "expecting the specific string to be a string containing alnum, hex, or others ([()+,-.:=@;$_!*']) chars [col %d]"
	errNoUrnWithinID       = "expecting the identifier to not contain the \"urn\" reserved string [col %d]"
	errHex                 = "expecting the specific string hex chars to be well-formed (%%alnum{2}) [col %d]"
	errParse               = "parsing error [col %d]"
	errSCIMNamespace       = "expecing the SCIM namespace identifier (ietf:params:scim) [col %d]"
	errSCIMType            = "expecting a correct SCIM type (schemas, api, param) [col %d]"
	errSCIMName            = "expecting one or more alnum char in the SCIM name part [col %d]"
	errSCIMOther           = "expecting a well-formed other SCIM part [col %d]"
	errSCIMOtherIncomplete = "expecting a not empty SCIM other part after colon [col %d]"
)

const start int = 1
const firstFinal int = 87

const enUrn int = 5
const enUrnOnly int = 44
const enScim int = 48
const enScimOnly int = 83
const enFail int = 95
const enMain int = 1

// Machine is the interface representing the FSM
type Machine interface {
	Error() error
	Parse(input []byte) (*URN, error)
	WithParsingMode(ParsingMode)
}

type machine struct {
	data           []byte
	cs             int
	p, pe, eof, pb int
	err            error
	tolower        []int
	parsingMode    ParsingMode
	parsingModeSet bool
}

// NewMachine creates a new FSM able to parse RFC 2141 strings.
func NewMachine(options ...Option) Machine {
	m := &machine{
		parsingModeSet: false,
	}

	for _, o := range options {
		o(m)
	}
	// Set default parsing mode
	if !m.parsingModeSet {
		m.WithParsingMode(DefaultParsingMode)
	}

	return m
}

// Err returns the error that occurred on the last call to Parse.
//
// If the result is nil, then the line was parsed successfully.
func (m *machine) Error() error {
	return m.err
}

func (m *machine) text() []byte {
	return m.data[m.pb:m.p]
}

// Parse parses the input byte array as a RFC 2141 or RFC7643 string.
func (m *machine) Parse(input []byte) (*URN, error) {
	m.data = input
	m.p = 0
	m.pb = 0
	m.pe = len(input)
	m.eof = len(input)
	m.err = nil
	m.tolower = []int{}
	output := &URN{}

	switch m.parsingMode {
	case RFC2141Only:
		m.cs = enUrnOnly
		break

	case RFC7643Only:
		m.cs = enScimOnly
		break

	case All:
		fallthrough
	default:
		{
			m.cs = start
		}
		break
	}
	{
		if (m.p) == (m.pe) {
			goto _testEof
		}
		switch m.cs {
		case 1:
			goto stCase1
		case 0:
			goto stCase0
		case 2:
			goto stCase2
		case 3:
			goto stCase3
		case 4:
			goto stCase4
		case 87:
			goto stCase87
		case 5:
			goto stCase5
		case 6:
			goto stCase6
		case 7:
			goto stCase7
		case 8:
			goto stCase8
		case 9:
			goto stCase9
		case 10:
			goto stCase10
		case 11:
			goto stCase11
		case 12:
			goto stCase12
		case 13:
			goto stCase13
		case 14:
			goto stCase14
		case 15:
			goto stCase15
		case 16:
			goto stCase16
		case 17:
			goto stCase17
		case 18:
			goto stCase18
		case 19:
			goto stCase19
		case 20:
			goto stCase20
		case 21:
			goto stCase21
		case 22:
			goto stCase22
		case 23:
			goto stCase23
		case 24:
			goto stCase24
		case 25:
			goto stCase25
		case 26:
			goto stCase26
		case 27:
			goto stCase27
		case 28:
			goto stCase28
		case 29:
			goto stCase29
		case 30:
			goto stCase30
		case 31:
			goto stCase31
		case 32:
			goto stCase32
		case 33:
			goto stCase33
		case 34:
			goto stCase34
		case 35:
			goto stCase35
		case 36:
			goto stCase36
		case 37:
			goto stCase37
		case 38:
			goto stCase38
		case 88:
			goto stCase88
		case 39:
			goto stCase39
		case 40:
			goto stCase40
		case 89:
			goto stCase89
		case 41:
			goto stCase41
		case 42:
			goto stCase42
		case 43:
			goto stCase43
		case 44:
			goto stCase44
		case 45:
			goto stCase45
		case 46:
			goto stCase46
		case 47:
			goto stCase47
		case 90:
			goto stCase90
		case 48:
			goto stCase48
		case 49:
			goto stCase49
		case 50:
			goto stCase50
		case 51:
			goto stCase51
		case 52:
			goto stCase52
		case 53:
			goto stCase53
		case 54:
			goto stCase54
		case 55:
			goto stCase55
		case 56:
			goto stCase56
		case 57:
			goto stCase57
		case 58:
			goto stCase58
		case 59:
			goto stCase59
		case 60:
			goto stCase60
		case 61:
			goto stCase61
		case 62:
			goto stCase62
		case 63:
			goto stCase63
		case 64:
			goto stCase64
		case 65:
			goto stCase65
		case 66:
			goto stCase66
		case 67:
			goto stCase67
		case 68:
			goto stCase68
		case 69:
			goto stCase69
		case 91:
			goto stCase91
		case 70:
			goto stCase70
		case 92:
			goto stCase92
		case 71:
			goto stCase71
		case 72:
			goto stCase72
		case 93:
			goto stCase93
		case 73:
			goto stCase73
		case 74:
			goto stCase74
		case 75:
			goto stCase75
		case 76:
			goto stCase76
		case 77:
			goto stCase77
		case 78:
			goto stCase78
		case 79:
			goto stCase79
		case 80:
			goto stCase80
		case 81:
			goto stCase81
		case 82:
			goto stCase82
		case 83:
			goto stCase83
		case 84:
			goto stCase84
		case 85:
			goto stCase85
		case 86:
			goto stCase86
		case 94:
			goto stCase94
		case 95:
			goto stCase95
		}
		goto stOut
	stCase1:
		switch (m.data)[(m.p)] {
		case 85:
			goto tr1
		case 117:
			goto tr1
		}
		goto tr0
	tr0:

		m.err = fmt.Errorf(errPrefix, m.p)
		(m.p)--

		{
			goto st95
		}

		m.err = fmt.Errorf(errParse, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr5:

		m.err = fmt.Errorf(errIdentifier, m.p)
		(m.p)--

		{
			goto st95
		}

		m.err = fmt.Errorf(errPrefix, m.p)
		(m.p)--

		{
			goto st95
		}

		m.err = fmt.Errorf(errParse, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr8:

		m.err = fmt.Errorf(errIdentifier, m.p)
		(m.p)--

		{
			goto st95
		}

		m.err = fmt.Errorf(errParse, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr41:

		m.err = fmt.Errorf(errSpecificString, m.p)
		(m.p)--

		{
			goto st95
		}

		m.err = fmt.Errorf(errParse, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr44:

		if m.parsingMode == RFC2141Only || m.parsingMode == All {
			m.err = fmt.Errorf(errHex, m.p)
			(m.p)--

			{
				goto st95
			}
		}
		// Otherwise, we expect the machine to fallback to SCIM errors

		m.err = fmt.Errorf(errSpecificString, m.p)
		(m.p)--

		{
			goto st95
		}

		m.err = fmt.Errorf(errParse, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr51:

		m.err = fmt.Errorf(errIdentifier, m.p)
		(m.p)--

		{
			goto st95
		}

		m.err = fmt.Errorf(errNoUrnWithinID, m.p)
		(m.p)--

		{
			goto st95
		}

		m.err = fmt.Errorf(errParse, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr52:

		m.err = fmt.Errorf(errPrefix, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr57:

		// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
		if m.parsingMode == All {
			// TODO: store why the machine fallback to the RFC2141 one?
			output.scim = nil
			// Rewind the cursor after the prefix ends ("urn:")
			(m.p) = (4) - 1

			// Go to the "urn" machine from this point on
			{
				goto st5
			}
		}
		m.err = fmt.Errorf(errSCIMNamespace, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr75:

		// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
		if m.parsingMode == All {
			// TODO: store why the machine fallback to the RFC2141 one?
			output.scim = nil
			// Rewind the cursor after the prefix ends ("urn:")
			(m.p) = (4) - 1

			// Go to the "urn" machine from this point on
			{
				goto st5
			}
		}
		m.err = fmt.Errorf(errSCIMType, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr82:

		// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
		if m.parsingMode == All {
			// TODO: store why the machine fallback to the RFC2141 one?
			output.scim = nil
			// Rewind the cursor after the prefix ends ("urn:")
			(m.p) = (4) - 1

			// Go to the "urn" machine from this point on
			{
				goto st5
			}
		}
		m.err = fmt.Errorf(errSCIMName, m.p)
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr84:

		// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
		if m.parsingMode == All {
			// TODO: store why the machine fallback to the RFC2141 one?
			output.scim = nil
			// Rewind the cursor after the prefix ends ("urn:")
			(m.p) = (4) - 1

			// Go to the "urn" machine from this point on
			{
				goto st5
			}
		}
		if m.p == m.pe {
			m.err = fmt.Errorf(errSCIMOtherIncomplete, m.p-1)
		} else {
			m.err = fmt.Errorf(errSCIMOther, m.p)
		}
		(m.p)--

		{
			goto st95
		}

		goto st0
	tr87:

		if m.parsingMode == RFC2141Only || m.parsingMode == All {
			m.err = fmt.Errorf(errHex, m.p)
			(m.p)--

			{
				goto st95
			}
		}
		// Otherwise, we expect the machine to fallback to SCIM errors

		// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
		if m.parsingMode == All {
			// TODO: store why the machine fallback to the RFC2141 one?
			output.scim = nil
			// Rewind the cursor after the prefix ends ("urn:")
			(m.p) = (4) - 1

			// Go to the "urn" machine from this point on
			{
				goto st5
			}
		}
		if m.p == m.pe {
			m.err = fmt.Errorf(errSCIMOtherIncomplete, m.p-1)
		} else {
			m.err = fmt.Errorf(errSCIMOther, m.p)
		}
		(m.p)--

		{
			goto st95
		}

		goto st0
	stCase0:
	st0:
		m.cs = 0
		goto _out
	tr1:

		m.pb = m.p

		// Throw an error when:
		// - we are entering here matching the the prefix in the namespace identifier part
		// - looking ahead (3 chars) we find a colon
		if pos := m.p + 3; pos < m.pe && m.data[pos] == 58 && output.prefix != "" {
			m.err = fmt.Errorf(errNoUrnWithinID, pos)
			(m.p)--

			{
				goto st95
			}
		}

		goto st2
	st2:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof2
		}
	stCase2:
		switch (m.data)[(m.p)] {
		case 82:
			goto st3
		case 114:
			goto st3
		}
		goto tr0
	st3:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof3
		}
	stCase3:
		switch (m.data)[(m.p)] {
		case 78:
			goto st4
		case 110:
			goto st4
		}
		goto tr0
	st4:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof4
		}
	stCase4:
		if (m.data)[(m.p)] == 58 {
			goto tr4
		}
		goto tr0
	tr4:

		output.prefix = string(m.text())
		{
			goto st48
		}
		goto st87
	st87:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof87
		}
	stCase87:
		goto tr0
	st5:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof5
		}
	stCase5:
		switch (m.data)[(m.p)] {
		case 85:
			goto tr7
		case 117:
			goto tr7
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto tr6
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto tr6
			}
		default:
			goto tr6
		}
		goto tr5
	tr6:

		m.pb = m.p

		goto st6
	st6:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof6
		}
	stCase6:
		switch (m.data)[(m.p)] {
		case 45:
			goto st7
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st7
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st7
			}
		default:
			goto st7
		}
		goto tr8
	st7:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof7
		}
	stCase7:
		switch (m.data)[(m.p)] {
		case 45:
			goto st8
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st8
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st8
			}
		default:
			goto st8
		}
		goto tr8
	st8:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof8
		}
	stCase8:
		switch (m.data)[(m.p)] {
		case 45:
			goto st9
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st9
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st9
			}
		default:
			goto st9
		}
		goto tr8
	st9:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof9
		}
	stCase9:
		switch (m.data)[(m.p)] {
		case 45:
			goto st10
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st10
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st10
			}
		default:
			goto st10
		}
		goto tr8
	st10:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof10
		}
	stCase10:
		switch (m.data)[(m.p)] {
		case 45:
			goto st11
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st11
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st11
			}
		default:
			goto st11
		}
		goto tr8
	st11:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof11
		}
	stCase11:
		switch (m.data)[(m.p)] {
		case 45:
			goto st12
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st12
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st12
			}
		default:
			goto st12
		}
		goto tr8
	st12:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof12
		}
	stCase12:
		switch (m.data)[(m.p)] {
		case 45:
			goto st13
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st13
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st13
			}
		default:
			goto st13
		}
		goto tr8
	st13:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof13
		}
	stCase13:
		switch (m.data)[(m.p)] {
		case 45:
			goto st14
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st14
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st14
			}
		default:
			goto st14
		}
		goto tr8
	st14:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof14
		}
	stCase14:
		switch (m.data)[(m.p)] {
		case 45:
			goto st15
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st15
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st15
			}
		default:
			goto st15
		}
		goto tr8
	st15:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof15
		}
	stCase15:
		switch (m.data)[(m.p)] {
		case 45:
			goto st16
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st16
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st16
			}
		default:
			goto st16
		}
		goto tr8
	st16:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof16
		}
	stCase16:
		switch (m.data)[(m.p)] {
		case 45:
			goto st17
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st17
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st17
			}
		default:
			goto st17
		}
		goto tr8
	st17:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof17
		}
	stCase17:
		switch (m.data)[(m.p)] {
		case 45:
			goto st18
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st18
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st18
			}
		default:
			goto st18
		}
		goto tr8
	st18:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof18
		}
	stCase18:
		switch (m.data)[(m.p)] {
		case 45:
			goto st19
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st19
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st19
			}
		default:
			goto st19
		}
		goto tr8
	st19:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof19
		}
	stCase19:
		switch (m.data)[(m.p)] {
		case 45:
			goto st20
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st20
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st20
			}
		default:
			goto st20
		}
		goto tr8
	st20:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof20
		}
	stCase20:
		switch (m.data)[(m.p)] {
		case 45:
			goto st21
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st21
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st21
			}
		default:
			goto st21
		}
		goto tr8
	st21:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof21
		}
	stCase21:
		switch (m.data)[(m.p)] {
		case 45:
			goto st22
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st22
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st22
			}
		default:
			goto st22
		}
		goto tr8
	st22:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof22
		}
	stCase22:
		switch (m.data)[(m.p)] {
		case 45:
			goto st23
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st23
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st23
			}
		default:
			goto st23
		}
		goto tr8
	st23:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof23
		}
	stCase23:
		switch (m.data)[(m.p)] {
		case 45:
			goto st24
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st24
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st24
			}
		default:
			goto st24
		}
		goto tr8
	st24:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof24
		}
	stCase24:
		switch (m.data)[(m.p)] {
		case 45:
			goto st25
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st25
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st25
			}
		default:
			goto st25
		}
		goto tr8
	st25:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof25
		}
	stCase25:
		switch (m.data)[(m.p)] {
		case 45:
			goto st26
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st26
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st26
			}
		default:
			goto st26
		}
		goto tr8
	st26:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof26
		}
	stCase26:
		switch (m.data)[(m.p)] {
		case 45:
			goto st27
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st27
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st27
			}
		default:
			goto st27
		}
		goto tr8
	st27:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof27
		}
	stCase27:
		switch (m.data)[(m.p)] {
		case 45:
			goto st28
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st28
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st28
			}
		default:
			goto st28
		}
		goto tr8
	st28:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof28
		}
	stCase28:
		switch (m.data)[(m.p)] {
		case 45:
			goto st29
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st29
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st29
			}
		default:
			goto st29
		}
		goto tr8
	st29:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof29
		}
	stCase29:
		switch (m.data)[(m.p)] {
		case 45:
			goto st30
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st30
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st30
			}
		default:
			goto st30
		}
		goto tr8
	st30:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof30
		}
	stCase30:
		switch (m.data)[(m.p)] {
		case 45:
			goto st31
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st31
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st31
			}
		default:
			goto st31
		}
		goto tr8
	st31:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof31
		}
	stCase31:
		switch (m.data)[(m.p)] {
		case 45:
			goto st32
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st32
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st32
			}
		default:
			goto st32
		}
		goto tr8
	st32:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof32
		}
	stCase32:
		switch (m.data)[(m.p)] {
		case 45:
			goto st33
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st33
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st33
			}
		default:
			goto st33
		}
		goto tr8
	st33:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof33
		}
	stCase33:
		switch (m.data)[(m.p)] {
		case 45:
			goto st34
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st34
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st34
			}
		default:
			goto st34
		}
		goto tr8
	st34:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof34
		}
	stCase34:
		switch (m.data)[(m.p)] {
		case 45:
			goto st35
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st35
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st35
			}
		default:
			goto st35
		}
		goto tr8
	st35:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof35
		}
	stCase35:
		switch (m.data)[(m.p)] {
		case 45:
			goto st36
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st36
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st36
			}
		default:
			goto st36
		}
		goto tr8
	st36:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof36
		}
	stCase36:
		switch (m.data)[(m.p)] {
		case 45:
			goto st37
		case 58:
			goto tr10
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st37
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st37
			}
		default:
			goto st37
		}
		goto tr8
	st37:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof37
		}
	stCase37:
		if (m.data)[(m.p)] == 58 {
			goto tr10
		}
		goto tr8
	tr10:

		output.ID = string(m.text())

		goto st38
	st38:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof38
		}
	stCase38:
		switch (m.data)[(m.p)] {
		case 33:
			goto tr42
		case 36:
			goto tr42
		case 37:
			goto tr43
		case 61:
			goto tr42
		case 95:
			goto tr42
		}
		switch {
		case (m.data)[(m.p)] < 48:
			if 39 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 46 {
				goto tr42
			}
		case (m.data)[(m.p)] > 59:
			switch {
			case (m.data)[(m.p)] > 90:
				if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
					goto tr42
				}
			case (m.data)[(m.p)] >= 64:
				goto tr42
			}
		default:
			goto tr42
		}
		goto tr41
	tr42:

		m.pb = m.p

		goto st88
	st88:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof88
		}
	stCase88:
		switch (m.data)[(m.p)] {
		case 33:
			goto st88
		case 36:
			goto st88
		case 37:
			goto st39
		case 61:
			goto st88
		case 95:
			goto st88
		}
		switch {
		case (m.data)[(m.p)] < 48:
			if 39 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 46 {
				goto st88
			}
		case (m.data)[(m.p)] > 59:
			switch {
			case (m.data)[(m.p)] > 90:
				if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
					goto st88
				}
			case (m.data)[(m.p)] >= 64:
				goto st88
			}
		default:
			goto st88
		}
		goto tr41
	tr43:

		m.pb = m.p

		goto st39
	st39:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof39
		}
	stCase39:
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st40
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st40
			}
		default:
			goto tr46
		}
		goto tr44
	tr46:

		m.tolower = append(m.tolower, m.p-m.pb)

		goto st40
	st40:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof40
		}
	stCase40:
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st89
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st89
			}
		default:
			goto tr48
		}
		goto tr44
	tr48:

		m.tolower = append(m.tolower, m.p-m.pb)

		goto st89
	st89:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof89
		}
	stCase89:
		switch (m.data)[(m.p)] {
		case 33:
			goto st88
		case 36:
			goto st88
		case 37:
			goto st39
		case 61:
			goto st88
		case 95:
			goto st88
		}
		switch {
		case (m.data)[(m.p)] < 48:
			if 39 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 46 {
				goto st88
			}
		case (m.data)[(m.p)] > 59:
			switch {
			case (m.data)[(m.p)] > 90:
				if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
					goto st88
				}
			case (m.data)[(m.p)] >= 64:
				goto st88
			}
		default:
			goto st88
		}
		goto tr44
	tr7:

		m.pb = m.p

		// Throw an error when:
		// - we are entering here matching the the prefix in the namespace identifier part
		// - looking ahead (3 chars) we find a colon
		if pos := m.p + 3; pos < m.pe && m.data[pos] == 58 && output.prefix != "" {
			m.err = fmt.Errorf(errNoUrnWithinID, pos)
			(m.p)--

			{
				goto st95
			}
		}

		goto st41
	st41:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof41
		}
	stCase41:
		switch (m.data)[(m.p)] {
		case 45:
			goto st7
		case 58:
			goto tr10
		case 82:
			goto st42
		case 114:
			goto st42
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st7
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st7
			}
		default:
			goto st7
		}
		goto tr5
	st42:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof42
		}
	stCase42:
		switch (m.data)[(m.p)] {
		case 45:
			goto st8
		case 58:
			goto tr10
		case 78:
			goto st43
		case 110:
			goto st43
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st8
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st8
			}
		default:
			goto st8
		}
		goto tr5
	st43:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof43
		}
	stCase43:
		if (m.data)[(m.p)] == 45 {
			goto st9
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st9
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st9
			}
		default:
			goto st9
		}
		goto tr51
	stCase44:
		switch (m.data)[(m.p)] {
		case 85:
			goto tr53
		case 117:
			goto tr53
		}
		goto tr52
	tr53:

		m.pb = m.p

		// Throw an error when:
		// - we are entering here matching the the prefix in the namespace identifier part
		// - looking ahead (3 chars) we find a colon
		if pos := m.p + 3; pos < m.pe && m.data[pos] == 58 && output.prefix != "" {
			m.err = fmt.Errorf(errNoUrnWithinID, pos)
			(m.p)--

			{
				goto st95
			}
		}

		goto st45
	st45:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof45
		}
	stCase45:
		switch (m.data)[(m.p)] {
		case 82:
			goto st46
		case 114:
			goto st46
		}
		goto tr52
	st46:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof46
		}
	stCase46:
		switch (m.data)[(m.p)] {
		case 78:
			goto st47
		case 110:
			goto st47
		}
		goto tr52
	st47:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof47
		}
	stCase47:
		if (m.data)[(m.p)] == 58 {
			goto tr56
		}
		goto tr52
	tr56:

		output.prefix = string(m.text())
		{
			goto st5
		}
		goto st90
	st90:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof90
		}
	stCase90:
		goto tr52
	st48:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof48
		}
	stCase48:
		if (m.data)[(m.p)] == 105 {
			goto tr58
		}
		goto tr57
	tr58:

		m.pb = m.p

		goto st49
	st49:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof49
		}
	stCase49:
		if (m.data)[(m.p)] == 101 {
			goto st50
		}
		goto tr57
	st50:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof50
		}
	stCase50:
		if (m.data)[(m.p)] == 116 {
			goto st51
		}
		goto tr57
	st51:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof51
		}
	stCase51:
		if (m.data)[(m.p)] == 102 {
			goto st52
		}
		goto tr57
	st52:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof52
		}
	stCase52:
		if (m.data)[(m.p)] == 58 {
			goto st53
		}
		goto tr57
	st53:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof53
		}
	stCase53:
		if (m.data)[(m.p)] == 112 {
			goto st54
		}
		goto tr57
	st54:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof54
		}
	stCase54:
		if (m.data)[(m.p)] == 97 {
			goto st55
		}
		goto tr57
	st55:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof55
		}
	stCase55:
		if (m.data)[(m.p)] == 114 {
			goto st56
		}
		goto tr57
	st56:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof56
		}
	stCase56:
		if (m.data)[(m.p)] == 97 {
			goto st57
		}
		goto tr57
	st57:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof57
		}
	stCase57:
		if (m.data)[(m.p)] == 109 {
			goto st58
		}
		goto tr57
	st58:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof58
		}
	stCase58:
		if (m.data)[(m.p)] == 115 {
			goto st59
		}
		goto tr57
	st59:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof59
		}
	stCase59:
		if (m.data)[(m.p)] == 58 {
			goto st60
		}
		goto tr57
	st60:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof60
		}
	stCase60:
		if (m.data)[(m.p)] == 115 {
			goto st61
		}
		goto tr57
	st61:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof61
		}
	stCase61:
		if (m.data)[(m.p)] == 99 {
			goto st62
		}
		goto tr57
	st62:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof62
		}
	stCase62:
		if (m.data)[(m.p)] == 105 {
			goto st63
		}
		goto tr57
	st63:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof63
		}
	stCase63:
		if (m.data)[(m.p)] == 109 {
			goto st64
		}
		goto tr57
	st64:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof64
		}
	stCase64:
		if (m.data)[(m.p)] == 58 {
			goto tr74
		}
		goto tr57
	tr74:

		output.ID = string(m.text())

		output.scim = &SCIM{}

		goto st65
	st65:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof65
		}
	stCase65:
		switch (m.data)[(m.p)] {
		case 97:
			goto tr76
		case 112:
			goto tr77
		case 115:
			goto tr78
		}
		goto tr75
	tr76:

		m.pb = m.p

		goto st66
	st66:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof66
		}
	stCase66:
		if (m.data)[(m.p)] == 112 {
			goto st67
		}
		goto tr75
	st67:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof67
		}
	stCase67:
		if (m.data)[(m.p)] == 105 {
			goto st68
		}
		goto tr75
	st68:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof68
		}
	stCase68:
		if (m.data)[(m.p)] == 58 {
			goto tr81
		}
		goto tr75
	tr81:

		output.scim.Type = scimschema.TypeFromString(string(m.text()))

		goto st69
	st69:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof69
		}
	stCase69:
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto tr83
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto tr83
			}
		default:
			goto tr83
		}
		goto tr82
	tr83:

		output.scim.pos = m.p

		goto st91
	st91:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof91
		}
	stCase91:
		if (m.data)[(m.p)] == 58 {
			goto tr107
		}
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st91
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st91
			}
		default:
			goto st91
		}
		goto tr82
	tr107:

		output.scim.Name = string(m.data[output.scim.pos:m.p])

		goto st70
	st70:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof70
		}
	stCase70:
		switch (m.data)[(m.p)] {
		case 33:
			goto tr85
		case 36:
			goto tr85
		case 37:
			goto tr86
		case 61:
			goto tr85
		case 95:
			goto tr85
		}
		switch {
		case (m.data)[(m.p)] < 48:
			if 39 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 46 {
				goto tr85
			}
		case (m.data)[(m.p)] > 59:
			switch {
			case (m.data)[(m.p)] > 90:
				if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
					goto tr85
				}
			case (m.data)[(m.p)] >= 64:
				goto tr85
			}
		default:
			goto tr85
		}
		goto tr84
	tr85:

		output.scim.pos = m.p

		goto st92
	st92:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof92
		}
	stCase92:
		switch (m.data)[(m.p)] {
		case 33:
			goto st92
		case 36:
			goto st92
		case 37:
			goto st71
		case 61:
			goto st92
		case 95:
			goto st92
		}
		switch {
		case (m.data)[(m.p)] < 48:
			if 39 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 46 {
				goto st92
			}
		case (m.data)[(m.p)] > 59:
			switch {
			case (m.data)[(m.p)] > 90:
				if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
					goto st92
				}
			case (m.data)[(m.p)] >= 64:
				goto st92
			}
		default:
			goto st92
		}
		goto tr84
	tr86:

		output.scim.pos = m.p

		goto st71
	st71:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof71
		}
	stCase71:
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st72
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st72
			}
		default:
			goto tr89
		}
		goto tr87
	tr89:

		m.tolower = append(m.tolower, m.p-m.pb)

		goto st72
	st72:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof72
		}
	stCase72:
		switch {
		case (m.data)[(m.p)] < 65:
			if 48 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 57 {
				goto st93
			}
		case (m.data)[(m.p)] > 90:
			if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
				goto st93
			}
		default:
			goto tr91
		}
		goto tr87
	tr91:

		m.tolower = append(m.tolower, m.p-m.pb)

		goto st93
	st93:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof93
		}
	stCase93:
		switch (m.data)[(m.p)] {
		case 33:
			goto st92
		case 36:
			goto st92
		case 37:
			goto st71
		case 61:
			goto st92
		case 95:
			goto st92
		}
		switch {
		case (m.data)[(m.p)] < 48:
			if 39 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 46 {
				goto st92
			}
		case (m.data)[(m.p)] > 59:
			switch {
			case (m.data)[(m.p)] > 90:
				if 97 <= (m.data)[(m.p)] && (m.data)[(m.p)] <= 122 {
					goto st92
				}
			case (m.data)[(m.p)] >= 64:
				goto st92
			}
		default:
			goto st92
		}
		goto tr87
	tr77:

		m.pb = m.p

		goto st73
	st73:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof73
		}
	stCase73:
		if (m.data)[(m.p)] == 97 {
			goto st74
		}
		goto tr75
	st74:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof74
		}
	stCase74:
		if (m.data)[(m.p)] == 114 {
			goto st75
		}
		goto tr75
	st75:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof75
		}
	stCase75:
		if (m.data)[(m.p)] == 97 {
			goto st76
		}
		goto tr75
	st76:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof76
		}
	stCase76:
		if (m.data)[(m.p)] == 109 {
			goto st68
		}
		goto tr75
	tr78:

		m.pb = m.p

		goto st77
	st77:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof77
		}
	stCase77:
		if (m.data)[(m.p)] == 99 {
			goto st78
		}
		goto tr75
	st78:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof78
		}
	stCase78:
		if (m.data)[(m.p)] == 104 {
			goto st79
		}
		goto tr75
	st79:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof79
		}
	stCase79:
		if (m.data)[(m.p)] == 101 {
			goto st80
		}
		goto tr75
	st80:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof80
		}
	stCase80:
		if (m.data)[(m.p)] == 109 {
			goto st81
		}
		goto tr75
	st81:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof81
		}
	stCase81:
		if (m.data)[(m.p)] == 97 {
			goto st82
		}
		goto tr75
	st82:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof82
		}
	stCase82:
		if (m.data)[(m.p)] == 115 {
			goto st68
		}
		goto tr75
	stCase83:
		switch (m.data)[(m.p)] {
		case 85:
			goto tr100
		case 117:
			goto tr100
		}
		goto tr52
	tr100:

		m.pb = m.p

		// Throw an error when:
		// - we are entering here matching the the prefix in the namespace identifier part
		// - looking ahead (3 chars) we find a colon
		if pos := m.p + 3; pos < m.pe && m.data[pos] == 58 && output.prefix != "" {
			m.err = fmt.Errorf(errNoUrnWithinID, pos)
			(m.p)--

			{
				goto st95
			}
		}

		goto st84
	st84:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof84
		}
	stCase84:
		switch (m.data)[(m.p)] {
		case 82:
			goto st85
		case 114:
			goto st85
		}
		goto tr52
	st85:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof85
		}
	stCase85:
		switch (m.data)[(m.p)] {
		case 78:
			goto st86
		case 110:
			goto st86
		}
		goto tr52
	st86:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof86
		}
	stCase86:
		if (m.data)[(m.p)] == 58 {
			goto tr103
		}
		goto tr52
	tr103:

		output.prefix = string(m.text())
		{
			goto st48
		}
		goto st94
	st94:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof94
		}
	stCase94:
		goto tr52
	st95:
		if (m.p)++; (m.p) == (m.pe) {
			goto _testEof95
		}
	stCase95:
		switch (m.data)[(m.p)] {
		case 10:
			goto st0
		case 13:
			goto st0
		}
		goto st95
	stOut:
	_testEof2:
		m.cs = 2
		goto _testEof
	_testEof3:
		m.cs = 3
		goto _testEof
	_testEof4:
		m.cs = 4
		goto _testEof
	_testEof87:
		m.cs = 87
		goto _testEof
	_testEof5:
		m.cs = 5
		goto _testEof
	_testEof6:
		m.cs = 6
		goto _testEof
	_testEof7:
		m.cs = 7
		goto _testEof
	_testEof8:
		m.cs = 8
		goto _testEof
	_testEof9:
		m.cs = 9
		goto _testEof
	_testEof10:
		m.cs = 10
		goto _testEof
	_testEof11:
		m.cs = 11
		goto _testEof
	_testEof12:
		m.cs = 12
		goto _testEof
	_testEof13:
		m.cs = 13
		goto _testEof
	_testEof14:
		m.cs = 14
		goto _testEof
	_testEof15:
		m.cs = 15
		goto _testEof
	_testEof16:
		m.cs = 16
		goto _testEof
	_testEof17:
		m.cs = 17
		goto _testEof
	_testEof18:
		m.cs = 18
		goto _testEof
	_testEof19:
		m.cs = 19
		goto _testEof
	_testEof20:
		m.cs = 20
		goto _testEof
	_testEof21:
		m.cs = 21
		goto _testEof
	_testEof22:
		m.cs = 22
		goto _testEof
	_testEof23:
		m.cs = 23
		goto _testEof
	_testEof24:
		m.cs = 24
		goto _testEof
	_testEof25:
		m.cs = 25
		goto _testEof
	_testEof26:
		m.cs = 26
		goto _testEof
	_testEof27:
		m.cs = 27
		goto _testEof
	_testEof28:
		m.cs = 28
		goto _testEof
	_testEof29:
		m.cs = 29
		goto _testEof
	_testEof30:
		m.cs = 30
		goto _testEof
	_testEof31:
		m.cs = 31
		goto _testEof
	_testEof32:
		m.cs = 32
		goto _testEof
	_testEof33:
		m.cs = 33
		goto _testEof
	_testEof34:
		m.cs = 34
		goto _testEof
	_testEof35:
		m.cs = 35
		goto _testEof
	_testEof36:
		m.cs = 36
		goto _testEof
	_testEof37:
		m.cs = 37
		goto _testEof
	_testEof38:
		m.cs = 38
		goto _testEof
	_testEof88:
		m.cs = 88
		goto _testEof
	_testEof39:
		m.cs = 39
		goto _testEof
	_testEof40:
		m.cs = 40
		goto _testEof
	_testEof89:
		m.cs = 89
		goto _testEof
	_testEof41:
		m.cs = 41
		goto _testEof
	_testEof42:
		m.cs = 42
		goto _testEof
	_testEof43:
		m.cs = 43
		goto _testEof
	_testEof45:
		m.cs = 45
		goto _testEof
	_testEof46:
		m.cs = 46
		goto _testEof
	_testEof47:
		m.cs = 47
		goto _testEof
	_testEof90:
		m.cs = 90
		goto _testEof
	_testEof48:
		m.cs = 48
		goto _testEof
	_testEof49:
		m.cs = 49
		goto _testEof
	_testEof50:
		m.cs = 50
		goto _testEof
	_testEof51:
		m.cs = 51
		goto _testEof
	_testEof52:
		m.cs = 52
		goto _testEof
	_testEof53:
		m.cs = 53
		goto _testEof
	_testEof54:
		m.cs = 54
		goto _testEof
	_testEof55:
		m.cs = 55
		goto _testEof
	_testEof56:
		m.cs = 56
		goto _testEof
	_testEof57:
		m.cs = 57
		goto _testEof
	_testEof58:
		m.cs = 58
		goto _testEof
	_testEof59:
		m.cs = 59
		goto _testEof
	_testEof60:
		m.cs = 60
		goto _testEof
	_testEof61:
		m.cs = 61
		goto _testEof
	_testEof62:
		m.cs = 62
		goto _testEof
	_testEof63:
		m.cs = 63
		goto _testEof
	_testEof64:
		m.cs = 64
		goto _testEof
	_testEof65:
		m.cs = 65
		goto _testEof
	_testEof66:
		m.cs = 66
		goto _testEof
	_testEof67:
		m.cs = 67
		goto _testEof
	_testEof68:
		m.cs = 68
		goto _testEof
	_testEof69:
		m.cs = 69
		goto _testEof
	_testEof91:
		m.cs = 91
		goto _testEof
	_testEof70:
		m.cs = 70
		goto _testEof
	_testEof92:
		m.cs = 92
		goto _testEof
	_testEof71:
		m.cs = 71
		goto _testEof
	_testEof72:
		m.cs = 72
		goto _testEof
	_testEof93:
		m.cs = 93
		goto _testEof
	_testEof73:
		m.cs = 73
		goto _testEof
	_testEof74:
		m.cs = 74
		goto _testEof
	_testEof75:
		m.cs = 75
		goto _testEof
	_testEof76:
		m.cs = 76
		goto _testEof
	_testEof77:
		m.cs = 77
		goto _testEof
	_testEof78:
		m.cs = 78
		goto _testEof
	_testEof79:
		m.cs = 79
		goto _testEof
	_testEof80:
		m.cs = 80
		goto _testEof
	_testEof81:
		m.cs = 81
		goto _testEof
	_testEof82:
		m.cs = 82
		goto _testEof
	_testEof84:
		m.cs = 84
		goto _testEof
	_testEof85:
		m.cs = 85
		goto _testEof
	_testEof86:
		m.cs = 86
		goto _testEof
	_testEof94:
		m.cs = 94
		goto _testEof
	_testEof95:
		m.cs = 95
		goto _testEof

	_testEof:
		{
		}
		if (m.p) == (m.eof) {
			switch m.cs {
			case 44, 45, 46, 47, 83, 84, 85, 86:

				m.err = fmt.Errorf(errPrefix, m.p)
				(m.p)--

				{
					goto st95
				}

			case 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64:

				// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
				if m.parsingMode == All {
					// TODO: store why the machine fallback to the RFC2141 one?
					output.scim = nil
					// Rewind the cursor after the prefix ends ("urn:")
					(m.p) = (4) - 1

					// Go to the "urn" machine from this point on
					{
						goto st5
					}
				}
				m.err = fmt.Errorf(errSCIMNamespace, m.p)
				(m.p)--

				{
					goto st95
				}

			case 65, 66, 67, 68, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82:

				// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
				if m.parsingMode == All {
					// TODO: store why the machine fallback to the RFC2141 one?
					output.scim = nil
					// Rewind the cursor after the prefix ends ("urn:")
					(m.p) = (4) - 1

					// Go to the "urn" machine from this point on
					{
						goto st5
					}
				}
				m.err = fmt.Errorf(errSCIMType, m.p)
				(m.p)--

				{
					goto st95
				}

			case 69:

				// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
				if m.parsingMode == All {
					// TODO: store why the machine fallback to the RFC2141 one?
					output.scim = nil
					// Rewind the cursor after the prefix ends ("urn:")
					(m.p) = (4) - 1

					// Go to the "urn" machine from this point on
					{
						goto st5
					}
				}
				m.err = fmt.Errorf(errSCIMName, m.p)
				(m.p)--

				{
					goto st95
				}

			case 70:

				// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
				if m.parsingMode == All {
					// TODO: store why the machine fallback to the RFC2141 one?
					output.scim = nil
					// Rewind the cursor after the prefix ends ("urn:")
					(m.p) = (4) - 1

					// Go to the "urn" machine from this point on
					{
						goto st5
					}
				}
				if m.p == m.pe {
					m.err = fmt.Errorf(errSCIMOtherIncomplete, m.p-1)
				} else {
					m.err = fmt.Errorf(errSCIMOther, m.p)
				}
				(m.p)--

				{
					goto st95
				}

			case 88, 89:

				raw := m.text()
				output.SS = string(raw)
				// Iterate upper letters lowering them
				for _, i := range m.tolower {
					raw[i] = raw[i] + 32
				}
				output.norm = string(raw)

				output.kind = RFC2141

			case 1, 2, 3, 4:

				m.err = fmt.Errorf(errPrefix, m.p)
				(m.p)--

				{
					goto st95
				}

				m.err = fmt.Errorf(errParse, m.p)
				(m.p)--

				{
					goto st95
				}

			case 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37:

				m.err = fmt.Errorf(errIdentifier, m.p)
				(m.p)--

				{
					goto st95
				}

				m.err = fmt.Errorf(errParse, m.p)
				(m.p)--

				{
					goto st95
				}

			case 38:

				m.err = fmt.Errorf(errSpecificString, m.p)
				(m.p)--

				{
					goto st95
				}

				m.err = fmt.Errorf(errParse, m.p)
				(m.p)--

				{
					goto st95
				}

			case 71, 72:

				if m.parsingMode == RFC2141Only || m.parsingMode == All {
					m.err = fmt.Errorf(errHex, m.p)
					(m.p)--

					{
						goto st95
					}
				}
				// Otherwise, we expect the machine to fallback to SCIM errors

				// In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
				if m.parsingMode == All {
					// TODO: store why the machine fallback to the RFC2141 one?
					output.scim = nil
					// Rewind the cursor after the prefix ends ("urn:")
					(m.p) = (4) - 1

					// Go to the "urn" machine from this point on
					{
						goto st5
					}
				}
				if m.p == m.pe {
					m.err = fmt.Errorf(errSCIMOtherIncomplete, m.p-1)
				} else {
					m.err = fmt.Errorf(errSCIMOther, m.p)
				}
				(m.p)--

				{
					goto st95
				}

			case 5, 41, 42:

				m.err = fmt.Errorf(errIdentifier, m.p)
				(m.p)--

				{
					goto st95
				}

				m.err = fmt.Errorf(errPrefix, m.p)
				(m.p)--

				{
					goto st95
				}

				m.err = fmt.Errorf(errParse, m.p)
				(m.p)--

				{
					goto st95
				}

			case 43:

				m.err = fmt.Errorf(errIdentifier, m.p)
				(m.p)--

				{
					goto st95
				}

				m.err = fmt.Errorf(errNoUrnWithinID, m.p)
				(m.p)--

				{
					goto st95
				}

				m.err = fmt.Errorf(errParse, m.p)
				(m.p)--

				{
					goto st95
				}

			case 39, 40:

				if m.parsingMode == RFC2141Only || m.parsingMode == All {
					m.err = fmt.Errorf(errHex, m.p)
					(m.p)--

					{
						goto st95
					}
				}
				// Otherwise, we expect the machine to fallback to SCIM errors

				m.err = fmt.Errorf(errSpecificString, m.p)
				(m.p)--

				{
					goto st95
				}

				m.err = fmt.Errorf(errParse, m.p)
				(m.p)--

				{
					goto st95
				}

			case 91:

				output.scim.Name = string(m.data[output.scim.pos:m.p])

				raw := m.text()
				output.SS = string(raw)
				// Iterate upper letters lowering them
				for _, i := range m.tolower {
					raw[i] = raw[i] + 32
				}
				output.norm = string(raw)

				output.kind = RFC7643

			case 92, 93:

				output.scim.Other = string(m.data[output.scim.pos:m.p])

				raw := m.text()
				output.SS = string(raw)
				// Iterate upper letters lowering them
				for _, i := range m.tolower {
					raw[i] = raw[i] + 32
				}
				output.norm = string(raw)

				output.kind = RFC7643
			}
		}

	_out:
		{
		}
	}

	if m.cs < firstFinal || m.cs == enFail {
		return nil, m.err
	}

	return output, nil
}

func (m *machine) WithParsingMode(x ParsingMode) {
	m.parsingMode = x
	m.parsingModeSet = true
}
