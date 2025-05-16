import { TabsContent } from '@/components/ui/v3/tabs';
import SignUpWithEmailAndPasswordForm from './SignUpWithEmailAndPasswordForm';

function SignUpWithEmailAndPasswordTab() {
  return (
    <TabsContent value="password">
      <SignUpWithEmailAndPasswordForm />
    </TabsContent>
  );
}

export default SignUpWithEmailAndPasswordTab;
