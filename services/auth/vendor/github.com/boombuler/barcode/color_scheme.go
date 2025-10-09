package barcode

import "image/color"

// ColorScheme defines a structure for color schemes used in barcode rendering.
// It includes the color model, background color, and foreground color.
type ColorScheme struct {
	Model      color.Model // Color model to be used (e.g., grayscale, RGB, RGBA)
	Background color.Color // Color of the background
	Foreground color.Color // Color of the foreground (e.g., bars in a barcode)
}

// ColorScheme8 represents a color scheme with 8-bit grayscale colors.
var ColorScheme8 = ColorScheme{
	Model:      color.GrayModel,
	Background: color.Gray{Y: 255},
	Foreground: color.Gray{Y: 0},
}

// ColorScheme16 represents a color scheme with 16-bit grayscale colors.
var ColorScheme16 = ColorScheme{
	Model:      color.Gray16Model,
	Background: color.White,
	Foreground: color.Black,
}

// ColorScheme24 represents a color scheme with 24-bit RGB colors.
var ColorScheme24 = ColorScheme{
	Model:      color.RGBAModel,
	Background: color.RGBA{255, 255, 255, 255},
	Foreground: color.RGBA{0, 0, 0, 255},
}

// ColorScheme32 represents a color scheme with 32-bit RGBA colors, which is similar to ColorScheme24 but typically includes alpha for transparency.
var ColorScheme32 = ColorScheme{
	Model:      color.RGBAModel,
	Background: color.RGBA{255, 255, 255, 255},
	Foreground: color.RGBA{0, 0, 0, 255},
}
