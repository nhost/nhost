import { cn } from '@/lib/utils';

export const ArbitraryValues = () => (
  <div>
    <span className="text-[12px]" /> {/* expect: no-arbitrary-values "text-[12px]" */}
    <span className="rounded-[8px]" /> {/* expect: no-arbitrary-values "rounded-[8px]" */}
    <span className="p-[13px]" /> {/* expect: no-arbitrary-values "p-[13px]" */}
    <span className="w-[320px] bg-[var(--brand)] bg-[--brand] [color:hsl(var(--primary))] ring-[rgb(var(--schema-color))] [var(--x)] [mask-type:alpha] [text-align:center] [border-collapse:collapse]" />
    <span className="bg-[#333]" /> {/* expect: no-arbitrary-values "bg-[#333]" */}
    <span className="bg-[rgb(1_2_3)]" /> {/* expect: no-arbitrary-values "bg-[rgb(1_2_3)]" */}
    <span className="[padding:13px]" /> {/* expect: no-arbitrary-values "[padding:13px]" */}
    <span className="[color:#333]" /> {/* expect: no-arbitrary-values "[color:#333]" */}
    <span className="[&>svg]:w-[320px] hover:!text-[12px]" /> {/* expect: no-arbitrary-values "hover:!text-[12px]" */}
    {cn('border-[color:#333]', 'text-[color:var(--brand)]', 'w-[320px]')} {/* expect: no-arbitrary-values "border-[color:#333]" */}
  </div>
);
