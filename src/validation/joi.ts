import BaseJoi from 'joi';

export const Joi: BaseJoi.Root = BaseJoi.extend(
  {
    type: 'array',
    base: BaseJoi.array(),
    coerce: {
      from: 'string',
      method(value: string) {
        // * If value is empty, return an empty array
        if (!value) {
          return { value: [] };
        }
        try {
          // * Try parsing the array as JSON
          return { value: JSON.parse(value) };
        } catch {
          // * If not a JSON array, assume it is comma-separated
          return { value: value.replace(/^,+|,+$/gm, '').split(',') };
        }
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
