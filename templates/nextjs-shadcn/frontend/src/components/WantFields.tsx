'use client';

import { Eye, EyeOff, Plus, X } from 'lucide-react';
import type { FocusEvent, MouseEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { PREPOSITIONS, type Preposition } from '@/lib/want';

/**
 * What the empty field suggests, in rotation.
 *
 * More than one because a single example reads as the only thing the box
 * accepts; a handful of unlike ones say "anything" faster than a sentence
 * explaining that would.
 */
const PLACEHOLDERS = [
  'go skateboarding',
  'learn to bake sourdough',
  'see the northern lights',
  'finally read Dune',
  'call my grandmother',
] as const;

// How long a suggestion sits still, and how long it takes to trade places with
// the next. The fade is long and eased rather than quick and linear: this sits
// under the caret of a field somebody may be about to type in, so it wants to
// be the slowest thing on the page rather than something that catches the eye.
// The two are paired - `PLACEHOLDER_FADE_MS` has to match the `duration-*` on
// the element below, or the words change while still partly visible.
const PLACEHOLDER_HOLD_MS = 4500;
const PLACEHOLDER_FADE_MS = 700;

/**
 * Cycles the suggestion, fading out before the swap and back in after it, so
 * the words are never seen changing.
 *
 * Runs only while there is nothing typed: once the field has content the
 * suggestion is not visible, and a timer still ticking behind it would fight
 * for renders with every keystroke.
 *
 * Anyone who has asked for less motion keeps the first suggestion and no
 * timer at all. The rotation is decoration; the field works the same without
 * it.
 */
function useRotatingPlaceholder(active: boolean): {
  text: string;
  visible: boolean;
} {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let swap: ReturnType<typeof setTimeout> | undefined;

    const hold = setInterval(() => {
      setVisible(false);
      swap = setTimeout(() => {
        setIndex((current) => (current + 1) % PLACEHOLDERS.length);
        setVisible(true);
      }, PLACEHOLDER_FADE_MS);
    }, PLACEHOLDER_HOLD_MS);

    return () => {
      clearInterval(hold);
      clearTimeout(swap);
    };
  }, [active]);

  return { text: PLACEHOLDERS[index] ?? PLACEHOLDERS[0], visible };
}

/**
 * `null` is no location and `''` is one being typed, the same distinction the
 * nullable column makes. A single empty string for both would collapse the
 * field under you the moment you cleared it to retype.
 */
export type WantDraft = {
  title: string;
  preposition: Preposition;
  location: string | null;
};

/**
 * Sizes a control to the text inside it.
 *
 * Both children sit in the same grid cell: the hidden copy of the text sets
 * the cell's width and the real control stretches to fill it. The alternative
 * is measuring in an effect, which means a layout pass, a resize observer, and
 * a frame where the width is wrong. This is CSS doing it for free, so the
 * sentence reflows exactly as fast as you type.
 *
 * The mirror has to carry the same font metrics and the same horizontal
 * padding as the control it sizes, which is what `mirrorClassName` is for.
 *
 * `overflow-hidden` with the `max-w-full` is what stops a long value doing the
 * sizing instead: past the width of the row the mirror is clipped rather than
 * allowed to push the cell wider, and the control inside scrolls its own text
 * the way any single-line field does.
 */
