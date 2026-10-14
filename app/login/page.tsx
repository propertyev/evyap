'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    const res = await signIn('credentials', {
      email: f.get('email'), password: f.get('password'), redirect: false,
    });
    setBusy(false);
    if (res?.error) setError('Incorrect email or password.');
    else window.location.href = params.get('callbackUrl') || '/dashboard';
  }

  return (
    <form className="login" onSubmit={submit}>
      <div className="mark" style={{ marginBottom: 14 }}>
        <i>E</i>Vy<span>ap</span>
      </div>
      <h1>Sign in to EVyap Accounts</h1>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {error && (
        <div className="tally bad" role="alert" style={{ margin: '0 0 12px', width: '100%' }}>
          {error}
        </div>
      )}
      <button className="btn pri" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
