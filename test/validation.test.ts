import { request } from './server';
import { phoneNumber, redirectTo } from '@/validation';

describe('Unit tests on field validation', () => {
  describe('phone number', () => {
    it('requires a value', () => {
      const error = phoneNumber.validate(undefined).error!;
      expect(error).not.toBeUndefined();
      const {
        details: [{ message }],
      } = error;
      expect(message).toBe('"value" is required');
    });

    it('should not accept an empty phone number', () => {
      const error = phoneNumber.validate('').error!;
      expect(error).not.toBeUndefined();
      const {
        details: [{ message }],
      } = error;
      expect(message).toBe('"value" is not allowed to be empty');
    });

    it('should not accept an invalid phone number', () => {
      const error = phoneNumber.validate('+12345678').error!;
      expect(error).not.toBeUndefined();
      const {
        details: [{ message }],
      } = error;
      expect(message).toBe(
        '"value" failed custom validation because invalid phone number'
      );
    });

    it('should transform a phone number to its international format', () => {
      const { error, value } = phoneNumber.validate('+33140506070')!;
      expect(error).toBeUndefined();
      expect(value).toEqual('+33140506070');
    });

    it("should not accept phone numbers that don't start with '+'", () => {
      const error = phoneNumber.validate('33140506070').error!;
      expect(error).not.toBeUndefined();
      const {
        details: [{ message }],
      } = error;
      expect(message).toBe(
        '"value" failed custom validation because invalid phone number'
      );
    });

    it("should accept phone numbers starts with '00'", () => {
      const { error, value } = phoneNumber.validate('0033140506070')!;
      expect(error).toBeUndefined();
      expect(value).toEqual('+33140506070');
    });
  });

  describe('redirections', () => {
    const clientUrl = 'http://localhost:3000';
    const domain = 'anotherdomain.com';
    const anotherUrl = `https://${domain}/anotherpath`;
    const subdomainUrl = `http://*.${domain}/anotherpath`;
    const otherAllowedRedirects = `${anotherUrl},${subdomainUrl}`;
    beforeAll(async () => {
      await request.post('/change-env').send({
        AUTH_CLIENT_URL: clientUrl,
        AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS: otherAllowedRedirects,
      });
    });

    it('should validate any url when the client url is not set', async () => {
      await request.post('/change-env').send({
        AUTH_CLIENT_URL: '',
      });
      expect(
        redirectTo.validate('http://www.google.com/subpath?key=value').value
      ).toEqual('http://www.google.com/subpath?key=value');
      expect(redirectTo.validate('not-an-url').error).toBeObject();
      await request.post('/change-env').send({
        AUTH_CLIENT_URL: clientUrl,
      });
    });

    it('should validate the client url', () => {
      expect(redirectTo.validate(clientUrl).value).toEqual(clientUrl);
    });

    it('should validate an allowed redirect url', () => {
      expect(redirectTo.validate(anotherUrl).value).toEqual(anotherUrl);
    });

    it('should validate a sub-route', () => {
      expect(redirectTo.validate(`${clientUrl}/sub-route`).value).toEqual(
        `${clientUrl}/sub-route`
      );
      expect(redirectTo.validate(`${anotherUrl}/sub-route`).value).toEqual(
        `${anotherUrl}/sub-route`
      );
    });

    it('should ignore parameters', () => {
      expect(redirectTo.validate(`${clientUrl}?key=value`).value).toEqual(
        `${clientUrl}?key=value`
      );
      expect(redirectTo.validate(`${anotherUrl}?key=value`).value).toEqual(
        `${anotherUrl}?key=value`
      );
    });

    it('should ignore hashes', () => {
      expect(redirectTo.validate(`${clientUrl}#key=value`).value).toEqual(
        `${clientUrl}#key=value`
      );
      expect(redirectTo.validate(`${anotherUrl}#key=value`).value).toEqual(
        `${anotherUrl}#key=value`
      );
    });

    it('should work with wildcards', () => {
      expect(redirectTo.validate(`http://bob.${domain}`).value).toEqual(
        `http://bob.${domain}`
      );
      expect(
        redirectTo.validate(`http://bob.${domain}/sub-route`).value
      ).toEqual(`http://bob.${domain}/sub-route`);
      expect(
        redirectTo.validate(`http://bob.${domain}#key=value`).value
      ).toEqual(`http://bob.${domain}#key=value`);
      expect(
        redirectTo.validate(`http://bob.${domain}?key=value`).value
      ).toEqual(`http://bob.${domain}?key=value`);
    });

    it('should be case insentivite', () => {
      expect(
        redirectTo.validate('https://anotherdomain.com/ANOTHERpath').value
      ).toEqual('https://anotherdomain.com/ANOTHERpath');
      expect(redirectTo.validate('https://ANOTHERdomain.com').value).toEqual(
        'https://ANOTHERdomain.com'
      );
      expect(redirectTo.validate(`${clientUrl}?KEY=VaLuE`).value).toEqual(
        `${clientUrl}?KEY=VaLuE`
      );
      expect(redirectTo.validate(`${clientUrl}#KEY=VaLuE`).value).toEqual(
        `${clientUrl}#KEY=VaLuE`
      );
    });
  });
});
