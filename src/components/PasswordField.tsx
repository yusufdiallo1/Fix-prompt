interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  show: boolean;
  onToggleShow: () => void;
  onChange: (next: string) => void;
  placeholder?: string;
}

export const PasswordField = ({
  id,
  label,
  value,
  show,
  onToggleShow,
  onChange,
  placeholder,
}: PasswordFieldProps) => {
  return (
    <div>
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="auth-input pr-16"
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={6}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#636366] hover:text-[#1C1C1E]"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
};
