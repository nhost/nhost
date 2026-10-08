/// <reference types="nativewind/types" />

// `global.css` is imported for its side effect in the root layout: Metro hands
// it to NativeWind, which turns the Tailwind output into styles. TypeScript
// knows nothing about importing a stylesheet, so this is what makes that line
// type-check.
declare module '*.css';
