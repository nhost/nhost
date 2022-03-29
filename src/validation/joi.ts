import BaseJoi from 'joi';

interface ExtendedStringSchema extends BaseJoi.ArraySchema {
  stringArray(): ExtendedStringSchema;
}

interface ObjectIdJoi extends BaseJoi.Root {
  stringArray(): ExtendedStringSchema;
}

export const Joi: ObjectIdJoi = BaseJoi.extend((joi) => {
  return {
    type: 'stringArray',
    base: joi.array().items(joi.string()).meta({ baseType: 'array' }),
    coerce(value) {
      if (typeof value !== 'string') {
        return value;
      }
      if (!value) {
        return [];
      }
      return { value: value.replace(/^,+|,+$/gm, '').split(',') };
    },
  };
});
