import { Link } from "react-router-dom";

export const AuthLogo = () => {
  return (
    <Link to="/" className="block no-underline">
      <div className="flex items-center gap-3">
        <span className="brand-wordmark text-[22px] font-bold tracking-[-0.025em] text-[#1C1C1E]">
          Prompt Fix
        </span>
      </div>
      <p className="mt-3 text-[15px] leading-snug text-[#1C1C1E]">
        Turn weak prompts into powerful ones
      </p>
    </Link>
  );
};
