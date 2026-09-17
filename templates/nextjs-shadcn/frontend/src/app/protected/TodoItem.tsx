'use client';

import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { TodoAttachment } from '@/app/protected/TodoAttachment';
import { FileThumbnail } from '@/components/FileThumbnail';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  LocationTag,
  type WantDraft,
  WantFields,
} from '@/components/WantFields';
import { asPreposition, type Preposition } from '@/lib/want';

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  preposition: Preposition;
  location: string | null;
  isPublic: boolean;
  fileId: string | null;
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

const hiddenAction =
  'text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100';

const reorderArrow =
  'flex h-4 items-center justify-center rounded-sm text-muted-foreground/50 opacity-0 outline-none transition hover:text-foreground focus-visible:opacity-100 focus-visible:ring-[2px] focus-visible:ring-ring/50 group-hover:opacity-100 disabled:pointer-events-none';

export function TodoItem({
  todo,
  onUpdate,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
  isBusy,
}: {
  todo: Todo;
  onUpdate: (changes: TodoChanges) => void;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isBusy: boolean;
}) {
  const asDraft = (): WantDraft => ({
    title: todo.title,
    preposition: todo.preposition,
    location: todo.location,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState<WantDraft>(asDraft);

  const stopEditing = (): void => {
    setIsEditing(false);
    setDraft(asDraft());
  };

  // On the buttons rather than on a wrapper: a div holding a key handler is
  // not something a keyboard can reach, so the handler belongs on the things
  // that actually take focus.
  const cancelDeleteOnEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      setIsConfirmingDelete(false);
    }
  };

  // The whole sentence saves at once. Editing the words one field at a time
  // and writing each on blur would send a row through states its owner never
  // meant to publish.
  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();

    const title = draft.title.trim();
    if (!title) {
      stopEditing();
      return;
    }

    // An empty box means no particular place, which the column stores as NULL
    // rather than as an empty string, so there is one way to say it.
    onUpdate({
      title,
      preposition: draft.preposition,
      location: draft.location?.trim() || null,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <li className="flex items-stretch gap-1 rounded-md bg-muted/60">
        {/* Matches the reorder gutter on a settled row so the rows keep one
            left edge whichever state they are in. */}
        <div className="w-5 shrink-0" />

        <div className="flex flex-1 flex-col gap-3 px-3 py-2.5">
          <form
            className="flex items-stretch gap-2"
            onSubmit={handleSubmit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                stopEditing();
              }
            }}
          >
            <WantFields
              want={draft}
              onChange={setDraft}
              disabled={isBusy}
              autoFocus
            />
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                disabled={isBusy}
              >
                <Check aria-hidden />
                <span className="sr-only">Save</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={stopEditing}
                disabled={isBusy}
              >
                <X aria-hidden />
                <span className="sr-only">Cancel</span>
              </Button>
            </div>
          </form>

          <div className="border-t pt-3">
            <TodoAttachment
              fileId={todo.fileId}
              onChange={(fileId) => onUpdate({ file_id: fileId })}
              disabled={isBusy}
            />
          </div>
        </div>
      </li>
    );
  }

  return (
    // No border and no fill. A box around every row draws four lines per item
    // and turns a short list into a stack of cards; the sentences are what
    // separate one row from the next, and the tint on hover says which one you
    // are pointing at.
    <li className="group flex items-stretch gap-1 rounded-md transition-colors hover:bg-muted/50">
      {/* Reordering lives outside the box: it acts on the list rather than on
          the item, so it reads as a handle beside the row instead of another
          control belonging to it.

          An arrow that cannot go anywhere is not rendered at all, and the
          gutter holds its width regardless, so nothing shifts as an item
          reaches either end. */}
      <div className="flex w-5 shrink-0 flex-col justify-center">
        {canMoveUp ? (
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isBusy}
            className={`${reorderArrow} ${canMoveDown ? '' : 'mb-2'}`}
          >
            <ChevronUp className="size-4" aria-hidden />
            <span className="sr-only">Move {todo.title} up</span>
          </button>
        ) : null}

        {canMoveDown ? (
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isBusy}
            className={`${reorderArrow} ${canMoveUp ? '' : 'mt-2'}`}
          >
            <ChevronDown className="size-4" aria-hidden />
            <span className="sr-only">Move {todo.title} down</span>
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 items-center gap-3 px-3 py-2.5">
        <Checkbox
          checked={todo.completed}
          onCheckedChange={(checked) =>
            onUpdate({ completed: checked === true })
          }
          disabled={isBusy}
          aria-label={
            todo.completed ? `Reopen ${todo.title}` : `Complete ${todo.title}`
          }
        />

        {todo.fileId ? (
          <FileThumbnail
            fileId={todo.fileId}
            alt={`Photo on ${todo.title}`}
            className="size-8 shrink-0 rounded-md border"
          />
        ) : null}

        {/* Struck through as one sentence rather than just the middle of it:
          text-decoration carries to the inline children, so the opening and
          the place go with it. */}
        <span
          className={`flex-1 text-sm ${
            todo.completed ? 'text-muted-foreground line-through' : ''
          }`}
        >
          <span className="text-muted-foreground">I want to </span>
          {todo.title}
          {todo.location ? (
            <>
              <span className="text-muted-foreground">
                {' '}
                {asPreposition(todo.preposition)}{' '}
              </span>
              <LocationTag>{todo.location}</LocationTag>
            </>
          ) : null}
        </span>

        {/* The confirmation takes over the row's own controls rather than
          opening a dialog over the page. Deleting one line of a list is not
          worth losing your place for, and the thing being deleted stays on
          screen and readable while you answer. */}
        {isConfirmingDelete ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-sm">Delete this?</span>
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
              onClick={() => setIsConfirmingDelete(false)}
              onKeyDown={cancelDeleteOnEscape}
              disabled={isBusy}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              disabled={isBusy}
              className={hiddenAction}
            >
              <Pencil aria-hidden />
              <span className="sr-only">Edit {todo.title}</span>
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setIsConfirmingDelete(true)}
              disabled={isBusy}
              className={`${hiddenAction} hover:text-destructive`}
            >
              <Trash2 aria-hidden />
              <span className="sr-only">Delete {todo.title}</span>
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onUpdate({ is_public: !todo.isPublic })}
              disabled={isBusy}
              aria-pressed={todo.isPublic}
              className={todo.isPublic ? 'text-foreground' : hiddenAction}
            >
              {todo.isPublic ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
              <span className="sr-only">
                {todo.isPublic
                  ? `Stop sharing ${todo.title}`
                  : `Share ${todo.title}`}
              </span>
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
