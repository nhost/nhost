const merged = cn(
  // design-doctor-ignore class-probe: intentional utility
  'p-2', // expect: class-probe "p-2"
  [
    // design-doctor-ignore class-probe: external layout
    'm-2', // expect: class-probe "m-2"
  ],
  {
    // design-doctor-ignore class-probe: inherited background
    'bg-muted': active, // expect: class-probe "bg-muted"
  },
);
const variants = cva('flex', { // expect: class-probe "flex"
  compoundVariants: [
    {
      size: 'sm',
      // design-doctor-ignore class-probe: variant contract
      class: 'text-sm', // expect: class-probe "text-sm"
    },
  ],
});
