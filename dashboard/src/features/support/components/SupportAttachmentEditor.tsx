import CodeMirror, {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  type Range,
  type ReactCodeMirrorRef,
  StateField,
  WidgetType,
} from '@uiw/react-codemirror';
import { Paperclip } from 'lucide-react';
import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import SupportEditorAttachment from '@/features/support/components/SupportEditorAttachment';
import {
  SUPPORT_ATTACHMENT_TOKEN_PATTERN,
  type SupportAttachmentScope,
  supportAttachmentId,
} from '@/features/support/utils/attachments';
import { codeMirrorAppBackground } from '@/lib/codeMirrorAppTheme';
import { cn } from '@/lib/utils';

export interface SupportEditorHandle {
  readonly view: EditorView | undefined;
  focus: VoidFunction;
}

interface AttachmentToken {
  id: string;
  name: string;
  markdown: string;
  uploading: boolean;
  block: boolean;
}

interface WidgetHost {
  element: HTMLElement;
  token: AttachmentToken;
  remove: VoidFunction;
}

interface SupportAttachmentEditorProps
  extends Pick<
    HTMLAttributes<HTMLDivElement>,
    'id' | 'aria-describedby' | 'aria-invalid'
  > {
  value: string;
  onChange: (value: string) => void;
  onBlur: VoidFunction;
  label: string;
  disabled?: boolean;
  dragging: boolean;
  scope?: SupportAttachmentScope;
  uploadPrefix: string;
  onFormat: (before: string, after?: string) => void;
  onFilesDrop: (files: File[], position: number | null) => void;
  filesDisabled: boolean;
  organizationRequired: boolean;
  footer?: ReactNode;
  onDiscardAttachment?: (id: string) => Promise<void>;
  onDraggingChange: (dragging: boolean) => void;
}

const ATTACHMENT_DRAG_TYPE = 'application/x-nhost-support-attachment';

const editorTheme = EditorView.theme({
  '&': { fontFamily: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', overflow: 'visible' },
  '.cm-content': { padding: '0', caretColor: 'hsl(var(--foreground))' },
  '.cm-cursor': { borderLeftColor: 'hsl(var(--foreground))' },
  '.cm-line': { padding: '0' },
  '.cm-widgetBuffer': { display: 'none' },
});

const basicSetup = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  highlightSelectionMatches: false,
  bracketMatching: false,
  closeBrackets: false,
  autocompletion: false,
  drawSelection: false,
};

const SupportAttachmentEditor = forwardRef<
  SupportEditorHandle,
  SupportAttachmentEditorProps
