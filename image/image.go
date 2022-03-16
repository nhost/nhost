package image

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
)

const (
	radiusMultiplier = 2
)

type Options func(args []string) []string

func WithBlur(sigma int) Options {
	return func(args []string) []string {
		return append(args, "-blur", fmt.Sprintf("%dx%d", sigma*radiusMultiplier, sigma))
	}
}

func WithNewSize(x, y int) Options { // nolint: varnamelen
	return func(args []string) []string {
		return append(
			args,
			"-gravity", "Center",
			"-resize", fmt.Sprintf("%dx%d^", x, y),
			"-extent", fmt.Sprintf("%dx%d", x, y),
		)
	}
}

func WithQuality(q int) Options {
	return func(args []string) []string {
		return append(args, "-quality", fmt.Sprintf("%d", q))
	}
}

/*
Why shell out to imagemagick you may wonder. We evaluated following options:
1. Pure go (using the std lib)
2. govips (which leverages the C library vips)
3. shelling out to imagemagick

We noticed the following:

1. govips was faster but memory management wasn't ideal. It consumed 2x the amount of RAM than the
   pure go implementation and memory took forever to be freed
2. pure go was slower than govips but memory consumption was ok. Not great but not terrible. In
   addition, standard library support only a few formats and supporting extra formats would
   require a lot of effort
4. magicwand gave similar issues as govips
5. shelling out to imamagic gave similar results in terms of speed as pure go, however, as we
   are shellig out memory was consumed and immediately freed. In addition, imagemagick has ample
   support to many many formats and functionality so in the end this is a very quick and big gain.

In short, imagemagick was ok in terms of latency, great in terms of memory (as memory is freed
when the process dies) and you get a lot of functionality for free.
*/
func Manipulate(ctx context.Context, orig io.Reader, modified io.Writer, opts ...Options) error {
	args := make([]string, 0, len(opts)*2+1)
	args = append(args, "-")
	for _, o := range opts {
		args = o(args)
	}
	args = append(args, "-")

	cmd := exec.CommandContext(ctx, "magick", args...)
	cmd.Stdin = orig
	cmd.Stdout = modified
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("problem running imagemagick: %w", err)
	}

	return nil
}
