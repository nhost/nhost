import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import useNewSecurityKeyForm from '@/features/account/settings/components/SecurityKeysSettings/hooks/useNewSecurityKeyForm';
import useOnAddNewSecurityKeyHandler from '@/features/account/settings/components/SecurityKeysSettings/hooks/useOnAddNewSecurityKeyHandler';

interface Props {
  onSuccess: () => void;
}

function NewSecurityKeyForm({ onSuccess }: Props) {
  const form = useNewSecurityKeyForm();
  const onSubmit = useOnAddNewSecurityKeyHandler({ onSuccess });
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-flow-row gap-4 bg-transparent"
      >
        <FormField
          control={form.control}
          name="nickname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Name"
                  {...field}
                  className="!bg-transparent"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="outline"
          className="w-full !bg-transparent"
        >
          Add new security key
        </Button>
      </form>
    </Form>
  );
}

export default NewSecurityKeyForm;
