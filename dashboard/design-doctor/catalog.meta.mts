import type { CatalogMeta } from './src/contracts/catalog.mts';

// Keys are public import paths followed by # and the exported name.
// Missing keys stay visible in generated/catalog.md; stale keys fail generation.
export const catalogMeta = {
  '@/components/ui/v3/button#Button': {
    purpose:
      'Styled button with semantic variants, sizes, loading and asChild support.',
    replaces: ['button'],
    dropIn: false,
  },
  '@/components/ui/v3/checkbox#Checkbox': {
    purpose: 'Accessible checkbox backed by Radix.',
    replaces: ['input[type=checkbox]'],
    dropIn: false,
  },
  '@/components/ui/v3/radio-group#RadioGroup': {
    purpose: 'Accessible radio selection group backed by Radix.',
    replaces: ['input[type=radio]'],
    dropIn: false,
  },
  '@/components/ui/v3/input#Input': {
    purpose: 'Styled text input for standalone fields.',
    replaces: ['input'],
    dropIn: false,
  },
  '@/components/form/FormInput#FormInput': {
    purpose: 'Form-managed text input with field validation.',
    replaces: ['input'],
    dropIn: false,
  },
  '@/components/ui/v3/textarea#Textarea': {
    purpose: 'Styled multiline text field.',
    replaces: ['textarea'],
    dropIn: false,
  },
  '@/components/ui/v3/select#Select': {
    purpose:
      'Accessible select root backed by Radix; compose with SelectTrigger and SelectContent.',
    replaces: ['select'],
    dropIn: false,
  },
  '@/components/ui/v3/table#Table': {
    purpose: 'Styled table root and companion table elements.',
    replaces: ['table'],
    dropIn: false,
  },
  '@/components/ui/v3/text-link#TextLink': {
    purpose: 'App-aware navigation link with shared text styling.',
    replaces: ['a'],
    dropIn: false,
  },
} satisfies CatalogMeta;
