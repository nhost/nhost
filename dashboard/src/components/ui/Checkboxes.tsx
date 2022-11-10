import { Text } from './Text';

interface CheckboxesProps {
  id: string;
  name?: string;
  state: boolean;
  setState: any;
  checkBoxText?: string;
  tiny?: boolean;
}

// @NOTES: Probably what I want to pass to this component is an array of CHECKBOX;

export default function CheckBoxes({
  id,
  name,
  state,
  setState,
  checkBoxText = "I'm sure",
  tiny,
}: CheckboxesProps) {
  return (
    <fieldset className="space-y-2 py-1">
      <label
        className="relative flex cursor-pointer items-start py-1"
        htmlFor={id}
      >
        <div className="flex h-5 items-center self-center">
          <input
            id={id}
            aria-describedby={id}
            name={name}
            type="checkbox"
            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue focus:ring-0"
            defaultChecked={state}
            onClick={() => setState(!state)}
          />
        </div>
        <div className="ml-3">
          <Text
            variant="body"
            color="greyscaleDark"
            size={tiny ? 'tiny' : 'normal'}
          >
            {checkBoxText}
          </Text>
        </div>
      </label>
    </fieldset>
  );
}
