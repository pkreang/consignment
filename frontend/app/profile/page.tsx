"use client";

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/use-error-message';

type Me = {
  userId: string;
  username: string;
  fullName: string | null;
  role: string | null;
  permissions: string[];
};

export default function ProfilePage() {
  const t = useTranslations('profile');
  const errorMessage = useErrorMessage();

  const [me, setMe] = useState<Me | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api<Me>('/auth/me')
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const save = useMutation({
    mutationFn: () =>
      api('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setSuccess(t('success'));
    },
    onError: (err) => {
      setSuccess(null);
      if (err instanceof ApiError && err.status === 401) {
        setError(t('errCurrentWrong'));
      } else {
        setError(errorMessage(err));
      }
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('errRequired'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('errTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('errMismatch'));
      return;
    }
    if (newPassword === currentPassword) {
      setError(t('errSame'));
      return;
    }
    save.mutate();
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>

      <div className="card p-4">
        <div className="label">{t('accountLabel')}</div>
        <div className="mt-1 text-lg font-medium">{me?.username ?? '—'}</div>
        <div className="text-sm text-surface-500 dark:text-surface-400">
          {me?.fullName ?? ''}
          {me?.role ? ` · ${me.role}` : ''}
        </div>
      </div>

      <form className="card space-y-3 p-4" onSubmit={submit}>
        <div className="text-base font-semibold">{t('changePasswordTitle')}</div>

        <PasswordField
          id="profile-current"
          label={t('currentPassword')}
          value={currentPassword}
          onChange={setCurrentPassword}
          show={showPw}
          autoComplete="current-password"
        />
        <PasswordField
          id="profile-new"
          label={t('newPassword')}
          value={newPassword}
          onChange={setNewPassword}
          show={showPw}
          autoComplete="new-password"
          hint={t('hint')}
        />
        <PasswordField
          id="profile-confirm"
          label={t('confirmPassword')}
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showPw}
          autoComplete="new-password"
        />

        <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
          <input
            type="checkbox"
            checked={showPw}
            onChange={(e) => setShowPw(e.target.checked)}
          />
          {showPw ? t('hide') : t('show')}
        </label>

        {error && <div className="alert-error">{error}</div>}
        {success && <div className="alert-success">{success}</div>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={save.isPending}
          >
            {save.isPending ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="input"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <div className="mt-1 text-xs text-surface-500 dark:text-surface-400">{hint}</div>
      )}
    </div>
  );
}
