package vips

// #include <vips/vips.h>
import "C"

// ImageComposite image to composite param
type ImageComposite struct {
	Image     *ImageRef
	BlendMode BlendMode
	X, Y      int
}

func toVipsCompositeStructs(r *ImageRef, datas []*ImageComposite) ([]*C.VipsImage, []C.int, []C.int, []C.int) {
	ins := []*C.VipsImage{r.image}
	modes := []C.int{}
	xs := []C.int{}
	ys := []C.int{}

	for _, image := range datas {
		ins = append(ins, image.Image.image)
		modes = append(modes, C.int(image.BlendMode))
		xs = append(xs, C.int(image.X))
		ys = append(ys, C.int(image.Y))
	}

	return ins, modes, xs, ys
}
