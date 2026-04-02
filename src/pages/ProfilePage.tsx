export const ProfilePage = () => {
  return (
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">Profile</h1>
        <p className="mt-1 text-sm text-[#636366]">
          Manage your <span className="brand-wordmark">PromptFix</span> profile details and preferences.
        </p>
      </div>

      <div
        className="rounded-2xl border border-[#E5E5EA] p-6"
        style={{ background: "rgba(255,255,255,0.70)", backdropFilter: "blur(12px)" }}
      >
        <p className="text-sm text-[#8E8E93]">Profile settings coming soon.</p>
      </div>
    </section>
  );
};
