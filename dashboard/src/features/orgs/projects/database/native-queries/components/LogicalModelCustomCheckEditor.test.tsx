import { StrictMode, useState } from 'react';
import { vi } from 'vitest';
import type { CustomCheckEditorMode } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/CustomCheckModeProvider';
import CustomCheckModeToggle from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/CustomCheckModeToggle';
import {
  LogicalModelCustomCheckEditor,
  LogicalModelCustomCheckEditorProvider,
} from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditor';
import type { LogicalModelFieldResolution } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import {
  fireEvent,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({
    useTableSchemaQuery: () => {
      throw new Error('Logical editors must not use table schema hooks');
    },
  }),
);

vi.mock('@/features/orgs/projects/common/hooks/useExportMetadata', () => ({
  useExportMetadata: () => {
    throw new Error('Logical editors must not use metadata hooks');
  },
}));

const fields: LogicalModelFieldResolution = {
  descriptors: [
    {
      kind: 'scalar',
      name: 'age',
      path: 'age',
      nullable: false,
      selectable: true,
      scalar: 'int4',
    },
    {
      kind: 'scalar',
      name: 'name',
      path: 'name',
      nullable: true,
      selectable: true,
      scalar: 'text',
    },
  ],
  selectablePaths: ['age', 'name'],
  traversalPaths: [],
  issues: [],
};

interface EditorHarnessProps {
  initialValue: Record<string, unknown>;
  mode?: CustomCheckEditorMode;
  onChange: (value: Record<string, unknown>) => void;
  onValidityChange?: (valid: boolean) => void;
  showToggle?: boolean;
  fieldResolution?: LogicalModelFieldResolution;
}

function EditorHarness({
  initialValue,
  mode = 'builder',
  onChange,
  onValidityChange,
  showToggle = false,
  fieldResolution = fields,
}: EditorHarnessProps) {
  const [value, setValue] = useState(initialValue);
  const [selectedMode, setSelectedMode] = useState(mode);

  return (
    <LogicalModelCustomCheckEditorProvider
      mode={selectedMode}
      onModeChange={setSelectedMode}
    >
      {showToggle ? <CustomCheckModeToggle /> : null}
      <LogicalModelCustomCheckEditor
        value={value}
        fields={fieldResolution}
        onChange={(nextValue) => {
          onChange(nextValue);
          setValue(nextValue);
        }}
        onValidityChange={onValidityChange}
      />
    </LogicalModelCustomCheckEditorProvider>
  );
}

