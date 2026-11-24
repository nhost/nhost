// expect: no-raw-colors "hover:!bg-blue-500/30"
// expect: no-raw-colors "dark:!text-white"
// expect: no-raw-colors "border-red-600"
// expect: no-raw-colors "border-s-blue-500"
// expect: no-raw-colors "bg-black"
// expect: no-unknown-classes "divide-x-blue-500"
// expect: no-unknown-classes "bg-unlisted-brand"
// expect: no-unknown-classes "w-xl"
const classes = <div className="hover:!bg-blue-500/30 dark:!text-white dark:text-white! divide-x-blue-500 border-red-600 border-s-blue-500 bg-unlisted-brand bg-github bg-black bg-primary text-sm bg-transparent text-inherit fill-none fill-current bg-brown bg-[var(--brand)] w-xl" />;
// expect: no-raw-colors "bg-blue-500"
// expect: no-unknown-classes "text-unknown"
const conditional = cn({ 'bg-blue-500': enabled, 'text-unknown': enabled, 'bg-muted': enabled });
// expect: no-raw-colors "sm:!text-rose-500/50"
const colorClass = `sm:!text-rose-500/50 ${other}`;
// expect: no-raw-colors "bg-red-500"
const recipe = cva('bg-red-500');
// expect: no-raw-colors "fill=#f00"
// expect: no-raw-colors "stroke=red"
// expect: no-raw-colors "stopColor=rgb(255,0,0)"
// expect: no-raw-colors "floodColor=hsl(var(--unlisted))"
const svg = <svg fill="#f00" stroke="red"><stop stopColor="rgb(255,0,0)" floodColor="hsl(var(--unlisted))" /></svg>;
const good = <svg fill="currentColor" stroke="none"><stop stopColor="url(#gradient)" floodColor="var(--paint)" lightingColor="hsl(var(--primary))" /></svg>;
const dynamic = <svg fill={paint} />;
const component = <Icon color="red" />;
