export function prependPresetDirectiveSDL(schema: string) {
  const presetDirectiveSDL = `scalar PresetValue\n
    directive @preset(
        value: PresetValue
    ) on INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION\n
${schema}`;
  return presetDirectiveSDL;
}
