import { useState } from 'react';
import { vi } from 'vitest';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
} from '@/components/ui/v3/multi-select';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

mockPointerEvent();

const OPTIONS = ['a', 'b', 'c'];

function MultiSelectFixture({
  values,
  defaultValues,
  onValuesChange,
}: {
  values?: string[];
  defaultValues?: string[];
  onValuesChange: (values: string[]) => void;
}) {
  return (
    <MultiSelect
      values={values}
      defaultValues={defaultValues}
      onValuesChange={onValuesChange}
    >
      <MultiSelectTrigger aria-label="Options">Select</MultiSelectTrigger>
      <MultiSelectContent search={false}>
        {OPTIONS.map((value) => (
          <MultiSelectItem key={value} value={value}>
            {value}
          </MultiSelectItem>
        ))}
      </MultiSelectContent>
    </MultiSelect>
  );
}

function HydratedMultiSelect({
  onValuesChange,
}: {
  onValuesChange: (values: string[]) => void;
}) {
  const [values, setValues] = useState<string[]>([]);

  return (
    <>
      <button type="button" onClick={() => setValues(['a', 'b'])}>
        Hydrate
      </button>
      <MultiSelectFixture
        values={values}
        onValuesChange={(nextValues) => {
          setValues(nextValues);
          onValuesChange(nextValues);
        }}
      />
    </>
  );
}

async function selectOption(user: TestUserEvent, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Options' }));
  await user.click(screen.getByRole('option', { name: option }));
}

describe('MultiSelect', () => {
  it('preserves controlled values hydrated after mount when selecting', async () => {
    const user = new TestUserEvent();
    const onValuesChange = vi.fn();
    render(<HydratedMultiSelect onValuesChange={onValuesChange} />);

    await user.click(screen.getByRole('button', { name: 'Hydrate' }));
    await selectOption(user, 'c');

    expect(onValuesChange).toHaveBeenCalledOnce();
    expect(onValuesChange).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('preserves uncontrolled default values when selecting', async () => {
    const user = new TestUserEvent();
    const onValuesChange = vi.fn();
    render(
      <MultiSelectFixture
        defaultValues={['a']}
        onValuesChange={onValuesChange}
      />,
    );

    await selectOption(user, 'b');

    expect(onValuesChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('removes an already-selected controlled value', async () => {
    const user = new TestUserEvent();
    const onValuesChange = vi.fn();
    render(
      <MultiSelectFixture
        values={['a', 'b']}
        onValuesChange={onValuesChange}
      />,
    );

    await selectOption(user, 'a');

    expect(onValuesChange).toHaveBeenCalledWith(['b']);
  });
});
