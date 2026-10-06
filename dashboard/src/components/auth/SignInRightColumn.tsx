import { CircleCheckBig, KeyRound } from 'lucide-react';

export function SignInRightColumn() {
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h2 className="mb-2 font-semibold text-2xl text-foreground">
          Ship 10x faster
        </h2>
        <p className="text-muted-foreground text-sm">
          Skip months of backend setup and focus on building what matters
        </p>
      </div>

      <div className="grid gap-5 rounded-lg border border-white/10 bg-gradient-to-r from-[#0052CD]/10 to-[#FF02F5]/10 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <CircleCheckBig className="text-foreground" size={20} />
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-foreground text-sm">
              From idea to production
            </h3>
            <p className="text-muted-foreground text-xs">
              Everything you need to ship fast, without the setup complexity.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <KeyRound className="text-foreground" size={20} />
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-foreground text-sm">
              Sleep easy at night
            </h3>
            <p className="text-muted-foreground text-xs">
              Rock-solid security so you can focus on building, not
              vulnerabilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
