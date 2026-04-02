import { Link } from "react-router-dom";

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export const AuthLogo = () => {
  return (
    <Link to="/" className="block no-underline">
      <div className="flex items-center gap-3">
        {/* Gradient icon badge */}
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #3B82F6 0%, #A78BFA 100%)",
            boxShadow: "0 4px 18px rgba(59,130,246,0.30)",
          }}
        >
          <FlameIcon className="h-5 w-5 text-white" />
        </div>
        <span className="brand-wordmark text-[22px] font-bold tracking-[-0.025em] text-[#1C1C1E]">
          PromptFix
        </span>
      </div>
      <p className="mt-3 text-[15px] leading-snug text-[#1C1C1E]">
        Turn weak prompts into powerful ones
      </p>
    </Link>
  );
};
