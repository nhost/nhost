import { useFormContext } from 'react-hook-form';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { InputLabel } from '@/components/ui/v2/InputLabel';
import { QuestionMarkCircleIcon } from '@/components/ui/v2/icons/QuestionMarkCircleIcon';
import { Link } from '@/components/ui/v2/Link';
import type { EditRepositorySettingsFormData } from '@/features/orgs/projects/git/common/components/EditRepositorySettings';

export interface EditRepositoryAndBranchSettingsProps {
  disabled?: boolean;
}

export default function EditRepositoryAndBranchSettings({
  disabled,
}: EditRepositoryAndBranchSettingsProps) {
  const { register, formState } =
    useFormContext<EditRepositorySettingsFormData>();

  return (
    <div className="mb-2 flex w-full flex-col pb-1">
      <div className="mt-4 flex flex-col">
        <Box className="border-y py-3">
          <Input
            {...register('productionBranch', {
              required: !disabled,
              pattern: {
                value: /^[a-zA-Z0-9-_/.]+$/,
                message: 'Must contain only letters, hyphens, and numbers.',
              },
            })}
            id="productionBranch"
            label="Deployment Branch"
            required={!disabled}
            variant="inline"
            fullWidth
            disabled={disabled}
            error={Boolean(formState.errors?.productionBranch?.message)}
            helperText={formState.errors?.productionBranch?.message}
          />
        </Box>
        <Box className="border-b py-3">
          <Input
            {...register('repoBaseFolder', {
              required: !disabled,
              pattern: {
                value: /^[a-zA-Z0-9-_/.]+$/,
                message: 'Must contain only letters, hyphens, and numbers.',
              },
            })}
            id="repoBaseFolder"
            label={
              <InputLabel
                htmlFor="repoBaseFolder"
                className="grid grid-flow-col items-center gap-1"
              >
                Base Directory{' '}
                <Link
                  href="https://docs.nhost.io/platform/cloud/deployments#base-directory"
                  rel="noopener noreferrer"
                  target="_blank"
                  underline="none"
                  aria-label="Base Directory Documentation"
                >
                  <QuestionMarkCircleIcon />
                </Link>
              </InputLabel>
            }
            required={!disabled}
            variant="inline"
            fullWidth
            disabled={disabled}
            error={Boolean(formState.errors?.repoBaseFolder?.message)}
            helperText={formState.errors?.repoBaseFolder?.message}
          />
        </Box>
      </div>
    </div>
  );
}
