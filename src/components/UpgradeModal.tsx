import { BottomSheet } from "./BottomSheet";
import { PRO_FEATURES } from "../lib/billing";

interface UpgradeModalProps {
  open: boolean;
  usageCount: number;
  onClose: () => void;
  onUpgrade: () => void;
}

export const UpgradeModal = ({ open, usageCount, onClose, onUpgrade }: UpgradeModalProps) => {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[120] hidden items-center justify-center bg-black/45 p-4 md:flex">
        <div className="w-full max-w-[520px] rounded-3xl border border-white/70 bg-white/92 p-6 shadow-[0_24px_50px_rgba(28,28,30,0.22)] backdrop-blur-xl">
          <p className="text-sm font-semibold text-[#3B82F6]">Free plan limit reached</p>
          <h3 className="mt-2 text-2xl font-semibold text-[#1C1C1E]">Upgrade to Pro to continue</h3>
          <p className="mt-2 text-sm text-[#636366]">
            You have used {usageCount} prompts this month. Free includes 10 prompts per month.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[#1C1C1E]">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="text-[#3B82F6]">✓</span>
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#D1D1D6] bg-white px-4 py-2 text-sm text-[#1C1C1E]"
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={onUpgrade}
              className="rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-5 py-2 text-sm font-semibold text-white"
            >
              Upgrade - $7.99/month
            </button>
          </div>
        </div>
      </div>

      <BottomSheet open={open} onClose={onClose}>
        <p className="text-sm font-semibold text-[#3B82F6]">Free plan limit reached</p>
        <h3 className="mt-2 text-xl font-semibold text-[#1C1C1E]">Upgrade to Pro</h3>
        <p className="mt-2 text-sm text-[#636366]">
          You have used {usageCount} prompts this month. Free includes 10 prompts per month.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-[#1C1C1E]">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <span className="text-[#3B82F6]">✓</span>
              {feature}
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-2 pb-1">
          <button
            type="button"
            onClick={onUpgrade}
            className="w-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-4 py-3 text-sm font-semibold text-white"
          >
            Upgrade - $7.99/month
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-[#D1D1D6] bg-white px-4 py-3 text-sm text-[#1C1C1E]"
          >
            Maybe later
          </button>
        </div>
      </BottomSheet>
    </>
  );
};
