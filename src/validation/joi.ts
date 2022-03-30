import BaseJoi from 'joi';

export const Joi: BaseJoi.Root = BaseJoi.extend(
  {
    type: 'array',
    base: BaseJoi.array(),
    coerce: {
      from: 'string',
      method(value) {
        if (!value) {
          return { value: [] };
        }
        // TODO: also accept JSON strings
        return { value: value.replace(/^,+|,+$/gm, '').split(',') };
      },
    },
  },
  {
    type: 'object',
    base: BaseJoi.object(),
    coerce: {
      from: 'string',
      method(value) {
        return { value: JSON.parse(value) };
      },
    },
  }
);
