import { phoneNumber } from '@/validation';

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
      expect(value).toEqual('+33 1 40 50 60 70');
    });

    it("should accept phone numbers that don't start with '+'", () => {
      const { error, value } = phoneNumber.validate('33140506070')!;
      expect(error).toBeUndefined();
      expect(value).toEqual('+33 1 40 50 60 70');
    });

    it("should accept phone numbers starts with '00'", () => {
      const { error, value } = phoneNumber.validate('0033140506070')!;
      expect(error).toBeUndefined();
      expect(value).toEqual('+33 1 40 50 60 70');
    });
  });
});
