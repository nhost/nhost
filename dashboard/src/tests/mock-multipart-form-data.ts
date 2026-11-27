import { FormData as NodeFormData } from 'undici';

export function mockMultipartFormData() {
  const methods = ['arrayBuffer', 'text', 'stream'] as const;
  const original = Object.getOwnPropertyDescriptors(Blob.prototype);
  const originalFormData = Object.getOwnPropertyDescriptor(
    globalThis,
    'FormData',
  );
  beforeAll(() => {
    // jsdom's Blob lacks the read methods needed by Node fetch's multipart encoder.
    Object.defineProperties(Blob.prototype, {
      arrayBuffer: {
        configurable: true,
        value(this: Blob): Promise<ArrayBuffer> {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(this);
          });
        },
      },
      text: {
        configurable: true,
        async value(this: Blob): Promise<string> {
          return new TextDecoder().decode(await this.arrayBuffer());
        },
      },
      stream: {
        configurable: true,
        value(this: Blob): ReadableStream<Uint8Array> {
          const blob = this;
          return new ReadableStream({
            async start(controller) {
              controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
              controller.close();
            },
          });
        },
      },
    });
  });
  beforeEach(() => {
    Object.defineProperty(globalThis, 'FormData', {
      configurable: true,
      writable: true,
      value: NodeFormData,
    });
  });
  afterEach(() => {
    if (originalFormData) {
      Object.defineProperty(globalThis, 'FormData', originalFormData);
    } else {
      Reflect.deleteProperty(globalThis, 'FormData');
    }
  });
  afterAll(() => {
    for (const method of methods) {
      const descriptor = original[method];
      if (descriptor) {
        Object.defineProperty(Blob.prototype, method, descriptor);
      } else {
        Reflect.deleteProperty(Blob.prototype, method);
      }
    }
  });
}
