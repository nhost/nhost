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

%%{
machine urn;

# unsigned alphabet
alphtype uint8;

action mark {
    m.pb = m.p
}

action tolower {
    m.tolower = append(m.tolower, m.p - m.pb)
}

action set_pre {
    output.prefix = string(m.text())
}

action throw_pre_urn_err {
    // Throw an error when:
    // - we are entering here matching the the prefix in the namespace identifier part
    // - looking ahead (3 chars) we find a colon
    if pos := m.p + 3; pos < m.pe && m.data[pos] == 58 && output.prefix != "" {
        m.err = fmt.Errorf(errNoUrnWithinID, pos)
        fhold;
        fgoto fail;
    }
}

action set_nid {
    output.ID = string(m.text())
}

action set_nss {
    raw := m.text()
    output.SS = string(raw)
    // Iterate upper letters lowering them
    for _, i := range m.tolower {
        raw[i] = raw[i] + 32
    }
    output.norm = string(raw)
}

action err_pre {
    m.err = fmt.Errorf(errPrefix, m.p)
    fhold;
    fgoto fail;
}

action err_nid {
    m.err = fmt.Errorf(errIdentifier, m.p)
    fhold;
    fgoto fail;
}

action err_nss {
    m.err = fmt.Errorf(errSpecificString, m.p)
    fhold;
    fgoto fail;
}

action err_urn {
    m.err = fmt.Errorf(errNoUrnWithinID, m.p)
    fhold;
    fgoto fail;
}

action err_hex {
    if m.parsingMode == RFC2141Only || m.parsingMode == All {
        m.err = fmt.Errorf(errHex, m.p)
        fhold;
        fgoto fail;
    }
    // Otherwise, we expect the machine to fallback to SCIM errors
}

action err_parse {
    m.err = fmt.Errorf(errParse, m.p)
    fhold;
    fgoto fail;
}

action base_type {
    output.kind = RFC2141;
}

action err_scim_nid {
    // In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
    if m.parsingMode == All {
        // TODO: store why the machine fallback to the RFC2141 one?
        output.scim = nil;
        // Rewind the cursor after the prefix ends ("urn:")
        fexec 4;
        // Go to the "urn" machine from this point on
        fgoto urn;
    }
    m.err = fmt.Errorf(errSCIMNamespace, m.p)
    fhold;
    fgoto fail;
}

action err_scim_type {
    // In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
    if m.parsingMode == All {
        // TODO: store why the machine fallback to the RFC2141 one?
        output.scim = nil;
        // Rewind the cursor after the prefix ends ("urn:")
        fexec 4;
        // Go to the "urn" machine from this point on
        fgoto urn;
    }
    m.err = fmt.Errorf(errSCIMType, m.p)
    fhold;
    fgoto fail;
}

action err_scim_name {
    // In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
    if m.parsingMode == All {
        // TODO: store why the machine fallback to the RFC2141 one?
        output.scim = nil;
        // Rewind the cursor after the prefix ends ("urn:")
        fexec 4;
        // Go to the "urn" machine from this point on
        fgoto urn;
    }
    m.err = fmt.Errorf(errSCIMName, m.p)
    fhold;
    fgoto fail;
}

action err_scim_other {
    // In case we are in fallback mode we are now gonna jump to normal RFC2141 URN parsing
    if m.parsingMode == All {
        // TODO: store why the machine fallback to the RFC2141 one?
        output.scim = nil;
        // Rewind the cursor after the prefix ends ("urn:")
        fexec 4;
        // Go to the "urn" machine from this point on
        fgoto urn;
    }
    if m.p == m.pe {
        m.err = fmt.Errorf(errSCIMOtherIncomplete, m.p-1)
    } else {
        m.err = fmt.Errorf(errSCIMOther, m.p)
    }
    fhold;
    fgoto fail;
}

action scim_type {
    output.kind = RFC7643;
}

action create_scim {
    output.scim = &SCIM{};
}

action set_scim_type {
    output.scim.Type = scimschema.TypeFromString(string(m.text()))
}

action mark_scim_name {
    output.scim.pos = m.p
}

action set_scim_name {
    output.scim.Name = string(m.data[output.scim.pos:m.p])
}

action mark_scim_other {
    output.scim.pos = m.p
}

action set_scim_other {
    output.scim.Other = string(m.data[output.scim.pos:m.p])
}

pre = ([uU] @err(err_pre) [rR] @err(err_pre) [nN] @err(err_pre)) >mark >throw_pre_urn_err %set_pre ;

nid = (alnum >mark (alnum | '-'){0,31}) $err(err_nid) %set_nid;

hex = '%' (digit | lower | upper >tolower){2} $err(err_hex);

sss = (alnum | [()+,\-.:=@;$_!*']);

nss = (sss | hex)+ $err(err_nss);

nid_not_urn = (nid - pre %err(err_urn));

urn := (nid_not_urn ':' nss >mark %set_nss) $err(err_parse) %eof(base_type);

urn_only := pre ':' $err(err_pre) @{ fgoto urn; };

### SCIM BEG

scim_nid = 'ietf:params:scim' >mark %set_nid %create_scim $err(err_scim_nid);

scim_other = ':' (sss | hex)+ >mark_scim_other %set_scim_other $err(err_scim_other);

scim_name = (alnum)+ >mark_scim_name %set_scim_name $err(err_scim_name);

scim_type = ('schemas' | 'api' | 'param') >mark %set_scim_type $err(err_scim_type);

scim := (scim_nid ':' scim_type ':' scim_name scim_other? %set_nss) %eof(scim_type);

scim_only := pre ':' $err(err_pre) @{ fgoto scim; };

### SCIM END

fail := (any - [\n\r])* @err{ fgoto main; };

main := (pre ':' $err(err_pre) @{ fgoto scim; }) $err(err_parse);

}%%

%% write data noerror noprefix;

// Machine is the interface representing the FSM
type Machine interface {
    Error() error
    Parse(input []byte) (*URN, error)
    WithParsingMode(ParsingMode)
}

type machine struct {
    data              []byte
    cs                int
    p, pe, eof, pb    int
    err               error
    tolower           []int
    parsingMode       ParsingMode
    parsingModeSet    bool
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

    %% access m.;
    %% variable p m.p;
    %% variable pe m.pe;
    %% variable eof m.eof;
    %% variable data m.data;

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
            m.cs = en_urn_only
            break

        case RFC7643Only:
            m.cs = en_scim_only
            break

        case All:
            fallthrough
        default:
            %% write init;
            break
    }
    %% write exec;

    if m.cs < first_final || m.cs == en_fail {
        return nil, m.err
    }

    return output, nil
}

func (m *machine) WithParsingMode(x ParsingMode) {
    m.parsingMode = x
    m.parsingModeSet = true
}