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
    const domain = 'allowed.com';
    const protocolDomain = 'protocol.com';
    const anyPortDomain = 'port.com';
    const anotherUrl = `https://${domain}/allowed`;
    const protocolUrl = `http?(s)://${protocolDomain}`;
    const subdomainUrl = `https://*.${domain}/allowed`;
    const anyportUrl = `https://${anyPortDomain}?(:{1..65536})`;
    const otherAllowedRedirects = `${anotherUrl},${subdomainUrl},${protocolUrl}`;

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
        redirectTo.validate('https://www.google.com/subpath?key=value').value
      ).toEqual('https://www.google.com/subpath?key=value');

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
      expect(redirectTo.validate(`https://bob.${domain}`).value).toEqual(
        `https://bob.${domain}`
      );
      expect(
        redirectTo.validate(`https://bob.${domain}/sub-route`).value
      ).toEqual(`https://bob.${domain}/sub-route`);
      expect(
        redirectTo.validate(`https://bob.${domain}#key=value`).value
      ).toEqual(`https://bob.${domain}#key=value`);
      expect(
        redirectTo.validate(`https://bob.${domain}?key=value`).value
      ).toEqual(`https://bob.${domain}?key=value`);
    });

    it('should be case insentivite', () => {
      expect(redirectTo.validate('https://allowed.com/ALLOWED').value).toEqual(
        'https://allowed.com/ALLOWED'
      );
      expect(redirectTo.validate('https://ALLOWED.com').value).toEqual(
        'https://ALLOWED.com'
      );
      expect(redirectTo.validate(`${clientUrl}?KEY=VaLuE`).value).toEqual(
        `${clientUrl}?KEY=VaLuE`
      );
      expect(redirectTo.validate(`${clientUrl}#KEY=VaLuE`).value).toEqual(
        `${clientUrl}#KEY=VaLuE`
      );
    });

    it('should reject an invalid url', () => {
      expect(redirectTo.validate('not-an-url').error).toBeObject();
    });

    it('should reject url with the wrong port', () => {
      expect(redirectTo.validate(`https://localhost:9999`).error).toBeObject();
      expect(
        redirectTo.validate(`https://${domain}:9999/allowed`).error
      ).toBeObject();
    });

    it('should reject url with the wrong path', () => {
      expect(redirectTo.validate(`https://${domain}/wrong`).error).toBeObject();
    });

    it('should reject url with the wrong protocol', () => {
      expect(redirectTo.validate(`https://localhost:3000`).error).toBeObject();
      expect(redirectTo.validate(`link://localhost:3000`).error).toBeObject();
    });

    it('should accept both http and https when set', () => {
      expect(redirectTo.validate(`https://${protocolDomain}`).value).toEqual(
        `https://${protocolDomain}`
      );
      expect(redirectTo.validate(`http://${protocolDomain}`).value).toEqual(
        `http://${protocolDomain}`
      );
    });

    it('should accept any port when set', () => {
      expect(redirectTo.validate(`https://${anyportUrl}`).value).toEqual(
        `https://${anyportUrl}`
      );
      expect(redirectTo.validate(`https://${anyportUrl}:80`).value).toEqual(
        `https://${anyportUrl}:80`
      );
      expect(redirectTo.validate(`https://${anyportUrl}:8080`).value).toEqual(
        `https://${anyportUrl}:8080`
      );
    });

    it('should reject sub-subdomains', () => {
      expect(
        redirectTo.validate(`https://bob.thebuilder.${domain}/allowed`).error
      ).toBeObject();
    });

    it('should reject shadowing domains', async () => {
      expect(
        redirectTo.validate(`https://protocol.com.example.com`).error
      ).toBeObject();

      expect(
        redirectTo.validate(`https://wwwaprotocol.com`).error
      ).toBeObject();
    });
  });
});
