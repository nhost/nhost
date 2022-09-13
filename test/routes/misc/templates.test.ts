import { renderTemplate } from '@/templates';

describe('templates', () => {
  it('should render proper sms template', async () => {
    const template = 'signin-passwordless-sms';
    const message = await renderTemplate(`${template}/text`, {
      locale: 'en',
      displayName: 'John Doe',
      code: '123456',
    });

    expect(message).toEqual('Your code is 123456.');
  });

  it('ensure that not always fallback message is used for sms template', async () => {
    const template = 'signin-passwordless-sms';
    const message = await renderTemplate(`${template}/text`, {
      locale: 'fr',
      displayName: 'John Doe',
      code: '123456',
    });

    expect(message).toEqual('Votre code est 123456.');
  });
});
