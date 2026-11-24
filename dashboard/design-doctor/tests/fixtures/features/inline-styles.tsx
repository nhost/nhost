import type { CSSProperties } from 'react';

// expect: no-inline-styles "color"
// expect: no-inline-styles "marginTop"
const a = <div style={{ color: 'red', marginTop: 4, '--width': `${width}px` } as CSSProperties} />;
const b = <div style={{ backgroundColor: 'red' } satisfies CSSProperties} />; // expect: no-inline-styles "backgroundColor"
// expect: no-inline-styles "--tone"
// expect: no-inline-styles "--shadow"
const c = <div style={{ '--tone': '#fff', '--other': 'hsl(var(--primary))', '--shadow': '0 0 5px rgb(1 2 3)' }} />;
const d = <div style={{ ...floatingStyles, color: 'red' }} />; // expect: no-inline-styles "color"
// expect: no-inline-styles "...otherStyles"
// expect: no-inline-styles "[computed]"
const e = <div style={{ ...otherStyles, [key]: value }} />;
const f = <div style={floatingStyles} />;
const g = <div style={provided.draggableProps.style as CSSProperties} />;
const h = <div style={style} />;
const i = <div style={props.style} />;
const j = <div style={getStyles()} />; // expect: no-inline-styles "getStyles()"
const k = <div style={styles.root} />; // expect: no-inline-styles "styles.root"
const l = <div style={otherStyles} />; // expect: no-inline-styles "otherStyles"
const m = <style>{'a { color: red }'}</style>; // expect: no-inline-styles "<style>"
const n = <div style={{ '--palette': 'bg-blue-500', '--token': 'var(--red)', '--palette2': `var(--blue) ${hue}` }} />;
const o = <div style={{ opacity: 1, ...props.style, ...provided.draggableProps.style }} />; // expect: no-inline-styles "opacity"
const p = <div style={{ ...{ backgroundColor: 'red' } }} />; // expect: no-inline-styles "...{backgroundColor:'red'}"
const q = <div style={{ grid: { color: 'red' } }} />; // expect: no-inline-styles "grid"
const r = <div style={{ '--color': `linear-gradient(var(--primary), red ${hue})` }} />; // expect: no-inline-styles "--color"
const s = <svg style={{ fill: 'blue' }} />; // expect: no-inline-styles "fill"
const t = <Button style={{ padding: size }} />; // expect: no-inline-styles "padding"
const u = <div style="color: red" />; // expect: no-inline-styles "style"
// expect: no-inline-styles "border-color"
// expect: no-inline-styles "marginLeft"
const v = <div style={{ 'border-color': 'red', marginLeft }} />;
const w = <div style={{ '--light': 'linear-gradient(red, blue)', '--safe': 'var(--primary)' }} />; // expect: no-inline-styles "--light"
const x = <style />; // expect: no-inline-styles "<style>"
const y = <div style={{ '--call': fn('red'), '--choice': active ? '#fff' : 'var(--primary)' }} />; // expect: no-inline-styles "--choice"
const z = <div style={styles[key]} />; // expect: no-inline-styles "styles[key]"
const aa = <div style={null} />;
const ab = <div style={[1, 2]} />; // expect: no-inline-styles "[1,2]"
const ac = <div style={undefined} />;
const ad = { render: <div style={{ color: 'red' }} /> }; // expect: no-inline-styles "color"
const ae = [{ cell: () => <div style={{ width: 10 }} /> }]; // expect: no-inline-styles "width"
const af = fn({ ...x, el: <div style={{ top: 1 }} /> }); // expect: no-inline-styles "top"
const ag = { render: <div style={({ left: 2 } as unknown as CSSProperties)} /> }; // expect: no-inline-styles "left"
const ah = <div style={dark ? { backgroundColor: 'x', color: 'y' } : undefined} />; // expect: no-inline-styles "dark?{backgroundColor:'x',color:'y'}:undefined"
const ai = (
  <div
    // expect: no-inline-styles "dark?{backgroundColor:'x',color:'y'}:undefined"
    style={
      dark
        ? {
            backgroundColor: 'x',
            color: 'y',
          }
        : undefined
    }
  />
);
const aj = <div style={{ ...{ backgroundColor: 'red', color: 'blue' } }} />; // expect: no-inline-styles "...{backgroundColor:'red',color:'blue'}"
const ak = (
  <div
    style={{
      // expect: no-inline-styles "...{backgroundColor:'red',color:'blue'}"
      ...{
        backgroundColor: 'red',
        color: 'blue',
      },
    }}
  />
);
