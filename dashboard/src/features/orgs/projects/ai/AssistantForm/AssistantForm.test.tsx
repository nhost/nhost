import AssistantForm, {
  type AssistantFormInitialData,
} from '@/features/orgs/projects/ai/AssistantForm/AssistantForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  insertAssistant: vi.fn(),
  updateAssistant: vi.fn(),
}));

vi.mock('@/features/orgs/hooks/useRemoteApplicationGQLClient', () => ({
  useRemoteApplicationGQLClient: () => ({}),
}));

vi.mock(
  '@/features/orgs/projects/common/hooks/useIsFileStoreSupported',
  () => ({
    useIsFileStoreSupported: () => ({
      isFileStoreSupported: false,
      loading: false,
    }),
  }),
);

vi.mock('@/generated/graphite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphite')>();

  return {
    ...actual,
    useInsertAssistantMutation: () => [mocks.insertAssistant],
    useUpdateAssistantMutation: () => [mocks.updateAssistant],
  };
});

const ASSISTANT_ID = 'assistant-1';

const baseAssistant = {
  assistantID: ASSISTANT_ID,
  name: 'Support',
  description: 'Answers questions',
  instructions: 'Be helpful',
  model: 'gpt-4o',
};

describe('AssistantForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates an assistant whose data sources are null', async () => {
    mocks.updateAssistant.mockResolvedValue({});
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = new TestUserEvent();

    // The API returns null for assistants without GraphQL or webhook tools.
    const initialData = {
      ...baseAssistant,
      graphql: null,
      webhooks: null,
    } as unknown as AssistantFormInitialData;

    render(
      <AssistantForm
        assistantId={ASSISTANT_ID}
        initialData={initialData}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(mocks.updateAssistant).toHaveBeenCalledTimes(1);
    });

    const { variables } = mocks.updateAssistant.mock.calls[0][0];
    expect(variables.id).toBe(ASSISTANT_ID);
    expect(variables.data).not.toHaveProperty('graphql');
    expect(variables.data).not.toHaveProperty('webhooks');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('updates an assistant whose tool arguments are null', async () => {
    mocks.updateAssistant.mockResolvedValue({});
    const user = new TestUserEvent();

    const initialData = {
      ...baseAssistant,
      graphql: [
        {
          name: 'getTodos',
          description: 'Lists todos',
          query: 'query { todos { id } }',
          arguments: null,
        },
      ],
      webhooks: [
        {
          name: 'notify',
          description: 'Sends a notification',
          URL: 'https://example.com/notify',
          arguments: null,
        },
      ],
    } as unknown as AssistantFormInitialData;

    render(
      <AssistantForm assistantId={ASSISTANT_ID} initialData={initialData} />,
    );

    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(mocks.updateAssistant).toHaveBeenCalledTimes(1);
    });

    const { variables } = mocks.updateAssistant.mock.calls[0][0];
    expect(variables.data.graphql).toEqual([
      expect.objectContaining({ name: 'getTodos', arguments: [] }),
    ]);
    expect(variables.data.webhooks).toEqual([
      expect.objectContaining({ name: 'notify', arguments: [] }),
    ]);
  });
});
