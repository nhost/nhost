import { useState } from 'react';

// PostgreSQL has a limit of 63 bytes for identifiers
const MAX_TABLE_NAME_LENGTH = 63;

const TableForm = ({ onSubmit, initialValues, ...props }) => {
  // ... existing state and hooks
  const [nameError, setNameError] = useState('');

  // Validate table name
  const validateTableName = (name) => {
    if (name.length > MAX_TABLE_NAME_LENGTH) {
      return `Table name is too long. PostgreSQL limits identifiers to ${MAX_TABLE_NAME_LENGTH} characters.`;
    }
    return '';
  };

  // Handle name change
  const handleNameChange = (e) => {
    const newName = e.target.value;
    setFormValues((prev) => ({ ...prev, name: newName }));
    setNameError(validateTableName(newName));
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate before submission
    const error = validateTableName(formValues.name);
    if (error) {
      setNameError(error);
      return;
    }

    onSubmit(formValues);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... existing form elements */}
      <div className="form-group">
        <label htmlFor="tableName">Table Name</label>
        <input
          id="tableName"
          type="text"
          value={formValues.name}
          onChange={handleNameChange}
          className={nameError ? 'form-control is-invalid' : 'form-control'}
          required
        />
        {nameError && <div className="invalid-feedback">{nameError}</div>}
      </div>

      {/* ... other form fields */}

      <button type="submit" className="btn btn-primary" disabled={!!nameError}>
        Create Table
      </button>
    </form>
  );
};

export default TableForm;
