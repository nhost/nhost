export interface UserSelectProps {
  /**
   * Function to be called when the user changes.
   */
  onUserChange: (userId: string, availableRoles?: string[]) => void;
  /**
   * Class name to be applied to the `<Autocomplete />` element.
   */
  className?: string;
}

export default function UserSelect({
  onUserChange,
  ...props
}: UserSelectProps) {
  return (
    <Select
      id="role-select"
      label="Role"
      value={role}
      onChange={(_event, value) => {
        if (typeof value === 'string') {
          setRole(value);
          onRoleChange(value);
        }
      }}
      hideEmptyHelperText
      className="col-span-1 md:col-auto md:w-52"
    >
      {availableRoles.map((availableRole) => (
        <Option value={availableRole} key={availableRole}>
          {availableRole}
        </Option>
      ))}
    </Select>
  );
}
