import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';
import { SignUpWithEmailAndPasswordTab } from '@/features/auth/signup/signup-tabs/signup-with-email-and-password-tab';
import { useState } from 'react';
import SignUpWithSecurityKeyTab from './signup-with-security-key/SignupWithSecurityKeyTab';

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
        {tab === 'password' && <SignUpWithEmailAndPasswordTab />}
        {tab === 'security-key' && <SignUpWithSecurityKeyTab />}
      </div>
    </Tabs>
  );
}

export default SignUpTabs;
