import { TabsContent } from '@/components/ui/v3/tabs';
import SignupWithSecurityKeyForm from './signup-with-security-key-form/SignupWithSecurityKeyForm';

function SignUpWithSecurityKeyTab() {
  return (
    <TabsContent value="security-key">
      <SignupWithSecurityKeyForm />
    </TabsContent>
  );
}

export default SignUpWithSecurityKeyTab;
