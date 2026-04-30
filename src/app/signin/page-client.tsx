'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Mail, Lock, User, Eye, EyeOff, Apple } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthService } from '@/services/AuthService'

type Mode = 'signin' | 'signup'

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSuccess = () => router.replace('/app/dashboard')

  const handleGoogle = async () => {
    setLoading('google')
    setError(null)
    try {
      await AuthService.signInWithGoogle()
      handleSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
    } finally {
      setLoading(null)
    }
  }

  const handleApple = async () => {
    setLoading('apple')
    setError(null)
    try {
      await AuthService.signInWithApple()
      handleSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
    } finally {
      setLoading(null)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
      if (!agreedToTerms) {
        setError('Please agree to the Terms of Service')
        return
      }
    }
    setLoading('email')
    try {
      if (mode === 'signin') {
        await AuthService.signInWithEmail(email, password)
      } else {
        await AuthService.signUpWithEmail(email, password, displayName)
      }
      handleSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Authentication failed')
    } finally {
      setLoading(null)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email address first')
      return
    }
    try {
      await AuthService.resetPassword(email)
      setError(null)
      alert('Password reset email sent!')
    } catch {
      setError('Failed to send reset email')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/assets/flusso-mark.svg" alt="Flusso" width={48} height={48} className="mb-4" />
          <h1 className="text-2xl font-bold font-display text-text-primary tracking-tight">
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {mode === 'signin' ? 'Sign in to continue focusing' : 'Start structuring your focus'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          {/* Apple */}
          <Button
            onClick={handleApple}
            loading={loading === 'apple'}
            variant="secondary"
            size="lg"
            className="w-full bg-[#000] hover:bg-[#111] border-[#333] text-white"
          >
            <Apple size={18} />
            Continue with Apple
          </Button>

          {/* Google */}
          <Button
            onClick={handleGoogle}
            loading={loading === 'google'}
            variant="secondary"
            size="lg"
            className="w-full"
          >
            {/* Google G */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-tertiary">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Input
                    label="Name"
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    leftIcon={<User size={14} />}
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={14} />}
              required
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={14} />}
              rightIcon={
                <button type="button" onClick={() => setShowPassword((s) => !s)}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
              required
            />

            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftIcon={<Lock size={14} />}
                    required
                  />
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="text-xs text-text-secondary">
                      I agree to the{' '}
                      <a href="/terms-and-conditions.html" className="text-primary hover:underline" target="_blank">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="/privacy-policy.html" className="text-primary hover:underline" target="_blank">
                        Privacy Policy
                      </a>
                    </span>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading === 'email'} size="lg" className="w-full">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>

            {mode === 'signin' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="w-full text-xs text-text-tertiary hover:text-primary transition-colors text-center"
              >
                Forgot password?
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-text-tertiary mt-4">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
            className="text-primary hover:underline"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  )
}
