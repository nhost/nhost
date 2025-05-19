import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { useState } from 'react';
import { SignUpWithEmailAndPasswordForm } from './SignUpWithEmailAndPassword';
import { SignUpWithSecurityKeyForm } from './SignUpWithSecurityKey';

function SignUpTabs() {
  const [tab, setTab] = useState<string>('password');
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="password" className="w-full">
          Sign Up with a Password
        </TabsTrigger>
        <TabsTrigger value="security-key" className="w-full">
          Sign Up with a Security key
        </TabsTrigger>
      </TabsList>
      <div className="pt-7">
        {tab === 'password' && (
          <TabsContent value="password">
            <SignUpWithEmailAndPasswordForm />
          </TabsContent>
        )}
        {tab === 'security-key' && (
          <TabsContent value="security-key">
            <SignUpWithSecurityKeyForm />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}

export default SignUpTabs;
