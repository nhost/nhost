// expect: class-probe "bg-primary"
// expect: class-probe "hover:!text-sm+"
const jsx = <div className="bg-primary hover:!text-sm+" />;
// expect: class-probe "p-2"
const other = <div iconClassName={'p-2'} />;
// expect: class-probe "flex"
// expect: class-probe "m-2"
// expect: class-probe "m-3"
// expect: class-probe "sm:[&:nth-child(2)]:bg-muted/30"
const template = <div className={`flex ${active ? 'm-2' : 'm-3'} sm:[&:nth-child(2)]:bg-muted/30`} />;
// expect: class-probe "px-2"
// expect: class-probe "py-2"
// expect: class-probe "bg-primary"
// expect: class-probe "rounded-lg"
const merged = cn('px-2', condition && 'py-2', { 'bg-primary': condition }, ['rounded-lg']);
// expect: class-probe "m-1"
// expect: class-probe "m-2"
// expect: class-probe "m-3"
// expect: class-probe "m-4"
// expect: class-probe "m-5"
const aliases = clsx('m-1', cx('m-2'), twMerge('m-3'), twJoin('m-4'), tw('m-5'));
// expect: class-probe "font-bold"
const variants = cva('font-bold', {
  variants: {
    // expect: class-probe "text-xs"
    // expect: class-probe "text-lg"
    // expect: class-probe "leading-6"
    size: { sm: 'text-xs', lg: ['text-lg', { 'leading-6': active }] },
    // expect: class-probe "text-muted"
    // expect: class-probe "opacity-70"
    tone: { quiet: `text-muted ${active ? 'opacity-70' : ''}` },
  },
  compoundVariants: [
    // expect: class-probe "bg-muted"
    { size: 'sm', tone: 'quiet', class: 'bg-muted' },
    // expect: class-probe "bg-primary"
    { size: 'lg', className: 'bg-primary' },
  ],
  defaultVariants: { size: 'sm' },
});
// expect: class-probe "p-2"
// expect: class-probe "text-xs"
const quotedOptions = cva('p-2', { variants: { size: { 'sm': 'text-xs' } } });
// expect: class-probe "block"
const objectVariant = cva('', { variants: { display: { 'shown': { 'block': active } } } });
// expect: class-probe "bg-[rgb(2 3 4)]"
// expect: class-probe "hover:content-['a b']"
const arbitrary = <div className="bg-[rgb(2 3 4)] hover:content-['a b']" />;
// expect: class-probe "bg-[unfinished value"
const invalidArbitrary = <div className="bg-[unfinished value" />;
// expect: class-probe "space-y-2"
const panelClasses = 'space-y-2';
// expect: class-probe "ring-2"
const options = { iconClass: 'ring-2', state: 'ignored' };
const ignoredComparison = value === 'bg-red-500';
const ignoredOtherCall = nonHelper('border-2');
const ignoredAttribute = <div className={nonHelper('border-red-500')} />;
const computed = { ['computedClassName']: 'fill-blue-500' };
const computedHelper = cn({ ['border-red-500']: active });
const notStyle = { other: 'stroke-red-500' };
// expect: class-probe "block"
// expect: class-probe "hidden"
const ignoredCondition = cn(value === 'outline-red-500' ? 'block' : 'hidden');
// expect: class-probe "p-6"
const ignoredNested = cn(nonHelper('text-red-500'), 'p-6');
// expect: class-probe "flex"
// expect: class-probe "bg-muted"
// expect: class-probe "hover:text-sm+"
// expect: class-probe "px-2"
const multiline = <div className={`flex	bg-muted
  hover:text-sm+  px-2`} />;
// expect: class-probe "block"
// expect: class-probe "m-2"
// expect: class-probe "p-4"
const chunks = <div className={`block ${state} m-2	p-4`} />;
// expect: class-probe "italic"
// expect: class-probe "hover:bg-muted"
const keys = cn({ italic: isUntracked, 'hover:bg-muted': active });
// expect: class-probe "underline"
// expect: class-probe "text-xs"
const nestedKeys = cva(cn({ underline: active }), { variants: { size: { small: 'text-xs' } } });
// expect: class-probe "p-2"
// expect: class-probe "bg-primary"
const mapped = items.map((i) => <div className={cn('p-2', i.on && 'bg-primary')} />);
// expect: class-probe "m-3"
// expect: class-probe "flex"
const mappedTemplate = items.map((i) => <div className={`m-3 ${i.on ? 'flex' : ''}`} />);
// expect: class-probe "rounded-lg"
const ref = forwardRef((p, r) => <div className={cn('rounded-lg')} ref={r} />);
// expect: class-probe "gap-2"
const memoized = useMemo(() => cn('gap-2'), []);
// expect: class-probe "w-["
// expect: class-probe "px]"
// expect: class-probe "h-2"
// expect: require-static-classes "w-[${…}px]"
const glued = <div className={`w-[${w}px] h-2`} />;
// expect: class-probe "bg-["
// expect: class-probe "]"
// expect: require-static-classes "bg-[${…}]"
const gluedKey = cn(`bg-[${c}]`);
