import { useState } from 'react';
import { validateTableName } from '../../utils/tableNameValidation';

interface CreateTableFormProps {
  onSubmit: (tableName: string) => void;
  onCancel: () => void;
}

export function CreateTableForm({ onSubmit, onCancel }: CreateTableFormProps) {
  const [tableName, setTableName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateTableName(tableName);
    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit(tableName);
  };

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">Create a New Table</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="tableName" className="mb-2 block">
            Name
          </label>
          <input
            id="tableName"
            type="text"
            value={tableName}
            onChange={(e) => {
              setTableName(e.target.value);
              setError(null); // Clear error when input changes
            }}
            className={`w-full rounded border p-2 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {error && <div className="mt-2 text-sm text-red-500">{error}</div>}
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-blue-500 px-4 py-2 text-white"
          >
            Create Table
          </button>
        </div>
      </form>
    </div>
  );
}