function AutoWidth({
  text,
  className,
  mirrorClassName,
  children,
}: {
  text: string;
  className?: string;
  mirrorClassName?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-grid max-w-full overflow-hidden ${className ?? ''}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none invisible col-start-1 row-start-1 whitespace-pre ${mirrorClassName ?? ''}`}
      >
        {text}
      </span>
      {children}
    </span>
  );
}

// `h-6` on every control in the row, including this one. Without a shared
// height the row is as tall as whatever happens to be in it, so revealing the
// location chip - which is taller than the bare "+ location" button it
// replaces - grew the whole field by a few pixels on click. One height means
// the box is the same size in both states and nothing moves.
const control =
  'h-6 min-w-0 border-0 bg-transparent shadow-none outline-none focus-visible:ring-0';

const inCell = 'col-start-1 row-start-1 w-full';

// Deliberately carries no colour. Two colour classes in one string fight on
// stylesheet order rather than on the order they are written, so each button
// below states its own.
//
// Tailwind v4's preflight gives every button `cursor: default`, so the pointer
// has to be asked for - the same reason `button.tsx` asks for it.
const inlineButton =
  'inline-flex h-6 shrink-0 cursor-pointer items-center gap-0.5 rounded-sm text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default';

/**
 * The box the compose form wears: a border, a focus ring, and padding, so it
 * reads as the one field it is meant to be.
 *
 * Fully rounded rather than softly. The list below it is a column of squares -
 * the pictures, the checkboxes aside - and the one thing on the page you write
 * into should not look like another of them. `px-4` is the room the curve
 * takes: at `px-3` the opening words sat inside the arc.
 */
const boxedShell =
  'rounded-full border border-input bg-transparent px-4 py-2 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50';

/**
 * The shell an existing row wears while being edited: none at all.
 *
 * A border appearing under the pointer is the row announcing it has become a
 * form, which is the opposite of editing in place - the words should simply
 * turn editable where they already are. It inherits its type size from the
 * row, so the sentence does not change size on the way into the editor either.
 */
const inlineShell = 'text-[length:inherit] leading-[inherit]';

const quietButton =
  'text-muted-foreground/60 hover:text-foreground focus-visible:text-foreground';

/**
 * The whole sentence as one field: "I want to ... in ...".
 *
 * It looks like a single input because it is meant to read as a single
 * thought. In `boxed` form the box owns the border and the focus ring, and the
 * controls inside are bare, so tabbing between them does not make three
 * separate outlines appear.
 *
 * In `inline` form there is no box at all. That is what editing a row in place
 * means: the title stops taking the free space and hugs its own text the way
 * the location already did, so "in ddd" stays where it was reading rather than
 * being flung to the far end of a field that just appeared.
 */
export function WantFields({
  want,
  onChange,
  visibility,
  variant = 'boxed',
  disabled,
  autoFocus,
}: {
  want: WantDraft;
  onChange: (next: WantDraft) => void;
  /**
   * Offered while composing, so a new item can be shared as it is written
   * rather than added privately and then hunted down on the row. Left out when
   * editing, where the eye on the row is already the one place that says
   * whether the item is shared.
   */
  visibility?: { isPublic: boolean; onToggle: () => void };
  /** `boxed` composes a new item; `inline` edits one already on the list. */
  variant?: 'boxed' | 'inline';
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const isInline = variant === 'inline';
  const titleRef = useRef<HTMLInputElement>(null);
  const [locationRevealed, setLocationRevealed] = useState(false);

  /**
   * Takes the location box away again when it was opened and left empty.
   *
   * Revealing the field is a guess at what you were about to do, and leaving
   * without typing anything is the answer to that guess. Left open, an empty
   * box sits in the sentence looking like something half-finished, and the
   * only way to dismiss it is to find the small x - so the click that opened
   * it has no matching click to close it.
   *
   * Only when focus leaves the whole group: moving between the preposition and
   * the box is still deciding, not abandoning.
   */
  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setLocationRevealed(false);

    if (want.location !== null && want.location.trim() === '') {
      onChange({ ...want, location: null });
    }
  };

  // The rotation is a client-only effect, so the first paint keeps the native
  // placeholder and the overlay takes over once mounted. Rendering both at
  // once would print the suggestion twice; rendering neither until mount
  // would leave the field blank in the server HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isEmpty = want.title === '';
  const placeholder = useRotatingPlaceholder(isEmpty);
  const showRotating = mounted && isEmpty;

  // The box looks like one text field, so clicking its padding or the words
  // printed in it has to land in the field the way it would in a real one.
  // Only clicks on the box itself: anything that reached a control inside it
  // is that control's to handle.
  const focusTitle = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    const input = titleRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a focus shortcut for pointers; the input inside is the real control
    <div
      onMouseDown={focusTitle}
      onBlur={handleBlur}
      // Editing in place, the gaps between the parts have to be the width of
      // the spaces they stand in for, or the words shift sideways the moment
      // the editor opens. `gap-x-1` is about one space at this size; the boxed
      // form is not standing in for anything and can breathe.
      className={`flex min-w-0 flex-wrap items-center gap-y-1 ${
        isInline
          ? `${inlineShell} flex-1 gap-x-1`
          : `${boxedShell} flex-1 gap-x-1.5`
      }`}
    >
      <span className="pointer-events-none shrink-0 text-muted-foreground">
        I want to
      </span>

      {/* Composing, the title takes the free space, so the empty run after the
          words is still the field you are typing in. Editing a row it hugs its
          own text instead: the words after it have somewhere to be, and
          stretching the title would shove them to the far edge of the row the
          moment the editor opened.

          Hugging its own text is also what had to be capped. The invisible
          mirror below is what sets this width, so a long sentence sized the
          row past the card and gave the whole page a horizontal scrollbar.
          `max-w-full` stops it at the row, the clip takes the rest of the
          mirror - which is invisible, so there is nothing to see cut off - and
          the input inside scrolls its own text like any single-line field. */}
      <span
        className={`relative flex h-6 items-center ${
          isInline ? 'min-w-[2ch] max-w-full overflow-hidden' : 'w-0 flex-1'
        }`}
      >
        {isInline ? (
          <span aria-hidden className="invisible whitespace-pre">
            {want.title || ' '}
          </span>
        ) : null}

        <input
          ref={titleRef}
          value={want.title}
          onChange={(event) => onChange({ ...want, title: event.target.value })}
          placeholder={showRotating ? '' : PLACEHOLDERS[0]}
          aria-label="What do you want to do?"
          disabled={disabled}
          // biome-ignore lint/a11y/noAutofocus: only when an existing row opens for editing
          autoFocus={autoFocus}
          className={`${control} ${
            isInline ? 'absolute inset-0 w-full' : 'w-full'
          } p-0 placeholder:text-muted-foreground/60`}
        />

        {/* Behind the caret rather than in the `placeholder`, because a
            placeholder cannot be transitioned. `aria-hidden` and
            pointer-events-none keep it out of the way of the real control: the
            input's own `aria-label` is what names the field. */}
        {showRotating ? (
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 left-0 flex items-center truncate text-muted-foreground/60 transition-opacity duration-700 ease-in-out ${
              placeholder.visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {placeholder.text}
          </span>
        ) : null}
      </span>

      {want.location === null ? (
        /* Editing a row, this appears with the row's other controls rather
           than sitting in the sentence. A place is the exception on a list
           like this, so printing the offer of one inside every row being
           edited put a control where the eye expects the end of a sentence -
           and it is the only thing in the editor that is not the words
           themselves. On hover it is there when it is wanted, like the delete
           button beside it.

           Revealed by hovering the row, or by tabbing onto the button itself -
           the same pair `hiddenAction` uses for delete, and deliberately *not*
           `group-focus-within`. Opening the editor puts focus inside the row,
           so a rule keyed to focus-within the group is true for as long as the
           row is being edited, which is precisely when this is meant to be
           out of the way. `hover:none` pins it open on touch, where there is
           no hover to reveal it with. Composing, there is no row to hover and
           nothing else in the box, so it stays put. */
        <button
          type="button"
          onClick={() => {
            setLocationRevealed(true);
            onChange({ ...want, location: '' });
          }}
          disabled={disabled}
          className={`${inlineButton} ${quietButton} ${
            isInline
              ? 'opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
              : ''
          }`}
        >
          <Plus className="size-3.5" aria-hidden />
          location
        </button>
      ) : (
        <span
          className={`flex min-w-0 items-center ${isInline ? 'gap-x-1' : 'gap-x-1.5'}`}
        >
          {/* A tinted chip rather than a word with a dropdown arrow. It still
              reads as part of the sentence, and the background is doing the
              work an arrow was doing while taking up no room in the line.

              The word you see is the span; the select over it is transparent
              and out of flow. Two things come of that. A native popup is drawn
              at the *select's* own font size - an `<option>` cannot set its
              own - so the list opened from a row being edited was as large as
              the row's `text-lg` sentence; at `text-sm` here it is a menu
              again while the word in the sentence keeps the size of the words
              around it. And taking the select out of flow keeps its widest
              option ("from") from setting the chip's width, so the chip is as
              wide as the word actually in it. */}
          <AutoWidth
            text={want.preposition}
            className="relative shrink-0"
            mirrorClassName={isInline ? undefined : 'px-1.5'}
          >
            <select
              value={want.preposition}
              onChange={(event) =>
                onChange({
                  ...want,
                  preposition: event.target.value as Preposition,
                })
              }
              disabled={disabled}
              aria-label="How the location joins the sentence"
              className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded border-0 bg-transparent text-sm opacity-0 outline-none disabled:cursor-default"
            >
              {PREPOSITIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <span
              aria-hidden
              className={`${inCell} pointer-events-none flex h-6 items-center justify-center rounded text-center text-muted-foreground transition-colors peer-hover:bg-accent peer-hover:text-accent-foreground peer-focus-visible:bg-accent ${
                isInline ? '' : 'bg-muted px-1.5'
              }`}
            >
              {want.preposition}
            </span>
          </AutoWidth>

          <AutoWidth text={want.location || 'location'}>
            <input
              value={want.location}
              onChange={(event) =>
                onChange({ ...want, location: event.target.value })
              }
              placeholder="location"
              aria-label="Location"
              disabled={disabled}
              // An input's default `size` is 20 characters, and that intrinsic
              // width - not the mirror's - is what a grid cell sizes to. It is
              // why the x that removes the location used to sit most of a line
              // away from the word it belongs to. At 1 the mirror wins, and the
              // `w-full` above fills whatever the mirror asked for.
              size={1}
              // biome-ignore lint/a11y/noAutofocus: only true for the render right after the click that revealed this field
              autoFocus={locationRevealed}
              className={`${control} ${inCell} p-0 placeholder:text-muted-foreground/60`}
            />
          </AutoWidth>

          {/* Puts the caret back in the title, which is not a courtesy but
              the thing that keeps the editor working. This click unmounts the
              button it is on, and a focused element being removed drops focus
              to `<body>` without firing a `focusout` any ancestor can hear -
              so the row that saves and closes on focus leaving it never learns
              that focus left, and sits open showing `+ location` until it is
              clicked again. Handing focus to the title keeps it inside the
              editor, where the next click away is heard normally. */}
          <button
            type="button"
            onClick={() => {
              setLocationRevealed(false);
              onChange({ ...want, location: null });
              titleRef.current?.focus();
            }}
            disabled={disabled}
            className={`${inlineButton} text-muted-foreground/60 hover:text-destructive focus-visible:text-foreground`}
          >
            <X className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Remove the location</span>
          </button>
        </span>
      )}

      {visibility ? (
        <button
          type="button"
          onClick={visibility.onToggle}
          disabled={disabled}
          aria-pressed={visibility.isPublic}
          title={visibility.isPublic ? 'Shared' : 'Private'}
          // Its own margin on top of the row's gap. This is the one control in
          // the box that is not part of the sentence - it says what happens to
          // the sentence - and at one gap's distance it read as another word
          // in it, immediately after "+ location".
          className={`${inlineButton} ${isInline ? '' : 'ml-2'} ${
            visibility.isPublic ? 'text-foreground' : quietButton
          }`}
        >
          {visibility.isPublic ? (
            <Eye className="size-3.5" aria-hidden />
          ) : (
            <EyeOff className="size-3.5" aria-hidden />
          )}
          <span className="sr-only">
            {visibility.isPublic
              ? 'Shared: anyone with your link can see this'
              : 'Private: only you can see this'}
          </span>
        </button>
      ) : (
        /* The eye's own width, held open while the public page is off.

           The control is left out in that state on purpose - it would be a
           switch with nothing to switch - but leaving out its *space* meant
           the title beside it grew by the width of the icon, and turning the
           page on from the card above shunted `+ location` and everything
           before it sideways. `invisible` keeps the box and takes away the
           paint, the pointer and the tab stop, so the sentence is laid out
           identically in both states. */
        <span
          aria-hidden
          className={`${inlineButton} ${isInline ? '' : 'ml-2'} invisible`}
        >
          <Eye className="size-3.5" />
        </span>
      )}
    </div>
  );
}

/**
 * The location as it reads on a row, once there is one.
 *
 * Plain text on the same baseline as the words around it. An icon here meant
 * an inline-flex box, which aligns by its margin edge rather than the text
 * baseline and pushed the whole segment off the line.
 */
export function LocationTag({ children }: { children: string }) {
  return <span className="font-medium">{children}</span>;
}
