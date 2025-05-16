import { TabsContent } from '@/components/ui/v3/tabs';
import SignupWithSecurityKeyForm from './SignupWithSecurityKeyForm';

function SignUpWithSecurityKeyTab() {
  return (
    <TabsContent value="security-key">
      <SignupWithSecurityKeyForm />
    </TabsContent>
  );
}

export default SignUpWithSecurityKeyTab;
