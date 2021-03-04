export const validateEmail = (value: string, fn?: () => void): string | boolean => {
  const pattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i
  fn?.()

  if (!value.trim().length) {
    return 'Email is required'
  } else if (!pattern.test(value)) {
    return 'Invalid email address'
  } else {
    return true
  }
}

interface FieldValidationProps {
  value: string
  fieldName: string
  fn?: () => void
}

export const validateRequiredField = ({
  value,
  fieldName,
  fn,
}: FieldValidationProps): string | boolean => {
  fn?.()

  if (!value.trim().length) {
    return `${fieldName} is required`
  } else {
    return true
  }
}
