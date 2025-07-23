export function addPresetDefinition(schema: string) {
  return `scalar PresetValue\n
  directive @preset(
      value: PresetValue
  ) on INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION\n
${schema}`;
}
