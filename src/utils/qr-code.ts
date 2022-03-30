import QRCode from 'qrcode';

/**
 * Create QR code.
 * @param secret Required OTP secret.
 */
export function createQR(secret: string): Promise<string> {
  return QRCode.toDataURL(secret);
}
