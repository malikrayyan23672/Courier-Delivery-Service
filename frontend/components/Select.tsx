import { SelectHTMLAttributes, ReactNode } from 'react';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  icon: ReactNode;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function SelectField({
  label,
  icon,
  error,
  id,
  options,
  placeholder,
  ...props
}: SelectFieldProps) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.82rem] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none">
          {icon}
        </span>
        <select
          id={id}
          {...props}
          className={`w-full appearance-none text-[0.92rem] py-3 pl-[42px] pr-9 rounded-[10px] border-[1.5px] bg-[#FBFCFE] text-ink outline-none transition-colors cursor-pointer
            focus:border-orange focus:bg-white focus:shadow-[0_0_0_3px_rgba(242,112,26,0.13)]
            ${error ? 'border-danger shadow-[0_0_0_3px_rgba(216,67,44,0.12)]' : 'border-line'}`}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-muted pointer-events-none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
      {error && <span className="text-[0.74rem] text-danger">{error}</span>}
    </div>
  );
}