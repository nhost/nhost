import type { CreateModalBaseProps } from '@/components/applications/users/permissions/modal/CreatePermissionVariableModalBase';
import { Input } from '@/ui';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { Controller, useFormContext } from 'react-hook-form';

export interface CreateUserRoleBaseFormData {
  roleName: string;
}

export type CreateUserRoleModalBaseProps =
  CreateModalBaseProps<CreateUserRoleBaseFormData>;
export type CreateUserRoleModal = Pick<CreateUserRoleModalBaseProps, 'onClose'>;

export function CreateUserRoleModalBase({
  title,
  type,
  onRemove,
  onSubmit,
  errorComponent,
}: CreateUserRoleModalBaseProps) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useFormContext<CreateUserRoleBaseFormData>();

  return (
    <div className="w-modal- p-6 text-left">
      <div className="mx-auto items-center justify-between">
        <Text
          variant="heading"
          className="text-center text-lg font-medium text-greyscaleDark"
        >
          {title}
        </Text>
      </div>

      {errorComponent}

      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        <div className="mt-3 mb-3 divide-y border-t border-b py-1">
          <div className="flex flex-row place-content-between py-2">
            <div className="flex w-full flex-row">
              <Text
                color="greyscaleDark"
                className="self-center font-medium"
                size="normal"
              >
                New Role Name
              </Text>
            </div>
            <div className="flex w-full">
              <Controller
                name="roleName"
                control={control}
                rules={{
                  required: true,
                  pattern: {
                    value: /^[a-zA-Z0-9-_]+$/,
                    message: 'Must contain only letters, hyphens, and numbers.',
                  },
                }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="roleName"
                    required
                    value={field.value || ''}
                    onChange={(value: string) => {
                      if (value && !/^[a-zA-Z0-9-_]+$/gi.test(value)) {
                        // prevent the user from entering invalid characters
                        return;
                      }

                      field.onChange(value);
                    }}
                  />
                )}
              />
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          <Button
            variant="primary"
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {type === 'create' ? 'Create New User Role' : 'Save Changes'}
          </Button>
          {type === 'edit' && onRemove && (
            <Button variant="menu" border onClick={onRemove}>
              <Text className="text-sm+ font-medium text-red">Remove Role</Text>
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
