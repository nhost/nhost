'use client';

import { ChevronDown, ChevronUp, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { TodoAttachment } from '@/app/protected/TodoAttachment';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { type WantDraft, WantFields } from '@/components/WantFields';
import {
  ROW_ACTIONS,
  ROW_DIVIDER,
  ROW_GAP,
  ROW_SENTENCE,
  ROW_STAMP,
  ROW_TRAILING,
  Stamp,
  WantSentence,
} from '@/components/WantSentence';
import type { Preposition } from '@/lib/want';

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  preposition: Preposition;
  location: string | null;
  isPublic: boolean;
  fileId: string | null;
  updatedAt: string | null;
};

/** The columns the `user` role is allowed to set on its own rows. */
export type TodoChanges = {
  title?: string;
  completed?: boolean;
  preposition?: string;
  location?: string | null;
  is_public?: boolean;
  file_id?: string | null;
};

// Deleting appears with the row and is gone again when the pointer leaves, so
// a settled list reads as sentences rather than as rows of controls.
//
// `hover:none` pins it open on touch devices. Tailwind's hover variants sit
// behind a `(hover: hover)` query, so a control revealed only on hover is one
// a touch-only device can never reach - and this one is destructive, which is
// not a thing to make unreachable.
const hiddenAction =
  'cursor-pointer text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100';

// Sharing is state, not an action, so unlike delete it is readable without
// pointing at the row: whether an item is on your public page is the kind of
// thing you want to check at a glance down the list.
const visibilityAction =
  'cursor-pointer transition-colors hover:text-foreground';

// The gutter fades in with the row, and each arrow states only its own colour.
// Putting the reveal on the container rather than on the buttons is what keeps
// a disabled arrow dim on a hovered row: one `opacity` per element, so nothing
// has to out-specify anything.
const reorderGutter =
  'flex w-5 shrink-0 flex-col justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100';

const reorderArrow =
  'flex h-4 items-center justify-center rounded-sm outline-none transition-colors focus-visible:ring-[2px] focus-visible:ring-ring/50 enabled:cursor-pointer enabled:text-muted-foreground enabled:hover:text-foreground disabled:cursor-default disabled:text-muted-foreground/25';

