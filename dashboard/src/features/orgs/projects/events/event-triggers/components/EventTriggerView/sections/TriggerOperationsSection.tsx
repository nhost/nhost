import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';

export default function TriggerOperationsSection({
  eventTrigger,
}: {
  eventTrigger: EventTriggerViewModel;
}) {
  const operations: string[] = [];
  if (eventTrigger.definition.insert) {
    operations.push('Insert');
  }
  if (eventTrigger.definition.update) {
    operations.push('Update');
  }
  if (eventTrigger.definition.delete) {
    operations.push('Delete');
  }
  if (eventTrigger.definition.enable_manual) {
    operations.push('Manual (Dashboard)');
  }

  const insertColumns = Array.isArray(eventTrigger.definition.insert?.columns)
    ? eventTrigger.definition.insert.columns.join(', ')
    : eventTrigger.definition.insert?.columns;

  return (
    <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
        Trigger Operations
      </h3>
      <div className="mb-3 text-sm">
        On <span className="font-mono">{eventTrigger.table.name}</span> table:
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {operations.map((operation) => (
          <span
            key={operation}
            className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-600 dark:text-gray-200"
          >
            {operation}
          </span>
        ))}
      </div>
      {insertColumns && (
        <div className="text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            On Insert Columns:{' '}
          </span>
          <span className="font-mono text-gray-900 dark:text-gray-100">
            {insertColumns}
          </span>
        </div>
      )}
    </div>
  );
}
