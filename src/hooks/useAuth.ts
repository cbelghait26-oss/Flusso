'use client'

import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/useAuthStore'
import { AuthService } from '@/services/AuthService'
import { configurePurchases, getCustomerInfo } from '@/lib/revenuecat'

export function useAuth() {
  const { user, profile, settings, loading, isPremium, setUser, setProfile, setSettings, setLoading, setIsPremium, reset } =
    useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        try {
          await AuthService.createUserDocIfNeeded(firebaseUser)
          const [profile, settings] = await Promise.all([
            AuthService.getUserProfile(firebaseUser.uid),
            AuthService.getUserSettings(firebaseUser.uid),
          ])
          setProfile(profile)
          setSettings(settings)

          // Configure RevenueCat
          await configurePurchases(firebaseUser.uid)
          const customerInfo = await getCustomerInfo()
          const hasPro =
            customerInfo?.entitlements?.active?.['pro'] !== undefined ||
            customerInfo?.entitlements?.active?.['premium'] !== undefined
          setIsPremium(hasPro)
        } catch (err) {
          console.error('[useAuth] error loading user data', err)
        }
      } else {
        reset()
      }
      setLoading(false)
    })
    return unsubscribe
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { user, profile, settings, loading, isPremium }
}