>(function AttachmentEditorInput(
  {
    value,
    onChange,
    onBlur,
    label,
    disabled = false,
    dragging,
    scope,
    uploadPrefix,
    onFormat,
    onFilesDrop,
    filesDisabled,
    organizationRequired,
    footer,
    onDiscardAttachment,
    onDraggingChange,
    id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
  },
  ref,
) {
  const editor = useRef<ReactCodeMirrorRef>(null);
  const hosts = useRef(new Map<HTMLElement, WidgetHost>());
  const dropCaret = useRef<HTMLSpanElement>(null);
  const draggedAttachment = useRef<Pick<WidgetHost, 'element' | 'token'>>(null);
  const format = useRef(onFormat);
  const [widgets, setWidgets] = useState<WidgetHost[]>([]);
  const refresh = useCallback(() => {
    queueMicrotask(() => setWidgets([...hosts.current.values()]));
  }, []);
  useLayoutEffect(() => {
    format.current = onFormat;
  }, [onFormat]);
  useLayoutEffect(() => {
    editor.current?.view?.requestMeasure();
  }, [widgets]);
  useImperativeHandle(
    ref,
    () => ({
      get view() {
        return editor.current?.view;
      },
      focus() {
        editor.current?.view?.focus();
      },
    }),
    [],
  );

  const decorations = useMemo(() => {
    class AttachmentWidget extends WidgetType {
      constructor(readonly token: AttachmentToken) {
        super();
      }
      eq(other: AttachmentWidget) {
        return this.token.markdown === other.token.markdown;
      }
      toDOM(view: EditorView) {
        const element = document.createElement(
          this.token.block ? 'div' : 'span',
        );
        element.className = 'max-w-full';
        element.setAttribute('data-support-attachment-widget', '');
        element.contentEditable = 'false';
        hosts.current.set(element, {
          element,
          token: this.token,
          remove: () => {
            if (view.state.readOnly) {
              return;
            }
            const from = view.posAtDOM(element);
            if (
              view.state.doc.sliceString(
                from,
                from + this.token.markdown.length,
              ) !== this.token.markdown
            ) {
              return;
            }
            view.dispatch({
              changes: {
                from,
                to: from + this.token.markdown.length,
                insert: '',
              },
              selection: { anchor: from },
              userEvent: 'delete',
            });
            view.focus();
          },
        });
        refresh();
        return element;
      }
      destroy(element: HTMLElement) {
        hosts.current.delete(element);
        refresh();
      }
      ignoreEvent() {
        return true;
      }
    }

    function build(doc: string): DecorationSet {
      const ranges: Range<Decoration>[] = [];
      for (const match of doc.matchAll(SUPPORT_ATTACHMENT_TOKEN_PATTERN)) {
        const attachmentID = match[3];
        const uploading = attachmentID.startsWith(uploadPrefix);
        if (!uploading && !supportAttachmentId(`attachment:${attachmentID}`)) {
          continue;
        }
        const token: AttachmentToken = {
          id: attachmentID,
          name: match[2].replace(/\\(.)/g, '$1'),
          markdown: match[0],
          uploading,
          block: !!match[1] || uploading,
        };
        ranges.push(
          Decoration.replace({
            widget: new AttachmentWidget(token),
            block: token.block,
          }).range(match.index, match.index + match[0].length),
        );
      }
      return Decoration.set(ranges, true);
    }

    return StateField.define<DecorationSet>({
      create: (state) => build(state.doc.toString()),
      update: (current, transaction) =>
        transaction.docChanged
          ? build(transaction.state.doc.toString())
          : current,
      provide: (field) => [
        EditorView.decorations.from(field),
        EditorView.atomicRanges.of((view) => view.state.field(field)),
      ],
    });
  }, [refresh, uploadPrefix]);

  function getAttachmentDrop(x: number, y: number) {
    const source = draggedAttachment.current;
    const view = editor.current?.view;
    if (
      disabled ||
      !view ||
      !source ||
      !view.contentDOM.contains(source.element)
    ) {
      return;
    }

    const { doc } = view.state;
    const { markdown } = source.token;
    let from = view.posAtDOM(source.element);
    let to = from + markdown.length;
    if (doc.sliceString(from, to) !== markdown) {
      return;
    }

    const hit = view.posAtCoords({ x, y });
    if (hit == null) {
      return;
    }
    // Drop beside an attachment widget, never inside its Markdown.
    let position = hit;
    view.state.field(decorations).between(hit, hit, (start, end) => {
      if (start < hit && hit < end) {
        position = hit - start < end - hit ? start : end;
      }
    });

    const line = doc.lineAt(from);
    if (from === line.from && to === line.to) {
      if (to < doc.length) {
        to += 1;
      } else if (from > 0) {
        from -= 1;
      }
    }
    if (position >= from && position <= to) {
      return;
    }

    return { view, doc, markdown, from, to, position };
  }

  function moveAttachment(x: number, y: number) {
    const target = getAttachmentDrop(x, y);
    if (!target) {
      return;
    }
    const { view, doc, markdown, from, to, position } = target;
    const before =
      position > 0 && doc.sliceString(position - 1, position) !== '\n'
        ? '\n'
        : '';
    const after =
      position < doc.length && doc.sliceString(position, position + 1) !== '\n'
        ? '\n'
        : '';
    const insert = `${before}${markdown}${after}`;
    const removal = { from, to };
    const insertion = { from: position, insert };
    view.dispatch({
      changes: position < from ? [insertion, removal] : [removal, insertion],
      selection: {
        anchor: position + insert.length - (position > to ? to - from : 0),
      },
      userEvent: 'move.drop',
    });
    view.focus();
  }

  const shortcuts = useMemo(
    () =>
      keymap.of([
        {
          key: 'Mod-b',
          run: () => {
            if (!disabled) {
              format.current('**');
            }
            return true;
          },
        },
        {
          key: 'Mod-i',
          run: () => {
            if (!disabled) {
              format.current('_');
            }
            return true;
          },
        },
        {
          key: 'Mod-k',
          run: () => {
            if (!disabled) {
              format.current('[', '](https://)');
            }
            return true;
          },
        },
        { key: 'Tab', run: () => false },
        { key: 'Shift-Tab', run: () => false },
      ]),
    [disabled],
  );

  const extensions = useMemo(() => {
    const attributes: Record<string, string> = {
      role: 'textbox',
      'aria-label': label,
      'aria-multiline': 'true',
      'aria-readonly': String(disabled),
      'aria-disabled': String(disabled),
    };
    if (id) {
      attributes.id = id;
    }
    if (describedBy) {
      attributes['aria-describedby'] = describedBy;
    }
    if (invalid !== undefined) {
      attributes['aria-invalid'] = String(invalid);
    }
    return [
      codeMirrorAppBackground,
      editorTheme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of(attributes),
      shortcuts,
      decorations,
    ];
  }, [decorations, describedBy, disabled, id, invalid, label, shortcuts]);

  return (
    <fieldset
      aria-label={`${label} editor`}
      className={cn(
        'relative min-h-40 w-full rounded-md border border-input bg-background text-base ring-offset-background transition-colors md:text-sm [&_.cm-content]:min-h-40',
        !disabled && 'hover:border-primary/50',
        dragging && !filesDisabled && 'border-primary ring-2 ring-primary/30',
        dragging && organizationRequired && 'border-destructive',
      )}
      onBlur={onBlur}
      onDragStartCapture={(event) => {
        const element =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>(
                '[data-support-attachment-widget]',
              )
            : null;
        const source = element ? hosts.current.get(element) : undefined;
        if (!source) {
          return;
        }
        if (
          disabled ||
          source.token.uploading ||
          (event.target instanceof Element && event.target.closest('button'))
        ) {
          event.preventDefault();
          return;
        }
        const transfer = event.dataTransfer;
        transfer.clearData();
        transfer.setData(ATTACHMENT_DRAG_TYPE, 'move');
        transfer.effectAllowed = 'move';
        draggedAttachment.current = source;
      }}
      onDragEndCapture={() => {
        dropCaret.current?.setAttribute('hidden', '');
        draggedAttachment.current = null;
      }}
      onDragOverCapture={(event) => {
        if (event.dataTransfer.types.includes(ATTACHMENT_DRAG_TYPE)) {
          event.preventDefault();
          event.stopPropagation();
          const transfer = event.dataTransfer;
          const target =
            event.target instanceof Node &&
            editor.current?.view?.contentDOM.contains(event.target)
              ? getAttachmentDrop(event.clientX, event.clientY)
              : undefined;
          transfer.dropEffect = target ? 'move' : 'none';
          const caret = dropCaret.current;
          if (caret) {
            const coords = target?.view.coordsAtPos(target.position);
            caret.hidden = !coords;
            if (coords) {
              caret.style.left = `${coords.left}px`;
              caret.style.top = `${coords.top}px`;
              caret.style.height = `${coords.bottom - coords.top}px`;
            }
          }
          return;
        }
        if (!event.dataTransfer.types.includes('Files')) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const transfer = event.dataTransfer;
        transfer.dropEffect = filesDisabled ? 'none' : 'copy';
        onDraggingChange(!filesDisabled || organizationRequired);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          dropCaret.current?.setAttribute('hidden', '');
          onDraggingChange(false);
        }
      }}
      onDropCapture={(event) => {
        dropCaret.current?.setAttribute('hidden', '');
        if (event.dataTransfer.types.includes(ATTACHMENT_DRAG_TYPE)) {
          event.preventDefault();
          event.stopPropagation();
          if (
            event.target instanceof Node &&
            editor.current?.view?.contentDOM.contains(event.target)
          ) {
            moveAttachment(event.clientX, event.clientY);
          }
          draggedAttachment.current = null;
          return;
        }
        if (!event.dataTransfer.types.includes('Files')) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onDraggingChange(false);
        if (!filesDisabled) {
          const position =
            Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
              ? (editor.current?.view?.posAtCoords({
                  x: event.clientX,
                  y: event.clientY,
                }) ?? null)
              : null;
          onFilesDrop(Array.from(event.dataTransfer.files), position);
        }
      }}
    >
      <span
        ref={dropCaret}
        hidden
        aria-hidden="true"
        className="pointer-events-none fixed z-10 w-0.5 bg-foreground"
      />
      <div
        className={cn(
          'px-3 py-2',
          disabled && 'cursor-not-allowed',
          disabled && !(dragging && organizationRequired) && 'opacity-50',
        )}
      >
        <CodeMirror
          ref={editor}
          value={value}
          onChange={onChange}
          readOnly={disabled}
          indentWithTab={false}
          basicSetup={basicSetup}
          extensions={extensions}
        />
      </div>
      {footer}
      {dragging && (!filesDisabled || organizationRequired) && (
        <div
          role="status"
          className={cn(
            'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md text-sm',
            organizationRequired
              ? 'bg-destructive/5 text-destructive'
              : 'bg-primary/5 text-primary',
          )}
        >
          <Paperclip aria-hidden="true" className="size-4" />
          {organizationRequired
            ? 'Pick an organization first'
            : 'Drop to attach'}
        </div>
      )}
      {widgets.map(({ element, token, remove }) =>
        createPortal(
          <SupportEditorAttachment
            id={token.id}
            name={token.name}
            scope={scope}
            uploading={token.uploading}
            disabled={disabled}
            draftActions={!!onDiscardAttachment}
            removalBlocked={!!onDiscardAttachment && filesDisabled}
            onRemove={
              onDiscardAttachment
                ? () => {
                    void onDiscardAttachment(token.id);
                  }
                : remove
            }
          />,
          element,
        ),
      )}
    </fieldset>
  );
});

export default SupportAttachmentEditor;
