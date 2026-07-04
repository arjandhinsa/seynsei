import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLogin, useUpdateMe } from '../../api/hooks/useAuth'
import { ApiError, apiFetch } from '../../api/client'
import { AuthLayout, SoftError } from '../../components/AuthLayout'
import { SoftButton } from '../../components/SoftButton'
import { SoftInput } from '../../components/SoftInput'
import { clearWelcome, hasAnyAnswer, readWelcome } from '../../lib/personalization'
import type { UserResponse } from '../../api/types'

export default function LoginScreen() {
  const navigate = useNavigate()
  const login = useLogin()
  const updateMe = useUpdateMe()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // After a successful login, if the account hasn't completed onboarding and
  // this device carries unsaved welcome answers, sync them to the profile.
  const syncWelcomeIfNeeded = async () => {
    const welcome = readWelcome()
    if (!hasAnyAnswer(welcome)) {
      clearWelcome()
      return
    }
    try {
      const me = await apiFetch<UserResponse>('/auth/me')
      if (!me.onboarding_completed) {
        await updateMe.mutateAsync({
          focus_area: welcome!.focus_area ?? null,
          top_triggers: welcome!.top_triggers ?? null,
          comfort_level: welcome!.comfort_level ?? null,
          main_goal: welcome!.main_goal ?? null,
        })
      }
    } catch {
      // Non-fatal — the user can still edit their path from the profile.
    } finally {
      clearWelcome()
    }
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: async () => {
          await syncWelcomeIfNeeded()
          navigate('/home', { replace: true })
        },
      },
    )
  }

  const errorMessage = login.isError
    ? login.error instanceof ApiError
      ? login.error.detail
      : 'Something went wrong. Please try again in a moment.'
    : null

  return (
    <AuthLayout>
      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <SoftInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <SoftInput
          label="Password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errorMessage && <SoftError message={errorMessage} />}
        <SoftButton
          primary
          type="submit"
          disabled={login.isPending}
          style={{ marginTop: 8 }}
        >
          {login.isPending ? 'A moment…' : 'Sign in'}
        </SoftButton>
      </form>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 40,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Link
          to="/auth/forgot"
          style={{
            color: 'var(--ink-3)',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Forgot password?
        </Link>
        <Link
          to="/auth/register"
          className="display-italic"
          style={{
            color: 'var(--ink-2)',
            fontSize: 16,
            textDecoration: 'none',
          }}
        >
          New here?{' '}
          <span style={{ color: 'var(--gold-2)' }}>Begin.</span>
        </Link>
      </div>
    </AuthLayout>
  )
}