async function selectOption(label: string, option: string) {
  const user = new TestUserEvent();
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('LogicalModelCustomCheckEditor', () => {
  beforeEach(() => {
    mockPointerEvent();
  });

  it('does not emit on Strict Mode mount, mode changes, or a no-op rerender', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <StrictMode>
        <EditorHarness
          initialValue={{ age: { _eq: 1 } }}
          onChange={onChange}
          showToggle
        />
      </StrictMode>,
    );

    expect(onChange).not.toHaveBeenCalled();
    const user = new TestUserEvent();
    await user.click(screen.getByRole('button', { name: 'JSON' }));
    await user.click(screen.getByRole('button', { name: 'Visual' }));
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <StrictMode>
        <EditorHarness
          initialValue={{ age: { _eq: 1 } }}
          onChange={onChange}
          showToggle
        />
      </StrictMode>,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('invalidates a queued visual commit on unmount and commits after a Strict Mode remount', async () => {
    const onChange = vi.fn();
    const firstRender = render(
      <StrictMode>
        <EditorHarness
          initialValue={{ name: { _eq: '' } }}
          onChange={onChange}
        />
      </StrictMode>,
    );

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Logical model value' }),
      { target: { value: 'stale' } },
    );
    firstRender.unmount();
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();

    render(
      <StrictMode>
        <EditorHarness
          initialValue={{ name: { _eq: '' } }}
          onChange={onChange}
        />
      </StrictMode>,
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Logical model value' }),
      { target: { value: 'current' } },
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith({ name: { _eq: 'current' } });
  });

  it('resets the visual tree for an external raw replacement without emitting', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <LogicalModelCustomCheckEditorProvider mode="builder">
        <LogicalModelCustomCheckEditor
          value={{ age: { _eq: 1 } }}
          fields={fields}
          onChange={onChange}
        />
      </LogicalModelCustomCheckEditorProvider>,
    );

    rerender(
      <LogicalModelCustomCheckEditorProvider mode="builder">
        <LogicalModelCustomCheckEditor
          value={{ name: { _ilike: 'A%' } }}
          fields={fields}
          onChange={onChange}
        />
      </LogicalModelCustomCheckEditorProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Logical model field' }),
      ).toHaveTextContent('name');
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('coalesces a field change with its operator and value reset', async () => {
    const onChange = vi.fn();
    render(
      <EditorHarness initialValue={{ age: { _gt: 18 } }} onChange={onChange} />,
    );

    await selectOption('Logical model field', 'name');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    expect(onChange).toHaveBeenLastCalledWith({ name: { _eq: null } });
  });

  it('emits one canonical Boolean value when selecting _is_null', async () => {
    const onChange = vi.fn();
    render(
      <EditorHarness initialValue={{ age: { _eq: 1 } }} onChange={onChange} />,
    );

    await selectOption('Logical model operator', '_is_null');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    expect(onChange).toHaveBeenLastCalledWith({ age: { _is_null: true } });
  });

  it('adds and removes root and nested groups without intermediate values', async () => {
    const onChange = vi.fn();
    const user = new TestUserEvent();
    render(<EditorHarness initialValue={{}} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Add check' }));
    await user.click(await screen.findByText('AND group'));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith({ _and: [] });

    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(await screen.findByText('OR group'));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(onChange).toHaveBeenLastCalledWith({ _and: [{ _or: [] }] });

    await user.click(
      screen.getAllByRole('button', { name: 'Delete group' })[1],
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(3));
    expect(onChange).toHaveBeenLastCalledWith({ _and: [] });

    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(await screen.findByText('OR group'));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));

    await user.click(
      screen.getAllByRole('combobox', { name: 'Logical group operator' })[0],
    );
    await user.click(await screen.findByRole('option', { name: 'NOT' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(5));
    expect(onChange).toHaveBeenLastCalledWith({ _not: { _or: [] } });

    await user.click(
      screen.getAllByRole('button', { name: 'Delete group' })[0],
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(6));
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('keeps the value input focused and emits each raw-changing edit', async () => {
    const onChange = vi.fn();
    render(
      <EditorHarness
        initialValue={{ name: { _eq: '' } }}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Logical model value' });

    const user = new TestUserEvent();
    await user.type(input, 'ab');

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(input).toHaveFocus();
    expect(onChange).toHaveBeenNthCalledWith(1, { name: { _eq: 'a' } });
    expect(onChange).toHaveBeenNthCalledWith(2, { name: { _eq: 'ab' } });
  });

  it('accepts primitive arrays and session-variable strings as logical values', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <EditorHarness
        key="array-value"
        initialValue={{ age: { _in: [] } }}
        onChange={onChange}
      />,
    );
    const valueInput = screen.getByRole('textbox', {
      name: 'Logical model value',
    });

    await TestUserEvent.fireTypeEvent(valueInput, '[1,2]');
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith({ age: { _in: [1, 2] } });

    onChange.mockClear();
    rerender(
      <EditorHarness
        key="session-value"
        initialValue={{ name: { _eq: '' } }}
        onChange={onChange}
      />,
    );
    await TestUserEvent.fireTypeEvent(
      screen.getByRole('textbox', { name: 'Logical model value' }),
      'X-Hasura-User-Id',
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith({
      name: { _eq: 'X-Hasura-User-Id' },
    });
  });

  it('preserves the JSON draft, cursor, and focus when a controlled parent echoes commits', async () => {
    const onChange = vi.fn();
    render(
      <EditorHarness
        initialValue={{ age: { _eq: 1 } }}
        mode="json"
        onChange={onChange}
      />,
    );
    const textarea = screen.getByRole('textbox', {
      name: 'Filter JSON',
    }) as HTMLTextAreaElement;
    const initialDraft = textarea.value;
    const user = new TestUserEvent();

    textarea.focus();
    textarea.setSelectionRange(1, 1);
    await user.keyboard(' ');
    expect(onChange).not.toHaveBeenCalled();

    const draftWithWhitespace = `${initialDraft.slice(0, 1)} ${initialDraft.slice(1)}`;
    const valuePosition = draftWithWhitespace.lastIndexOf('1') + 1;
    textarea.setSelectionRange(valuePosition, valuePosition);
    await user.keyboard('0');

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith({ age: { _eq: 10 } });
    expect(textarea).toHaveValue(
      `${draftWithWhitespace.slice(0, valuePosition)}0${draftWithWhitespace.slice(valuePosition)}`,
    );
    expect(textarea).toHaveFocus();
    expect(textarea.selectionStart).toBe(valuePosition + 1);

    await user.keyboard('1');

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(onChange).toHaveBeenLastCalledWith({ age: { _eq: 101 } });
    expect(textarea).toHaveFocus();
    expect(textarea.selectionStart).toBe(valuePosition + 2);
  });

  it('commits supported and unsupported JSON exactly and recovers from invalid JSON', async () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();
    render(
      <EditorHarness
        initialValue={{ age: { _eq: 1 } }}
        mode="json"
        onChange={onChange}
        onValidityChange={onValidityChange}
      />,
    );
    const textarea = screen.getByRole('textbox', { name: 'Filter JSON' });

    await TestUserEvent.fireTypeEvent(textarea, '{ invalid');
    expect(onChange).not.toHaveBeenCalled();
    expect(onValidityChange).toHaveBeenLastCalledWith(false);

    await TestUserEvent.fireTypeEvent(textarea, '{"_exists":{"custom":1}}');
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith({ _exists: { custom: 1 } });
    expect(onValidityChange).toHaveBeenLastCalledWith(true);

    await TestUserEvent.fireTypeEvent(textarea, '{"unknown":{"shape":2}}');
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(onChange).toHaveBeenLastCalledWith({ unknown: { shape: 2 } });
  });

  it('rebuilds the visual tree after unsupported JSON becomes supported', async () => {
    const onChange = vi.fn();
    const user = new TestUserEvent();
    render(
      <EditorHarness
        initialValue={{ custom: { unsupported: true } }}
        mode="json"
        onChange={onChange}
        showToggle
      />,
    );
    const textarea = screen.getByRole('textbox', { name: 'Filter JSON' });

    await TestUserEvent.fireTypeEvent(textarea, '{"name":{"_eq":"Ada"}}');
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Visual' }));

    expect(
      await screen.findByRole('combobox', { name: 'Logical model field' }),
    ).toHaveTextContent('name');
    expect(
      screen.getByRole('textbox', { name: 'Logical model value' }),
    ).toHaveValue('Ada');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('discards an invalid JSON draft on external replacement without emitting', async () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();
    const { rerender } = render(
      <LogicalModelCustomCheckEditorProvider mode="json">
        <LogicalModelCustomCheckEditor
          value={{ age: { _eq: 1 } }}
          fields={fields}
          onChange={onChange}
          onValidityChange={onValidityChange}
        />
      </LogicalModelCustomCheckEditorProvider>,
    );
    const textarea = screen.getByRole('textbox', { name: 'Filter JSON' });
    await TestUserEvent.fireTypeEvent(textarea, '{ nope');
    onChange.mockClear();
    onValidityChange.mockClear();

    rerender(
      <LogicalModelCustomCheckEditorProvider mode="json">
        <LogicalModelCustomCheckEditor
          value={{ name: { _ilike: 'A%' } }}
          fields={fields}
          onChange={onChange}
          onValidityChange={onValidityChange}
        />
      </LogicalModelCustomCheckEditorProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Filter JSON' })).toHaveValue(
        JSON.stringify({ name: { _ilike: 'A%' } }, null, 2),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText('Invalid JSON')).not.toBeInTheDocument();
  });

  it('disables node authoring when there are no selectable paths', () => {
    const onChange = vi.fn();
    const arrayOnlyFields: LogicalModelFieldResolution = {
      descriptors: [],
      selectablePaths: [],
      traversalPaths: [],
      issues: [{ code: 'array', path: 'tags' }],
    };

    render(
      <EditorHarness
        initialValue={{}}
        fieldResolution={arrayOnlyFields}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add check' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers only logical fields and Boolean groups without invoking table hooks', async () => {
    const onChange = vi.fn();
    const user = new TestUserEvent();
    render(<EditorHarness initialValue={{}} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Add check' }));

    expect(await screen.findByText('age')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.queryByText(/exists/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/relationship/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/computed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/limit/i)).not.toBeInTheDocument();
  });
});
