'use client';

import { useRef } from 'react';

export function OtpBoxes({
  value,
  onChange,
  length = 6,
}: {
  value: string;
  onChange: (val: string) => void;
  length?: number;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  function updateDigit(index: number, digit: string) {
    const clean = digit.replace(/[^0-9]/g, '').slice(0, 1);
    const nextDigits = [...digits];
    nextDigits[index] = clean;
    onChange(nextDigits.join(''));
    if (clean && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const paste = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
    if (paste) {
      e.preventDefault();
      onChange(paste.slice(0, length));
      inputsRef.current[Math.min(paste.length, length) - 1]?.focus();
    }
  }

  return (
    <div className="flex gap-2.5 mb-4">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => updateDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-12 h-[54px] text-center text-xl font-bold p-0 rounded-[10px] border-[1.5px] border-line bg-[#FBFCFE] outline-none
            focus:border-orange focus:bg-white focus:shadow-[0_0_0_3px_rgba(242,112,26,0.13)]"
        />
      ))}
    </div>
  );
}
