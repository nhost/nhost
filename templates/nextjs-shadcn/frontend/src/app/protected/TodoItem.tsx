'use client';

import { Check, Pencil, Trash2, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

export function TodoItem({
  todo,
  onToggle,
  onRename,
  onDelete,
  isBusy,
}: {
  todo: Todo;
  onToggle: (completed: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  isBusy: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);

  const stopEditing = (): void => {
    setIsEditing(false);
    setTitle(todo.title);
  };

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const next = title.trim();

    if (!next || next === todo.title) {
      stopEditing();
      return;
    }

    onRename(next);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <li className="rounded-md border p-2">
        <form className="flex items-center gap-2" onSubmit={handleSubmit}>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                stopEditing();
              }
            }}
            aria-label={`Rename ${todo.title}`}
            disabled={isBusy}
            autoFocus
          />
          <Button type="submit" size="icon" variant="ghost" disabled={isBusy}>
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
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 rounded-md border p-3">
      <Checkbox
        checked={todo.completed}
        onCheckedChange={(checked) => onToggle(checked === true)}
        disabled={isBusy}
        aria-label={
          todo.completed ? `Reopen ${todo.title}` : `Complete ${todo.title}`
        }
      />

      <span
        className={`flex-1 text-sm ${
          todo.completed ? 'text-muted-foreground line-through' : ''
        }`}
      >
        {todo.title}
      </span>

      {/* Visible on hover on a pointer, and always once focus reaches them. */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          disabled={isBusy}
        >
          <Pencil aria-hidden />
          <span className="sr-only">Edit {todo.title}</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onDelete}
          disabled={isBusy}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden />
          <span className="sr-only">Delete {todo.title}</span>
        </Button>
      </div>
    </li>
  );
}
