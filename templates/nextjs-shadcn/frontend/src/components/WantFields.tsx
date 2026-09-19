'use client';

import { Eye, EyeOff, Plus, X } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { PREPOSITIONS, type Preposition } from '@/lib/want';

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
    <span className={`inline-grid max-w-full ${className ?? ''}`}>
      <span
        aria-hidden
        className={`pointer-events-none invisible col-start-1 row-start-1 whitespace-pre text-sm ${mirrorClassName ?? ''}`}
      >
        {text}
      </span>
      {children}
    </span>
  );
}

const control =
  'min-w-0 border-0 bg-transparent text-sm shadow-none outline-none focus-visible:ring-0';

const inCell = 'col-start-1 row-start-1 w-full';

// Deliberately carries no colour. Two colour classes in one string fight on
// stylesheet order rather than on the order they are written, so each button
// below states its own.
const inlineButton =
  'inline-flex shrink-0 items-center gap-0.5 rounded-sm text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50';

const quietButton =
  'text-muted-foreground/60 hover:text-foreground focus-visible:text-foreground';

/**
 * The whole sentence as one field: "I want to ... in ...".
 *
 * It looks like a single input because it is meant to read as a single
 * thought. The box owns the border and the focus ring, and the controls inside
 * are bare, so tabbing between them does not make three separate outlines
 * appear.
 */
export function WantFields({
  want,
  onChange,
  visibility,
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
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [locationRevealed, setLocationRevealed] = useState(false);

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
      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-input bg-transparent px-3 py-2 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
    >
      <span className="pointer-events-none shrink-0 text-muted-foreground text-sm">
        I want to
      </span>

      {/* Takes the free space rather than hugging its text, so the empty run
          after the words is still the field you are typing in. The location
          keeps hugging, because it is anchored to the other end. */}
      <input
        ref={titleRef}
        value={want.title}
        onChange={(event) => onChange({ ...want, title: event.target.value })}
        placeholder="go skateboarding"
        aria-label="What do you want to do?"
        disabled={disabled}
        // biome-ignore lint/a11y/noAutofocus: only when an existing row opens for editing
        autoFocus={autoFocus}
        className={`${control} w-0 flex-1 p-0 placeholder:text-muted-foreground/60`}
      />

      {want.location === null ? (
        <button
          type="button"
          onClick={() => {
            setLocationRevealed(true);
            onChange({ ...want, location: '' });
          }}
          disabled={disabled}
          className={`${inlineButton} ${quietButton}`}
        >
          <Plus className="size-3.5" aria-hidden />
          location
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-x-1.5">
          {/* A tinted chip rather than a word with a dropdown arrow. It still
              reads as part of the sentence, and the background is doing the
              work an arrow was doing while taking up no room in the line. */}
          <AutoWidth
            text={want.preposition}
            className="shrink-0"
            mirrorClassName="px-1.5"
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
              className={`${control} ${inCell} cursor-pointer appearance-none rounded bg-muted px-1.5 py-0.5 text-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent`}
            >
              {PREPOSITIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
              // biome-ignore lint/a11y/noAutofocus: only true for the render right after the click that revealed this field
              autoFocus={locationRevealed}
              className={`${control} ${inCell} p-0 placeholder:text-muted-foreground/60`}
            />
          </AutoWidth>

          <button
            type="button"
            onClick={() => {
              setLocationRevealed(false);
              onChange({ ...want, location: null });
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
          className={`${inlineButton} ${
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
      ) : null}
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
