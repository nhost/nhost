// expect: no-unknown-classes "flex-cols"
// expect: no-unknown-classes "rounded-huge"
// expect: no-unknown-classes "text-md"
// expect: no-unknown-classes "w-xl"
// expect: no-unknown-classes "bg-brand"
// expect: no-raw-colors "text-white"
const bad = <div className="flex-cols rounded-huge text-md w-xl bg-brand text-white" />;
const alsoBad = cn('w-[320px] max-w-[444px] fake-[10px]'); // expect: no-unknown-classes "fake-[10px]"
const safe = <div className="!text-sm bg-muted/30 bg-muted/[0.3] -mt-2 group-hover/cell:opacity-100 xs+:flex-row prose [mask-type:alpha]" />;
const trailing = <div className="text-sm!" />; // expect: no-unknown-classes "text-sm!"
const css = <div className="loading-toast group/cell peer/item nodrag nopan not-prose rct-dark group-node" />;
// expect: no-unknown-classes "hovr:flex"
// expect: no-unknown-classes "focus-vsible:ring-2"
// expect: no-unknown-classes "hovr:bg-primary"
// expect: no-unknown-classes "hovr:bg-blue-500"
// expect: no-raw-colors "hovr:bg-blue-500"
// expect: no-unknown-classes "hovr:bg-[#333]"
// expect: no-arbitrary-values "hovr:bg-[#333]"
const variants = <div className="hovr:flex focus-vsible:ring-2 hovr:bg-primary hovr:bg-blue-500 hovr:bg-[#333] aria-selected:text-primary data-[state=open]:flex [&:hover]:flex hover:flex-cols group-hover/cell:opacity-100 xs+:flex-row dark:md:hover:flex sm:max-md:flex hover:[mask-type:alpha] [&_[cmdk-group]]:px-2" />;
// expect: no-unknown-classes "md:hovr:flex"
// expect: no-unknown-classes "dark:focus-vsible:ring-2"
// expect: no-unknown-classes "group-hover:hovr:flex"
// expect: no-unknown-classes "data-[state=open]:hovr:flex"
// expect: no-unknown-classes "peer-checked:hovr:flex"
// expect: no-unknown-classes "aria-selected:focus-vsible:ring-2"
const stackedVariants = <div className="md:hovr:flex dark:focus-vsible:ring-2 group-hover:hovr:flex data-[state=open]:hovr:flex peer-checked:hovr:flex aria-selected:focus-vsible:ring-2" />;
// expect: require-static-classes "bg-${…}"
// expect: require-static-classes "w-[${…}"
// expect: require-static-classes "${…}px]"
// expect: require-static-classes "text-${…}"
// expect: require-static-classes "${…}xl"
// expect: require-static-classes "bg-${…}"
// expect: require-static-classes "${…}-500"
// expect: require-static-classes "w-${…}"
// expect: require-static-classes "${…}/12"
// expect: require-static-classes "${…}-cols"
const glued = <div className={`bg-${color} w-[${width}px] text-${size}xl bg-${color}-500 w-${width}/12 ${value}-cols`} />;
const spacedAfter = cn(`flex-cols ${value}`); // expect: no-unknown-classes "flex-cols"
const spacedBefore = cn(`fake-[10px] ${value}`); // expect: no-unknown-classes "fake-[10px]"
const plainTemplate = cn(`flex-cols`); // expect: no-unknown-classes "flex-cols"
const spacedFollowing = cn(`${value} fake-[10px]`); // expect: no-unknown-classes "fake-[10px]"
const spacedPreceding = cn(`flex-cols ${value} flex`); // expect: no-unknown-classes "flex-cols"
const layout = <div className="w-[320px] max-w-[444px] bg-[var(--brand)]" />;
const spaced = <div className="bg-[rgb(2 3 4)]" />;
const looseClass = 'flex-cols';
const props = { itemClassName: 'rounded-huge' };
