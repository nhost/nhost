import { Button as PrimaryButton } from '@/components/ui/v3/button';
import * as UI from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import DefaultButton from '@/components/ui/v3/button';
import { FormInput } from '@/components/form/FormInput';
import { DatePicker } from '@/components/common/DatePicker';
import { buttonClasses } from './styles';
import { cn } from '@/lib/utils';

const ok = <PrimaryButton className="mt-4" />;
const conditional = <PrimaryButton className={wide ? 'w-full' : 'w-auto'} />;
const helper = <PrimaryButton className={cn('mt-4', wide && 'w-full')} />;
const forwarded = <PrimaryButton className={className} labelClassName={labelClass} />;
const conventions = <PrimaryButton className={props.titleClassName} labelClassName={titleClasses} />;
const pluralConvention = <Input className={localClassNames} />;
const lowerConventions = <Input className={classes} labelClassName={props.classNames} />;
const defaultImport = <DefaultButton className={layout} />; // expect: require-static-classes "DefaultButton layout"
const identifier = <PrimaryButton className={buttonClasses} />; // expect: require-static-classes "PrimaryButton buttonClasses"
const call = <PrimaryButton className={buttonVariants()} />; // expect: require-static-classes "PrimaryButton buttonVariants()"
const callWithArguments = <PrimaryButton className={getClasses(wide, 'base')} />; // expect: require-static-classes "PrimaryButton getClasses()"
const otherCall = <UI.Button className={getClasses()} />; // expect: require-static-classes "UI.Button getClasses()"
const nonExport = <UI.DoesNotExist className={layout} />;
const member = <Input className={styles.root} />; // expect: require-static-classes "Input styles.root"
const layout = <Input className={layout} />; // expect: require-static-classes "Input layout"
const form = <FormInput className={layout} />; // expect: require-static-classes "FormInput layout"
const common = <DatePicker className={styles.root} />; // expect: require-static-classes "DatePicker styles.root"
const plain = <div className={`bg-${color}`} />; // expect: require-static-classes "bg-${…}"
const sized = <Input className={`w-[${width}px]`} />; // expect: require-static-classes "w-[${…}px]"
// expect: require-static-classes "text-${…}"
// expect: require-static-classes "bg-${…}-500"
const twoInterpolations = <div className={`text-${size} bg-${color}-500`} />;
// expect: require-static-classes "w-[${…}"
// expect: require-static-classes "${…}px]"
// expect: require-static-classes "h-[${…}"
// expect: require-static-classes "${…}rem]"
const twoWidths = <div className={`w-[${a}px] h-[${b}rem]`} />;
const nestedExpression = <div className={`w-[${fn({ a })}px]`} />; // expect: require-static-classes "w-[${…}px]"
const touchingExpressions = <div className={`${a}${b}-500`} />; // expect: require-static-classes "${…}-500"
// expect: require-static-classes "${…}xl"
// expect: require-static-classes "text-${…}"
const bothSides = <div className={`${size}xl text-${color}`} />;
// expect: require-static-classes "${…}-0"
// expect: require-static-classes "bg-${…}"
const bothSidesAgain = <div className={`${side}-0 bg-${tone}`} />;
// expect: no-unknown-classes "flex-cols"
// expect: require-static-classes "${…}xl"
const repeats = <div className={`${a}xl flex-cols xl`} />;
const localNamedLikeCatalog = <Button className={layout} />;
const ternaryStatic = <Input className={wide ? 'w-full' : 'w-auto'} />;
const noValue = <Input className={wide ? 'invisible' : undefined} />;
const ternaryFirst = <Input className={wide ? getClasses() : 'w-auto'} />; // expect: require-static-classes "Input getClasses()"
const ternaryLast = <Input className={wide ? 'w-full' : styles.root} />; // expect: require-static-classes "Input styles.root"
// expect: require-static-classes "Input styles.a"
// expect: require-static-classes "Input styles.b"
const bothBranches = <Input className={wide ? styles.a : styles.b} />;
const undefinedLast = <Input className={wide ? layout : undefined} />; // expect: require-static-classes "Input layout"
const undefinedFirst = <Input className={wide ? undefined : layout} />; // expect: require-static-classes "Input layout"
const exemptFirst = <Input className={wide ? activeClassName : layout} />; // expect: require-static-classes "Input layout"
const logical = <Input className={wide && layout} />; // expect: require-static-classes "Input layout"
const otherLogical = <Input className={wide || styles.root} />; // expect: require-static-classes "Input styles.root"
const nullish = <Input className={wide ?? getClasses()} />; // expect: require-static-classes "Input getClasses()"
const logicalStatic = <Input className={wide && 'w-full'} />;
const helperNested = <Input className={cn('w-full', getClasses())} />;
const paired = <PrimaryButton className={layout}>Save</PrimaryButton>; // expect: require-static-classes "PrimaryButton layout"
const separated = <div className={`flex ${color} text-sm`} />;
const concatenated = <Input className={'bg-' + color} />;
const callMember = <Input className={styles.getClasses()} />; // expect: require-static-classes "Input styles.getClasses()"
const formattedMember = (
  // expect: require-static-classes "Input getButtonStyles({variant,size,disabled,}).root"
  <Input className={getButtonStyles({
    variant,
    size,
    disabled,
  }).root} />
);
const formattedCall = (
  // expect: require-static-classes "Input styles.getClasses()"
  <Input className={styles
    .getClasses()} />
);
const formattedConditional = (
  // expect: require-static-classes "Input styles.a"
  // expect: require-static-classes "Input getB()"
  <Input className={wide
    ? styles.a
    : getB(
        wide,
        size,
      )} />
);
const formattedHelperBranch = (
  // expect: require-static-classes "Input layout"
  <Input className={wide
    ? cn(
        'w-full',
        'p-2',
      )
    : layout} />
);
const formattedTemplateBranch = (
  // expect: require-static-classes "Input layout"
  <Input className={wide
    ? `w-full
      p-2`
    : layout} />
);
const optionalForwarded = <Input className={props?.className} labelClassName={props?.titleClassName} />;
const optionalMember = <Input className={x?.y} />; // expect: require-static-classes "Input x?.y"
const staticTemplate = <Input className={`w-full`} />;
const compared = <Input className={value === `bg-${color}` ? 'w-full' : 'w-auto'} />;
const indexed = <Input className={sizes[`bg-${color}`]} />;
const nonHelper = <Input className={getClasses(`bg-${color}`)} />; // expect: require-static-classes "Input getClasses()"
