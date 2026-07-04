import { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: ReactNode;
  error?: string;
}

export function Field({ label, icon, error, id, ...props }: FieldProps) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.82rem] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none">
          {icon}
        </span>
        <input
          id={id}
          {...props}
          className={`w-full text-[0.92rem] py-3 pl-[42px] pr-3.5 rounded-[10px] border-[1.5px] bg-[#FBFCFE] text-ink outline-none transition-colors
            focus:border-orange focus:bg-white focus:shadow-[0_0_0_3px_rgba(242,112,26,0.13)]
            ${error ? 'border-danger shadow-[0_0_0_3px_rgba(216,67,44,0.12)]' : 'border-line'}`}
        />
      </div>
      {error && <span className="text-[0.74rem] text-danger">{error}</span>}
    </div>
  );
}
