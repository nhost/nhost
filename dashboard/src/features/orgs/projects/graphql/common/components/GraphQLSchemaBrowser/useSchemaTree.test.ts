import { createRootItems, ROOT_ITEM_ID } from './schemaTreeItems';
import { createTestSchema } from './testSchema';
import { type SchemaTreeState, schemaTreeReducer } from './useSchemaTree';

const schema = createTestSchema();

function createState(): SchemaTreeState {
  return {
    schema,
    items: createRootItems(schema),
    expandedItems: [ROOT_ITEM_ID],
    selectedItems: [],
  };
}

describe('schemaTreeReducer', () => {
  describe('expand', () => {
    it('builds the children of the item and marks it as expanded', () => {
      const state = schemaTreeReducer(createState(), {
        type: 'expand',
        itemId: 'query',
      });

      expect(state.items.query.children).toEqual([
        'query/users',
        'query/search',
      ]);
      expect(state.items['query/users']).toBeDefined();
      expect(state.expandedItems).toEqual([ROOT_ITEM_ID, 'query']);
    });

    it('does not rebuild the children or list the item twice', () => {
      const expanded = schemaTreeReducer(createState(), {
        type: 'expand',
        itemId: 'query',
      });
      const state = schemaTreeReducer(expanded, {
        type: 'expand',
        itemId: 'query',
      });

      expect(state.items).toBe(expanded.items);
      expect(state.expandedItems).toEqual([ROOT_ITEM_ID, 'query']);
    });
  });

  describe('collapse', () => {
    it('unmarks the item as expanded but keeps its children', () => {
      const expanded = schemaTreeReducer(createState(), {
        type: 'expand',
        itemId: 'query',
      });
      const state = schemaTreeReducer(expanded, {
        type: 'collapse',
        itemId: 'query',
      });

      expect(state.expandedItems).toEqual([ROOT_ITEM_ID]);
      expect(state.items).toBe(expanded.items);
    });
  });

  describe('focus and select', () => {
    it('sets the focused item', () => {
      expect(
        schemaTreeReducer(createState(), { type: 'focus', itemId: 'query' })
          .focusedItem,
      ).toBe('query');
    });

    it('replaces the selected items', () => {
      const selected = schemaTreeReducer(createState(), {
        type: 'select',
        itemIds: ['query'],
      });

      expect(
        schemaTreeReducer(selected, { type: 'select', itemIds: ['mutation'] })
          .selectedItems,
      ).toEqual(['mutation']);
    });
  });

  describe('reveal', () => {
    const path = [
      'query',
      'query/users',
      'query/users/posts',
      'query/users/posts/@where',
      'query/users/posts/@where/title',
    ];

    it('builds and expands every ancestor, then focuses and selects the target', () => {
      const state = schemaTreeReducer(createState(), { type: 'reveal', path });

      expect(state.expandedItems).toEqual([ROOT_ITEM_ID, ...path.slice(0, -1)]);
      expect(state.items['query/users/posts/@where/title']).toBeDefined();
      expect(state.focusedItem).toBe('query/users/posts/@where/title');
      expect(state.selectedItems).toEqual(['query/users/posts/@where/title']);
    });

    it('does not expand the target itself', () => {
      const state = schemaTreeReducer(createState(), {
        type: 'reveal',
        path: ['query', 'query/users'],
      });

      expect(state.expandedItems).not.toContain('query/users');
      expect(state.items['query/users'].children).toEqual([]);
    });

    it('reuses ancestors that are already expanded', () => {
      const revealed = schemaTreeReducer(createState(), {
        type: 'reveal',
        path,
      });
      const state = schemaTreeReducer(revealed, {
        type: 'reveal',
        path: [
          'query',
          'query/users',
          'query/users/posts',
          'query/users/posts/title',
        ],
      });

      expect(state.items).toBe(revealed.items);
      expect(state.expandedItems).toEqual(revealed.expandedItems);
      expect(state.selectedItems).toEqual(['query/users/posts/title']);
    });
  });
});
