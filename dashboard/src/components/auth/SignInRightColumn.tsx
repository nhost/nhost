import Image from 'next/image';

export function SignInRightColumn() {
  return (
    <div className="grid gap-6 font-[Inter]">
      <div className="text-center">
        <h2 className="mb-2 font-semibold text-2xl text-white">
          Ship 10x faster
        </h2>
        <p className="text-[#A2B3BE] text-sm">
          Skip months of backend setup and focus on building what matters
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-gradient-to-r from-[#0052CD]/10 to-[#FF02F5]/10 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Image
              src="/assets/signup/CircleWavyCheck.svg"
              width={20}
              height={20}
              alt="Check"
            />
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-sm text-white">
              From idea to production
            </h3>
            <p className="text-[#A2B3BE] text-xs">
              Everything you need to ship fast, without the setup complexity.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-gradient-to-r from-[#0052CD]/10 to-[#FF02F5]/10 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Image
              src="/assets/key.svg"
              width={20}
              height={20}
              alt="Security"
            />
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-sm text-white">
              Sleep easy at night
            </h3>
            <p className="text-[#A2B3BE] text-xs">
              Rock-solid security so you can focus on building, not
              vulnerabilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
