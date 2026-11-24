// expect: no-reinvented-components "button"
<button type="button">Run</button>;
// expect: no-reinvented-components "button"
<button />;
// expect: no-reinvented-components "input[type=checkbox]"
<input type="checkbox" />;
// expect: no-reinvented-components "input[type=radio]"
<input type={'radio'} />;
// expect: no-reinvented-components "input"
<input type="text" />;
// expect: no-reinvented-components "input"
<input />;
<input type="file" />;
<input type="hidden" />;
<input type="range" />;
<input type={'file'} />;
<input type={kind} />;
<input type={kind ? 'checkbox' : 'radio'} />;
// expect: no-reinvented-components "input"
<input type={'email'} />;
// expect: no-reinvented-components "textarea"
<textarea />;
// expect: no-reinvented-components "select"
<select><option>A</option></select>;
// expect: no-reinvented-components "table"
<table />;
// expect: no-reinvented-components "a"
<a href="/">Link</a>;
<Slot asChild><button>Run</button></Slot>;
<Slot asChild={true}><a href="/">Link</a></Slot>;
<Slot asChild><button /></Slot>;
<Slot asChild>{ready ? <button /> : <button />}</Slot>;
<Slot asChild>{ready || <button />}</Slot>;
<Slot asChild>{() => <button />}</Slot>; // expect: no-reinvented-components "button"
<Slot asChild>{render(<button />)}</Slot>; // expect: no-reinvented-components "button"
<Slot asChild={false}><button /></Slot>; // expect: no-reinvented-components "button"
<Slot asChild={false}>
  {/* expect: no-reinvented-components "button" */}
  <button>Run</button>
</Slot>;
<Slot asChild>{ready ? <button>Run</button> : <a href="/">Link</a>}</Slot>;
<Slot asChild>{ready && <button>Run</button>}</Slot>;
<Slot asChild><div><button>Run</button></div></Slot>; // expect: no-reinvented-components "button"
<Tooltip content={<Trigger asChild />}><button /></Tooltip>; // expect: no-reinvented-components "button"
<Slot asChild render={<X asChild={false} />}><button /></Slot>;
<Slot asChild><><button /></></Slot>; // expect: no-reinvented-components "button"
<Slot asChild={false}>
  {ready && <a href="/">Link</a>} {/* expect: no-reinvented-components "a" */}
</Slot>;
const Button = () => <button />; // expect: no-reinvented-components "button"
const Custom = () => <CustomButton />;
