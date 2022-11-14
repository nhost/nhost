import type { PrefetchNewAppPlansFragment } from '@/generated/graphql';
import { Text } from '@/ui/Text';
import Checkbox from '@/ui/v2/Checkbox';
import { planDescriptions } from '@/utils/planDescriptions';
import { RadioGroup } from '@headlessui/react';
import clsx from 'clsx';
import React from 'react';

interface PlanSelectorProps {
  options: PrefetchNewAppPlansFragment[];
  value: PrefetchNewAppPlansFragment;
  onChange:
    | React.Dispatch<React.SetStateAction<PrefetchNewAppPlansFragment>>
    | any;
}

export function PlanSelector({ options, value, onChange }: PlanSelectorProps) {
  return (
    <RadioGroup value={value} onChange={onChange}>
      <RadioGroup.Label className="sr-only">Pricing plans</RadioGroup.Label>
      <div className="relative  divide-y-1 border-t-1 border-b-1 bg-white">
        {options.map((plan) => (
          <RadioGroup.Option key={plan.name} value={plan}>
            {({ checked }) => (
              <div className="cu flex cursor-pointer flex-row place-content-between items-center py-4 font-display">
                <RadioGroup.Label
                  as="div"
                  className="flex flex-row font-medium"
                >
                  <Checkbox
                    aria-describedby="plan"
                    checked={plan.name === value.name}
                  />

                  <div className="flex w-80">
                    <div className=" self-center pl-2 text-xs font-medium text-greyscaleDark">
                      <span className="font-bold">{plan.name}:</span>{' '}
                      <span className="leading-4">
                        {planDescriptions[plan.name]}
                      </span>
                    </div>
                  </div>
                </RadioGroup.Label>
                <div className="flex">
                  <span
                    className={clsx(
                      'self-center font-medium',
                      checked ? 'text-indigo-900' : 'text-black',
                    )}
                  >
                    <div className="mr-3 self-center text-lg text-greyscaleDark">
                      {plan.isFree ? (
                        'Free'
                      ) : (
                        <div className="flex flex-row">
                          $ {plan.price}{' '}
                          <Text
                            size="tiny"
                            className="ml-1 self-center tracking-wide"
                          >
                            / mo
                          </Text>
                        </div>
                      )}
                    </div>
                  </span>
                </div>
              </div>
            )}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  );
}

export default PlanSelector;
