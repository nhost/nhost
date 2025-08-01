// Package utils contain some utilities which are needed to create barcodes
package utils

import (
	"image"
	"image/color"

	"github.com/boombuler/barcode"
)

type base1DCode struct {
	*BitList
	kind    string
	content string
	color   barcode.ColorScheme
}

type base1DCodeIntCS struct {
	base1DCode
	checksum int
}

func (c *base1DCode) Content() string {
	return c.content
}

func (c *base1DCode) Metadata() barcode.Metadata {
	return barcode.Metadata{c.kind, 1}
}

func (c *base1DCode) ColorModel() color.Model {
	return c.color.Model
}

func (c *base1DCode) ColorScheme() barcode.ColorScheme {
	return c.color
}

func (c *base1DCode) Bounds() image.Rectangle {
	return image.Rect(0, 0, c.Len(), 1)
}

func (c *base1DCode) At(x, y int) color.Color {
	if c.GetBit(x) {
		return c.color.Foreground
	}
	return c.color.Background
}

func (c *base1DCodeIntCS) CheckSum() int {
	return c.checksum
}

// New1DCodeIntCheckSum creates a new 1D barcode where the bars are represented by the bits in the bars BitList
func New1DCodeIntCheckSum(codeKind, content string, bars *BitList, checksum int) barcode.BarcodeIntCS {
	return &base1DCodeIntCS{base1DCode{bars, codeKind, content, barcode.ColorScheme16}, checksum}
}

// New1DCodeIntCheckSum creates a new 1D barcode where the bars are represented by the bits in the bars BitList
func New1DCodeIntCheckSumWithColor(codeKind, content string, bars *BitList, checksum int, color barcode.ColorScheme) barcode.BarcodeIntCS {
	return &base1DCodeIntCS{base1DCode{bars, codeKind, content, color}, checksum}
}

// New1DCode creates a new 1D barcode where the bars are represented by the bits in the bars BitList
func New1DCode(codeKind, content string, bars *BitList) barcode.Barcode {
	return &base1DCode{bars, codeKind, content, barcode.ColorScheme16}
}

// New1DCode creates a new 1D barcode where the bars are represented by the bits in the bars BitList
func New1DCodeWithColor(codeKind, content string, bars *BitList, color barcode.ColorScheme) barcode.Barcode {
	return &base1DCode{bars, codeKind, content, color}
}
