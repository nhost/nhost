import { CircleHelp as QuestionMarkCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import type { EditRepositorySettingsFormData } from '@/features/orgs/projects/git/common/components/EditRepositorySettings';
import { cn } from '@/lib/utils';

export interface EditRepositoryAndBranchSettingsProps {
  disabled?: boolean;
}

export default function EditRepositoryAndBranchSettings({
  disabled,
}: EditRepositoryAndBranchSettingsProps) {
  const { register, formState } =
    useFormContext<EditRepositorySettingsFormData>();

  const productionBranchError = formState.errors?.productionBranch?.message;
  const repoBaseFolderError = formState.errors?.repoBaseFolder?.message;

  return (
    <div className="mb-2 flex w-full flex-col pb-1">
      <div className="mt-4 flex flex-col">
        <div className="border-y py-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center">
            <Label htmlFor="productionBranch">Deployment Branch</Label>
            <div className="grid gap-1">
              <Input
                {...register('productionBranch', {
                  required: !disabled,
                  pattern: {
                    value: /^[a-zA-Z0-9-_/.]+$/,
                    message: 'Must contain only letters, hyphens, and numbers.',
                  },
                })}
                id="productionBranch"
                required={!disabled}
                disabled={disabled}
                aria-invalid={Boolean(productionBranchError)}
                className={cn(productionBranchError && 'border-destructive')}
              />
              {productionBranchError ? (
                <p className="font-medium text-destructive text-xs">
                  {productionBranchError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="border-b py-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center">
            <Label
              htmlFor="repoBaseFolder"
              className="grid grid-flow-col items-center justify-start gap-1"
            >
              Base Directory{' '}
              <Link
                href="https://docs.nhost.io/platform/cloud/deployments#base-directory"
                rel="noopener noreferrer"
                target="_blank"
                aria-label="Base Directory Documentation"
                className="text-primary"
              >
                <QuestionMarkCircleIcon className="h-4 w-4" />
              </Link>
            </Label>
            <div className="grid gap-1">
              <Input
                {...register('repoBaseFolder', {
                  required: !disabled,
                  pattern: {
                    value: /^[a-zA-Z0-9-_/.]+$/,
                    message: 'Must contain only letters, hyphens, and numbers.',
                  },
                })}
                id="repoBaseFolder"
                required={!disabled}
                disabled={disabled}
                aria-invalid={Boolean(repoBaseFolderError)}
                className={cn(repoBaseFolderError && 'border-destructive')}
              />
              {repoBaseFolderError ? (
                <p className="font-medium text-destructive text-xs">
                  {repoBaseFolderError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
