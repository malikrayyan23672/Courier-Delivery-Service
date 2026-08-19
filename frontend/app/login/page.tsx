'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HeroPanel } from '@/components/HeroPanel';
import { Field } from '@/components/Field';
import { useAuth, panelPathForRole } from '@/context/AuthContext';
import { loginUser, ApiError } from '@/lib/api';

interface FormState {
  email: string;
  password: string;
}

const ICONS = {
  eye: (
    <>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

function Icon({ path, size = 18 }: { path: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

const MAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

const LOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

function PasswordField({
  label, icon, error, value, onChange, placeholder, id,
}: {
  label: string;
  icon: React.ReactNode;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.82rem] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground pointer-events-none">
          {icon}
        </span>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full text-[0.92rem] py-3 pl-[42px] pr-10 rounded-[10px] border-[1.5px] bg-[#FBFCFE] text-ink outline-none transition-colors
            focus:border-orange focus:bg-white focus:shadow-[0_0_0_3px_rgba(242,101,13,0.13)]`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
          aria-label="Toggle password visibility"
        >
          <Icon path={ICONS.eye} />
        </button>
      </div>
      {error && <span className="text-[0.74rem] text-[#db2203]">{error}</span>}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setTokens } = useAuth();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '', form: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setErrors({});

    if (!form.email.trim()) {
      setErrors({ email: 'Email is required' });
      return;
    }

    if (!form.password.trim()) {
      setErrors({ password: 'Password is required' });
      return;
    }

    setSubmitting(true);

    try {
      const tokens = await loginUser(form.email, form.password);
      setTokens(tokens.access_token, tokens.refresh_token);

      const payload = JSON.parse(atob(tokens.access_token.split('.')[1]));
      router.push(panelPathForRole(payload.role ?? null, payload.designation ?? null));
    } catch (err) {
      setErrors({
        form: err instanceof ApiError ? err.message : 'Something went wrong, unable to login',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <HeroPanel
        heading="Welcome Back."
        highlight="Track. Ship. Grow."
        lede="Log in to manage your shipments, track deliveries, and stay on top of your business."
      />

      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-page">
        <div className="bg-white rounded-card shadow-card w-full max-w-[440px] px-8 md:px-10 pt-9 pb-8">
          <div className="flex gap-4 items-start mb-6">
            <div className="w-[52px] h-[52px] rounded-full bg-navy flex items-center justify-center flex-none text-white">
              {LOCK_ICON}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold m-0">
                Welcome <span className="text-[#db2203]">Back</span>
              </h2>
              <p className="text-muted-foreground text-sm mt-1 m-0">Log in to your account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <Field
              id="email"
              type="email"
              label="Email Address"
              icon={MAIL_ICON}
              placeholder="Enter your email"
              required
              value={form.email}
              error={errors.email}
              onChange={(e) => setField('email', e.target.value)}
            />

            <PasswordField
              id="password"
              label="Password *"
              icon={<Icon path={LOCK_ICON} />}
              placeholder="Enter your password"
              value={form.password}
              onChange={(v) => setField('password', v)}
              error={errors.password}
            />

            <div className="flex justify-end items-center mb-6 text-sm">
              <Link href="/forgot-password" className="text-[#db2203] font-semibold no-underline">
                Forgot password?
              </Link>
            </div>

            {errors.form && <p className="text-sm text-[#db2203] mb-4">{errors.form}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-navy hover:bg-navy-light text-white font-bold text-[0.9rem] py-3.5 rounded-[10px] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Logging in…' : 'Login'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-[#db2203] font-bold no-underline">
              Sign up
            </Link>
          </p>
          <p className="text-center mt-2 text-sm text-muted-foreground">
            Want to sell with us?{' '}
            <Link href="/business/register" className="text-[#db2203] font-bold no-underline">
              Register as a seller
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}