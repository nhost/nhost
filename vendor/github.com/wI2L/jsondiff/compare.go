package jsondiff

import "encoding/json"

// Compare compares the JSON representations of the
// given values and returns the differences relative
// to the former as a list of JSON Patch operations.
func Compare(source, target interface{}, opts ...Option) (Patch, error) {
	var d Differ
	d.applyOpts(opts...)

	return compare(&d, source, target)
}

// CompareJSON compares the given JSON documents and
// returns the differences relative to the former as
// a list of JSON Patch operations.
func CompareJSON(source, target []byte, opts ...Option) (Patch, error) {
	var d Differ
	d.applyOpts(opts...)

	return compareJSON(&d, source, target, d.opts.unmarshal)
}

func compare(d *Differ, src, tgt interface{}) (Patch, error) {
	if d.opts.marshal == nil {
		d.opts.marshal = json.Marshal
	}
	if d.opts.unmarshal == nil {
		d.opts.unmarshal = json.Unmarshal
	}
	si, _, err := marshalUnmarshal(src, d.opts)
	if err != nil {
		return nil, err
	}
	ti, tb, err := marshalUnmarshal(tgt, d.opts)
	if err != nil {
		return nil, err
	}
	d.targetBytes = tb
	d.compactInPlace = true

	d.Compare(si, ti)
	return d.patch, nil
}

func compareJSON(d *Differ, src, tgt []byte, unmarshal unmarshalFunc) (Patch, error) {
	if unmarshal == nil {
		unmarshal = json.Unmarshal
	}
	var si, ti interface{}
	if err := unmarshal(src, &si); err != nil {
		return nil, err
	}
	if err := unmarshal(tgt, &ti); err != nil {
		return nil, err
	}
	d.targetBytes = tgt
	d.compactInPlace = true

	d.Compare(si, ti)
	return d.patch, nil
}

// marshalUnmarshal returns the result of unmarshaling
// the JSON representation of the given interface value.
func marshalUnmarshal(v any, opts options) (interface{}, []byte, error) {
	b, err := opts.marshal(v)
	if err != nil {
		return nil, nil, err
	}
	var i interface{}
	if err := opts.unmarshal(b, &i); err != nil {
		return nil, nil, err
	}
	return i, b, nil
}
