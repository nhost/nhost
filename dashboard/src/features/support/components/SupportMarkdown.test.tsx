import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import { Form } from '@/components/form/Form';
import SupportMarkdown from '@/features/support/components/SupportMarkdown';
import SupportMarkdownEditor from '@/features/support/components/SupportMarkdownEditor';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

interface EditorValues {
  description: string;
}
function Editor({ onSubmit }: { onSubmit: (values: EditorValues) => void }) {
  const form = useForm<EditorValues>({ defaultValues: { description: '' } });
  return (
    <FormProvider {...form}>
      <Form onSubmit={onSubmit}>
        <SupportMarkdownEditor
          control={form.control}
          name="description"
          label="Description"
        />
        <button type="submit">Submit</button>
      </Form>
    </FormProvider>
  );
}

describe('support Markdown', () => {
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

  it('previews without changing the raw Markdown submitted by the form', async () => {
    const submit = vi.fn();
    const user = new TestUserEvent();
    const markdown =
      '## Upload failure\n\n**Details**\n\n```json\n{"error":"denied"}\n```';
    render(<Editor onSubmit={submit} />);
    await user.click(screen.getByRole('textbox', { name: 'Description' }));
    await user.paste(markdown);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      screen.getByRole('region', { name: 'Description preview' }),
    ).toHaveTextContent('Details');
    expect(
      screen.getByRole('heading', { name: 'Upload failure' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Description' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write' }));
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
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
    expect(textbox).toHaveValue('**important**');
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText('important').tagName).toBe('STRONG');
  });
});
