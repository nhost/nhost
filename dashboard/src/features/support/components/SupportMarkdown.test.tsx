import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import { Form } from '@/components/form/Form';
import SupportMarkdown from '@/features/support/components/SupportMarkdown';
import SupportMarkdownEditor from '@/features/support/components/SupportMarkdownEditor';
import type { SupportAttachmentUploaded } from '@/features/support/utils/attachments';
import {
  editorValue,
  expectInputValue,
  selectEditorText,
} from '@/tests/supportEditor';
import {
  act,
  fireEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

interface EditorValues {
  description: string;
}
function Editor({
  onSubmit,
  onFilesDrop,
  filesDisabled,
}: {
  onSubmit: (values: EditorValues) => void;
  onFilesDrop?: (
    files: File[],
    onUploaded: SupportAttachmentUploaded,
  ) => Promise<void>;
  filesDisabled?: boolean;
}) {
  const form = useForm<EditorValues>({ defaultValues: { description: '' } });
  return (
    <FormProvider {...form}>
      <Form onSubmit={onSubmit}>
        <SupportMarkdownEditor
          control={form.control}
          name="description"
          label="Description"
          onFilesDrop={onFilesDrop}
          filesDisabled={filesDisabled}
        />
        <button type="submit">Submit</button>
      </Form>
    </FormProvider>
  );
}

describe('support Markdown', () => {
  it.each([false, true])(
    'handles file drops without submitting or changing text (disabled=%s)',
    async (filesDisabled) => {
      const drop = vi.fn().mockResolvedValue(undefined);
      const submit = vi.fn();
      const file = new File(['logs'], 'logs.txt');
      render(
        <Editor
          onSubmit={submit}
          onFilesDrop={drop}
          filesDisabled={filesDisabled}
        />,
      );
      const textbox = screen.getByRole('textbox', { name: 'Description' });
      const user = new TestUserEvent();
      await user.click(textbox);
      await user.paste('Keep my text');
      fireEvent.dragOver(textbox, {
        dataTransfer: { types: ['Files'], dropEffect: 'none' },
      });
      fireEvent.drop(textbox, {
        dataTransfer: { types: ['Files'], files: [file] },
      });
      expect(drop).toHaveBeenCalledTimes(filesDisabled ? 0 : 1);
      if (!filesDisabled) {
        expect(drop).toHaveBeenCalledWith([file], expect.any(Function));
      }
      await waitFor(() =>
        expectInputValue(
          textbox,
          filesDisabled ? 'Keep my text' : 'Keep my text\n\n',
        ),
      );
      expect(submit).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'preserves edits made while a dropped file uploads (placeholder removed=%s)',
    async (removePlaceholder) => {
      const file = new File(['logs'], 'logs.txt', { type: 'text/plain' });
      const id = '41261576-2d59-4c12-bc6e-e573bdba3af1';
      let finish: () => void = () => {};
      let uploaded: SupportAttachmentUploaded = () => {};
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const drop = async (
        _files: File[],
        onUploaded: SupportAttachmentUploaded,
      ) => {
        uploaded = onUploaded;
        await pending;
      };
      const user = new TestUserEvent();
      render(<Editor onSubmit={vi.fn()} onFilesDrop={drop} />);
      const textbox = screen.getByRole('textbox', {
        name: 'Description',
      });
      await user.type(textbox, 'before after');
      selectEditorText(textbox, 7);
      fireEvent.drop(textbox, {
        dataTransfer: { types: ['Files'], files: [file] },
      });
      expect(editorValue(textbox)).toContain('Uploading logs.txt');
      if (removePlaceholder) {
        await user.clear(textbox);
        await user.type(textbox, 'replacement text');
      } else {
        selectEditorText(textbox, editorValue(textbox).length);
        await user.keyboard(' typed while uploading');
      }
      await act(async () => {
        uploaded({ id, name: file.name, mimeType: file.type }, file);
        finish();
      });
      expectInputValue(
        textbox,
        removePlaceholder
          ? 'replacement text'
          : `before \n[logs.txt](attachment:${id})\n\nafter typed while uploading`,
      );
    },
  );

  it('leaves ordinary text drags to the browser', () => {
    const drop = vi.fn();
    render(<Editor onSubmit={vi.fn()} onFilesDrop={drop} />);
    const textbox = screen.getByRole('textbox', { name: 'Description' });
    expect(
      fireEvent.drop(textbox, {
        dataTransfer: { types: ['text/plain'], files: [], getData: () => '' },
      }),
    ).toBe(true);
    expect(drop).not.toHaveBeenCalled();
  });

  it('renders headings, formatting, lists, tables, task lists and fenced code', () => {
    render(
      <SupportMarkdown>
        {
          '## Reproduction\n\n**Important** and _emphasis_ with ~~old~~ behavior.\n\n- First step\n- Second step\n\n- [x] Reproduced\n\n| Service | State |\n| --- | --- |\n| Storage | Failing |\n\n```sql\nSELECT 1;\n```\n\n[Documentation](https://docs.nhost.io)'
        }
      </SupportMarkdown>,
    );
    expect(
      screen.getByRole('heading', { name: 'Reproduction', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Important').tagName).toBe('STRONG');
    expect(screen.getByText('emphasis').tagName).toBe('EM');
    expect(screen.getByText('old').tagName).toBe('DEL');
    expect(screen.getByText('First step').closest('li')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('Storage');
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('SELECT 1;').closest('pre')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Documentation' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('does not execute HTML, allow dangerous links or embed remote/attachment images', () => {
    render(
      <SupportMarkdown>
        {
          '<script>alert(1)</script>\n\n<iframe src="https://example.com"></iframe>\n\n[scripting](javascript:alert%281%29) [data link](data:text/html,unsafe)\n\n![tracking pixel](https://example.com/pixel.png)\n\n![attachment](blob:private-html)'
        }
      </SupportMarkdown>,
    );
    expect(
      document.querySelector('script, iframe, img, embed, object'),
    ).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('scripting').closest('a')).toBeNull();
    expect(screen.getByText('[Image: tracking pixel]')).toBeInTheDocument();
    expect(screen.getByText('[Image: attachment]')).toBeInTheDocument();
  });

  it('submits the raw Markdown without a preview mode', async () => {
    const submit = vi.fn();
    const user = new TestUserEvent();
    const markdown =
      '## Upload failure\n\n**Details**\n\n```json\n{"error":"denied"}\n```';
    render(<Editor onSubmit={submit} />);
    await user.click(screen.getByRole('textbox', { name: 'Description' }));
    await user.paste(markdown);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expectInputValue(
      screen.getByRole('textbox', { name: 'Description' }),
      markdown,
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(submit.mock.calls[0]?.[0]).toEqual({ description: markdown }),
    );
  });

  it('formats the selected text without submitting the form', async () => {
    const submit = vi.fn();
    const user = new TestUserEvent();
    render(<Editor onSubmit={submit} />);
    const textbox = screen.getByRole('textbox', { name: 'Description' });
    await user.type(textbox, 'important');
    await user.keyboard('{Control>}a{/Control}');
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expectInputValue(textbox, '**important**');
    expect(submit).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Preview' }),
    ).not.toBeInTheDocument();
  });
  it('reveals removal over an attachment and removes its complete Markdown reference', async () => {
    const user = new TestUserEvent();
    render(<Editor onSubmit={vi.fn()} />);
    const textbox = screen.getByRole('textbox', { name: 'Description' });
    const markdown =
      '![screenshot.png](attachment:41261576-2d59-4c12-bc6e-e573bdba3af1)';
    await user.click(textbox);
    await user.paste(markdown);
    const remove = await screen.findByRole('button', {
      name: 'Remove screenshot.png',
    });
    expect(remove.parentElement).toHaveClass(
      'opacity-0',
      'pointer-events-none',
    );
    expect(textbox).not.toHaveTextContent('attachment:');
    remove.focus();
    expect(remove).toHaveFocus();
    await user.click(remove);
    expectInputValue(textbox, '');
  });

  it.each(['Backspace', 'Delete'])(
    'deletes an attachment atomically with %s',
    async (key) => {
      const user = new TestUserEvent();
      render(<Editor onSubmit={vi.fn()} />);
      const textbox = screen.getByRole('textbox', { name: 'Description' });
      const markdown =
        '[logs.txt](attachment:41261576-2d59-4c12-bc6e-e573bdba3af1)';
      await user.click(textbox);
      await user.paste(markdown);
      await screen.findByRole('button', { name: 'Remove logs.txt' });
      selectEditorText(textbox, key === 'Backspace' ? markdown.length : 0);
      await user.keyboard(`{${key}}`);
      expectInputValue(textbox, '');
    },
  );
});
