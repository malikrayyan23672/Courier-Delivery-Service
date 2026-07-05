'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HeroPanel } from '@/components/HeroPanel';
import { Field } from '@/components/Field';
import { useAuth, panelPathForRole } from '@/context/AuthContext';
import { loginUser, ApiError } from '@/lib/api';

const MAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" />
  </svg>
);
const LOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const tokens = await loginUser(email, password);
      setToken(tokens.access_token);
      const payload = JSON.parse(atob(tokens.access_token.split('.')[1]));
      router.push(panelPathForRole(payload.role ?? null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
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
                Welcome <span className="text-orange">Back</span>
              </h2>
              <p className="text-muted text-sm mt-1 m-0">Log in to your account</p>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              id="password"
              type="password"
              label="Password"
              icon={LOCK_ICON}
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="flex justify-between items-center mb-6 text-sm">
              <label className="flex items-center gap-2 text-ink">
                <input type="checkbox" className="w-4 h-4 accent-orange" />
                Remember me
              </label>
              <Link href="#" className="text-orange font-semibold no-underline">
                Forgot password?
              </Link>
            </div>

            {error && <p className="text-sm text-danger mb-4">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-navy hover:bg-navy-light text-white font-bold text-[0.9rem] py-3.5 rounded-[10px] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Logging in…' : 'Login'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-muted">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-orange font-bold no-underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