export function TodoItem({
  todo,
  index,
  onUpdate,
  onDelete,
  onMove,
  isConfirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  canMoveUp,
  canMoveDown,
  canShare,
  isBusy,
}: {
  todo: Todo;
  /** Row position, which sets the phase of the empty slot's hatch. */
  index: number;
  onUpdate: (changes: TodoChanges) => Promise<void>;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
  /**
   * Whether this is the row asking to be deleted.
   *
   * Held by the list rather than by the row, because there can only be one of
   * them: asking about a second row, or going off to edit a third, answers
   * the first question by abandoning it. Kept per-row, those questions all
   * stayed open at once, so a list could end up with three rows each waiting
   * on a Delete button nobody was going to press.
   */
  isConfirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /**
   * Whether sharing an item can do anything, which is to say whether the
   * owner's public page is on. While it is off the eye is left out rather than
   * shown inert: a control whose only effect is on a page that does not answer
   * is a control that lies about what it did.
   */
  canShare: boolean;
  isBusy: boolean;
}) {
  const asDraft = (): WantDraft => ({
    title: todo.title,
    preposition: todo.preposition,
    location: todo.location,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<WantDraft>(asDraft);
  const [mediaError, setMediaError] = useState<string | undefined>();

  // Set by Escape so the focusout that follows unmounting the editor is not
  // read as "the user finished". Without it, cancelling would save.
  const abandoned = useRef(false);
  // A save already in flight. Leaving the field can fire focusout more than
  // once - blurring a child, then the container - and each would otherwise
  // start its own mutation for the same edit.
  const saving = useRef(false);

  const cancelDeleteOnEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      onCancelDelete();
    }
  };

  /**
   * Writes the edited sentence, if it actually changed.
   *
   * Nothing is written while typing: the row is saved when focus leaves it, so
   * a half-typed sentence never reaches the database and a row is not sent
   * through every intermediate state on its way to the one its owner meant.
   *
   * A sentence that came back unchanged writes nothing at all. Clicking into a
   * row and straight back out is the commonest thing to do with one, and it
   * should cost no request.
   */
  const commit = (): void => {
    setIsEditing(false);

    if (saving.current) {
      return;
    }

    const title = draft.title.trim();
    const location = draft.location?.trim() || null;

    // An empty box is not an edit, it is a slip. Put the sentence back.
    if (!title) {
      setDraft(asDraft());
      return;
    }

    const unchanged =
      title === todo.title &&
      draft.preposition === todo.preposition &&
      location === todo.location;

    if (unchanged) {
      return;
    }

    saving.current = true;
    void onUpdate({ title, preposition: draft.preposition, location })
      .catch(() => {})
      .finally(() => {
        saving.current = false;
      });
  };

  const startEditing = (): void => {
    // Turning to a row to edit it is an answer to a question asked of some
    // other row: whatever was waiting on a Delete button is not what you came
    // back to do.
    onCancelDelete();
    abandoned.current = false;
    setDraft(asDraft());
    setIsEditing(true);
  };

  const handleEditorBlur = (event: FocusEvent<HTMLDivElement>): void => {
    // Moving between the select and the two inputs inside the editor is not
    // leaving it, so only a focus landing outside counts as finishing.
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    if (abandoned.current) {
      abandoned.current = false;
      setIsEditing(false);
      return;
    }

    commit();
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      abandoned.current = true;
      setDraft(asDraft());
      setIsEditing(false);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  };

  return (
    // No border and no fill. A box around every row draws four lines per item
    // and turns a short list into a stack of cards; the sentences are what
    // separate one row from the next, and the tint on hover says which one you
    // are pointing at.
    <li
      className={`group flex flex-col transition-colors hover:bg-muted/40 ${ROW_DIVIDER}`}
    >
      {/* `min-w-0` the whole way down to the sentence. A flex item's floor is
          its content, so without it a single long word - or a long sentence in
          the editor, which sizes itself to its own text - makes the row wider
          than the card and hands the page a horizontal scrollbar. */}
      <div className="flex min-w-0 items-center gap-1">
        {/* Reordering lives outside the row's own controls: it acts on the list
            rather than on the item, so it reads as a handle beside the row.

            Both arrows are always rendered, and the one that cannot go anywhere
            is disabled rather than removed, so the shape is the same on every
            row and the ends are legible as ends. */}
        <div className={reorderGutter}>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isBusy || !canMoveUp}
            className={reorderArrow}
          >
            <ChevronUp className="size-4" aria-hidden />
            <span className="sr-only">Move {todo.title} up</span>
          </button>

          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isBusy || !canMoveDown}
            className={reorderArrow}
          >
            <ChevronDown className="size-4" aria-hidden />
            <span className="sr-only">Move {todo.title} down</span>
          </button>
        </div>

        {/* `gap-3` throughout: the checkbox, the picture and the sentence are
            three different things and were reading as one clump when they sat
            a few pixels apart. Round, because it is the only circle in the row
            and so cannot be mistaken for the square picture beside it. */}
        <div
          className={`flex min-w-0 flex-1 items-center py-3 ${ROW_TRAILING} ${ROW_GAP}`}
        >
          <Checkbox
            checked={todo.completed}
            onCheckedChange={(checked) =>
              void onUpdate({ completed: checked === true }).catch(() => {})
            }
            disabled={isBusy}
            className="size-5 shrink-0 cursor-pointer rounded-full"
            aria-label={
              todo.completed ? `Reopen ${todo.title}` : `Complete ${todo.title}`
            }
          />

          <TodoAttachment
            fileId={todo.fileId}
            index={index}
            alt={todo.title}
            onChange={(fileId) => onUpdate({ file_id: fileId })}
            onError={setMediaError}
            disabled={isBusy}
          />

          {isEditing ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: a focus boundary around the real controls, which are the inputs inside it
            <div
              className={`flex min-w-0 flex-1 ${ROW_SENTENCE}`}
              onBlur={handleEditorBlur}
              onKeyDown={handleEditorKeyDown}
            >
              <WantFields
                want={draft}
                onChange={setDraft}
                variant="inline"
                disabled={isBusy}
                autoFocus
              />
            </div>
          ) : (
            // The sentence is the control. A pencil somewhere to the right was
            // a second thing to find and aim at for something the words
            // themselves could offer; clicking what you want to change is
            // shorter to explain and shorter to do.
            <button
              type="button"
              onClick={startEditing}
              disabled={isBusy}
              aria-label={`Edit ${todo.title}`}
              className="min-w-0 flex-1 cursor-text text-left"
            >
              <WantSentence
                title={todo.title}
                preposition={todo.preposition}
                location={todo.location}
                completed={todo.completed}
                className={ROW_SENTENCE}
              />
            </button>
          )}

          {/* When the sentence last changed. Quiet and on the far side of the
              row, because it is the sort of thing you look for rather than
              read - and it is hidden altogether on a narrow screen, where the
              sentence needs the width more than the stamp does.

              Stays while the row is being edited. It is the answer to "when
              did I last touch this", which is a question you ask about a row
              precisely when you have opened it to change it - and taking it
              away on the click that opens the editor also moved everything to
              its right, so the row twitched on the way in. */}
          <Stamp value={todo.updatedAt} className={ROW_STAMP} />

          {/* The confirmation takes over the row's own controls rather than
              opening a dialog over the page. Deleting one line of a list is not
              worth losing your place for, and the thing being deleted stays on
              screen and readable while you answer. */}
          {isConfirmingDelete ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Delete this?
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={onDelete}
                onKeyDown={cancelDeleteOnEscape}
                disabled={isBusy}
                autoFocus
              >
                Delete
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onCancelDelete}
                onKeyDown={cancelDeleteOnEscape}
                disabled={isBusy}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className={ROW_ACTIONS}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={onConfirmDelete}
                disabled={isBusy}
                className={`${hiddenAction} hover:text-destructive`}
              >
                <Trash2 aria-hidden />
                <span className="sr-only">Delete {todo.title}</span>
              </Button>

              {canShare ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    void onUpdate({ is_public: !todo.isPublic }).catch(() => {})
                  }
                  disabled={isBusy}
                  aria-pressed={todo.isPublic}
                  className={`${visibilityAction} ${
                    todo.isPublic
                      ? 'text-foreground'
                      : 'text-muted-foreground/60'
                  }`}
                >
                  {todo.isPublic ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                  <span className="sr-only">
                    {todo.isPublic
                      ? `Stop sharing ${todo.title}`
                      : `Share ${todo.title}`}
                  </span>
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {mediaError ? (
        <p className="px-3 pb-2 pl-[6.5rem] text-destructive text-xs">
          {mediaError}
        </p>
      ) : null}
    </li>
  );
}
