/**
 * The grip and hover line of a playground divider. Put it inside an element
 * with `playground-divider` and `playground-divider-x` (between panes) or
 * `playground-divider-y` (on top of a bar). Styles are in globals.css.
 */
export default function DividerGrip() {
  return (
    <>
      <span aria-hidden="true" className="playground-divider-line" />
      <span aria-hidden="true" className="playground-divider-grip" />
    </>
  );
}
