import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react'
import { validateEmail, validateRequiredField } from '@helpers/formFieldValidators'
import { ReactElement } from 'react'
import { useForm } from 'react-hook-form'

export interface FormData {
  email: string
  password: string
}

export interface EmailPasswordFormProps {
  onSubmit: (data: FormData) => Promise<void> | void
  formStatus: string | null
  action?: () => void
  buttonLabel: string
}

const EmailPasswordForm = ({
  onSubmit,
  formStatus,
  action,
  buttonLabel,
}: EmailPasswordFormProps): ReactElement => {
  const {
    handleSubmit,
    register,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const handleEmailValidation = (value: string): string | boolean => {
    return validateEmail(value, action)
  }

  const handlePasswordValidation = (value: string): string | boolean => {
    return validateRequiredField({ value, fieldName: 'Password', fn: action })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack direction="column" spacing={6}>
        <FormControl isInvalid={!!errors.email}>
          <FormLabel htmlFor="email">Email</FormLabel>
          <Input
            placeholder="you@email.com"
            {...register('email', { validate: handleEmailValidation })}
          />
          <FormErrorMessage>{errors.email?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.password}>
          <FormLabel htmlFor="password">Password</FormLabel>
          <Input
            type="password"
            {...register('password', {
              validate: handlePasswordValidation,
            })}
          />
          <FormErrorMessage>{errors.password?.message}</FormErrorMessage>
        </FormControl>

        <Button type="submit" colorScheme="blue" isLoading={isSubmitting}>
          {buttonLabel}
        </Button>
        {formStatus !== null && (
          <Text color="red.500" size="xs" textAlign="center" my={6}>
            {formStatus}
          </Text>
        )}
      </Stack>
    </form>
  )
}

export default EmailPasswordForm
