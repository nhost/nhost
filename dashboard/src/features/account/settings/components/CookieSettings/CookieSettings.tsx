import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useCookieConsent,
  withdrawCookieConsent,
} from '@/components/common/CookieConsent';
import {
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { TextLink } from '@/components/ui/v3/text-link';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { getToastStyleProps } from '@/utils/constants/settings';

type CookieChoice = 'all' | 'essential';

function toCookieChoice(consent: boolean | null | undefined) {
  if (consent === true) {
    return 'all';
  }

  if (consent === false) {
    return 'essential';
  }

  return undefined;
}

export default function CookieSettings() {
  const [consent, setConsent] = useCookieConsent();
  const [selectedChoice, setSelectedChoice] = useState<CookieChoice>();

  const savedChoice = toCookieChoice(consent);
  const choice = selectedChoice ?? savedChoice;
  const isWithdrawing = consent === true && choice === 'essential';

  const handleSave = () => {
    if (isWithdrawing) {
      withdrawCookieConsent();
      return;
    }

    setConsent(choice === 'all');
    setSelectedChoice(undefined);
    toast.success(
      'Your cookie preferences have been saved.',
      getToastStyleProps(),
    );
  };

  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        title="Cookies"
        description={
          <>
            Your choice applies to this browser, on nhost.io and the dashboard.{' '}
            <TextLink
              href="https://nhost.io/legal/cookies-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Cookie policy
            </TextLink>
          </>
        }
      />

      <SettingsCardContent>
        <RadioGroup
          aria-label="Cookies"
          value={choice ?? ''}
          onValueChange={(value) =>
            setSelectedChoice(value === 'all' ? 'all' : 'essential')
          }
          className="gap-4"
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="all" id="cookies-all" className="mt-0.5" />
            <Label htmlFor="cookies-all" className="grid gap-1">
              All cookies
              <span className="font-normal text-muted-foreground">
                Essential cookies, plus analytics that help us understand how
                Nhost is used and improve it.
              </span>
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem
              value="essential"
              id="cookies-essential"
              className="mt-0.5"
            />
            <Label htmlFor="cookies-essential" className="grid gap-1">
              Essential only
              <span className="font-normal text-muted-foreground">
                Only the cookies Nhost needs to work.
              </span>
            </Label>
          </div>
        </RadioGroup>

        {isWithdrawing && (
          <p className="text-muted-foreground text-sm">
            Saving reloads the page, so analytics stop running.
          </p>
        )}
      </SettingsCardContent>

      <SettingsCardFooter>
        <Button
          onClick={handleSave}
          disabled={!choice || choice === savedChoice}
          className="w-full sm:w-auto"
        >
          Save
        </Button>
      </SettingsCardFooter>
    </AccountSettingsCard>
  );
}
