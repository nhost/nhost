import validator from 'validator';

export const validateEmailInputs = (emailsFromInput: string) => {
  if (emailsFromInput.length === 0) {
    return false;
  }

  const emails: string[] = [];
  let checkEmails: boolean[] = [];

  emailsFromInput.split(',').forEach((email) => {
    emails.push(email.replace(' ', ''));
  });
  checkEmails = emails.map((email) => {
    if (!validator.isEmail(email)) {
      return false;
    }
    return true;
  });
  return checkEmails.includes(false);
};

export default validateEmailInputs;
