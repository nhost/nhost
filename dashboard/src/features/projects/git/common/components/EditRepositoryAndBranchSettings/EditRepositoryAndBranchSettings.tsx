import { Box } from '@/components/ui/v2/Box';
import { QuestionMarkCircleIcon } from '@/components/ui/v2/icons/QuestionMarkCircleIcon';
import { Input } from '@/components/ui/v2/Input';
import { InputLabel } from '@/components/ui/v2/InputLabel';
import { Link } from '@/components/ui/v2/Link';
import type { EditRepositorySettingsFormData } from '@/features/projects/git/common/components/EditRepositorySettings';
import { useFormContext } from 'react-hook-form';

export default function EditRepositoryAndBranchSettings() {
  const { register, formState } =
    useFormContext<EditRepositorySettingsFormData>();

  return (
    <div className="mb-2 flex w-full flex-col pb-1">
      <div className="mt-4 flex flex-col">
        <Box className="border-y py-3">
          <Input
            {...register('productionBranch', {
              required: true,
              pattern: {
                value: /^[a-zA-Z0-9-_/.]+$/,
                message: 'Must contain only letters, hyphens, and numbers.',
              },
            })}
            id="productionBranch"
            label="Deployment Branch"
            required
            variant="inline"
            fullWidth
            error={Boolean(formState.errors?.productionBranch?.message)}
            helperText={formState.errors?.productionBranch?.message}
          />
        </Box>
        <Box className="border-b py-3">
          <Input
            {...register('repoBaseFolder', {
              required: true,
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
                  href="https://docs.nhost.io/platform/github-integration#base-directory"
                  rel="noopener noreferrer"
                  target="_blank"
                  underline="none"
                  aria-label="Base Directory Documentation"
                >
                  <QuestionMarkCircleIcon />
                </Link>
              </InputLabel>
            }
            required
            variant="inline"
            fullWidth
            error={Boolean(formState.errors?.repoBaseFolder?.message)}
            helperText={formState.errors?.repoBaseFolder?.message}
          />
        </Box>
      </div>
    </div>
  );
}
