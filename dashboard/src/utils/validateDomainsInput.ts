import validator from 'validator';

export const validateDomainsInput = (domainsFromInput: string) => {
  if (domainsFromInput.length === 0) {
    return false;
  }

  const domains: string[] = [];
  let checkedDomains: boolean[] = [];

  domainsFromInput.split(',').forEach((email) => {
    domains.push(email.replace(' ', ''));
  });
  checkedDomains = domains.map((domain) => {
    if (!validator.isFQDN(domain)) {
      return false;
    }
    return true;
  });
  return checkedDomains.includes(false);
};

export default validateDomainsInput;
