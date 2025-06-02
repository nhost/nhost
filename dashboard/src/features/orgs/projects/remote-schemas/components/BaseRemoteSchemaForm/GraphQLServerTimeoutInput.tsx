import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useFormContext, useFormState } from 'react-hook-form';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function GraphQLServerTimeoutInput() {
  const { register } = useFormContext<BaseRemoteSchemaFormValues>();
  const { errors } = useFormState({ name: 'definition.timeout_seconds' });

  return (
    <Box className="space-y-2">
      <Box className="flex flex-row items-center space-x-2">
        <Text>GraphQL Server Timeout</Text>
        <Tooltip title="Configure timeout for your remote GraphQL server. Defaults to 60 seconds.">
          <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
        </Tooltip>
      </Box>
      <Input
        {...register('definition.timeout_seconds')}
        id="definition.timeout_seconds"
        name="definition.timeout_seconds"
        placeholder="60"
        className=""
        hideEmptyHelperText
        error={Boolean(errors['definition.timeout_seconds'])}
        autoComplete="off"
        variant="inline"
        fullWidth
        helperText={
          typeof errors['definition.timeout_seconds']?.message === 'string'
            ? errors['definition.timeout_seconds']?.message
            : ''
        }
        endAdornment={
          <Text sx={{ color: 'grey.500' }} className="pr-2">
            seconds
          </Text>
        }
      />
    </Box>
  );

  //     <div className="flex flex-col gap-1">
  //       <Box className="flex flex-row items-center space-x-2">
  //         <Text>Image</Text>
  //       </Box>

  //       <Box className="flex flex-col gap-1 md:flex-row md:gap-0">
  //   <Select
  //     id="type"
  //     className="col-span-5 lg:col-span-1"
  //     placeholder="HS256"
  //     hideEmptyHelperText
  //     variant="normal"
  //     defaultValue={SYMMETRIC_ALGORITHMS[0]}
  //     error={!!errors.type}
  //     helperText={errors?.type?.message}
  //     label="Hashing algorithm"
  //     value={type}
  //     onChange={(_event, value) =>
  //       setValue('type', value as string, { shouldDirty: true })
  //     }
  //   >
  //     {SYMMETRIC_ALGORITHMS.map((algorithm) => (
  //       <Option key={algorithm} value={algorithm}>
  //         {algorithm}
  //       </Option>
  //     ))}
  //   </Select>
  //         <Input
  //           value={imageTag}
  //           onChange={(e) => setImageTag(e.target.value)}
  //           id="imageTagField"
  //           className="pl-0"
  //           sx={{
  //             [`& .${inputBaseClasses.input}`]: {
  //               paddingLeft: '4px',
  //             },
  //           }}
  //           placeholder="latest"
  //           hideEmptyHelperText
  //           error={!!errors.image}
  //           fullWidth
  //           autoComplete="off"
  //         />
  //       </Box>
  //     </div>
  // );
}
