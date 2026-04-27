'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, Zap, BarChart3, Dumbbell, Users, RefreshCcw } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/revenuecat'
import { useAuthStore } from '@/stores/useAuthStore'
import { cn } from '@/lib/utils'

const FEATURES = [
  { icon: Zap, label: 'Unlimited objectives & tasks' },
  { icon: BarChart3, label: 'Focus analytics dashboard' },
  { icon: Dumbbell, label: 'Training plans & habits' },
  { icon: Users, label: 'Social leaderboard & rooms' },
  { icon: RefreshCcw, label: 'Priority sync across devices' },
]

interface PackageInfo {
  identifier: string
  product: { priceString: string; title: string }
  raw: unknown
}

export default function PaywallPage() {
  const [offerings, setOfferings] = useState<PackageInfo[] | null>(null)
  const [selectedPkg, setSelectedPkg] = useState<string>('flusso_yearly')
  const [loading, setLoading] = useState(false)
  const [loadingOfferings, setLoadingOfferings] = useState(true)
  const router = useRouter()
  const { setIsPremium } = useAuthStore()

  useEffect(() => {
    getOfferings().then((o) => {
      if (o?.current?.availablePackages) {
        setOfferings(
          o.current.availablePackages.map((p) => ({
            identifier: p.identifier,
            product: { priceString: (p as unknown as Record<string, Record<string, string>>)['rcBillingProduct']?.['priceString'] ?? '', title: p.identifier },
            raw: p,
          }))
        )
      }
      setLoadingOfferings(false)
    })
  }, [])

  const handlePurchase = async () => {
    const pkg = offerings?.find((p) => p.identifier === selectedPkg)
    if (!pkg) return
    setLoading(true)
    try {
      await purchasePackage(pkg.raw)
      setIsPremium(true)
      router.replace('/app/dashboard')
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    setLoading(true)
    try {
      const info = await restorePurchases()
      const hasPro =
        info?.entitlements?.active?.['pro'] !== undefined ||
        info?.entitlements?.active?.['premium'] !== undefined
      if (hasPro) {
        setIsPremium(true)
        router.replace('/app/dashboard')
      } else {
        alert('No active subscription found.')
      }
    } finally {
      setLoading(false)
    }
  }

  const monthlyPkg = offerings?.find((p) => p.identifier === 'flusso_monthly')
  const yearlyPkg = offerings?.find((p) => p.identifier === 'flusso_yearly')

  const yearlyPrice = yearlyPkg?.product?.priceString
  const monthlyPrice = monthlyPkg?.product?.priceString

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-3">
          <Image src="/assets/flusso-mark.svg" alt="Flusso" width={48} height={48} className="mx-auto" />
          <h1 className="text-2xl font-bold font-display text-text-primary">Unlock Flusso Pro</h1>
          <p className="text-sm text-text-secondary">Everything you need to structure your focus</p>
        </div>

        {/* Features */}
        <div className="space-y-3">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-primary" />
              </div>
              <span className="text-sm text-text-primary">{label}</span>
              <Check size={14} className="text-success ml-auto" />
            </div>
          ))}
        </div>

        {/* Plans */}
        {loadingOfferings ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Monthly */}
            <button
              onClick={() => setSelectedPkg('flusso_monthly')}
              className={cn(
                'relative p-4 rounded-xl border text-left transition-all duration-200',
                selectedPkg === 'flusso_monthly'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-surface hover:border-primary/40'
              )}
            >
              <p className="text-xs text-text-tertiary mb-1">Monthly</p>
              <p className="text-lg font-bold font-display text-text-primary">
                {monthlyPrice ?? '—'}
              </p>
              <p className="text-xs text-text-secondary">per month</p>
            </button>

            {/* Yearly */}
            <button
              onClick={() => setSelectedPkg('flusso_yearly')}
              className={cn(
                'relative p-4 rounded-xl border text-left transition-all duration-200',
                selectedPkg === 'flusso_yearly'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-surface hover:border-primary/40'
              )}
            >
              <div className="absolute -top-2.5 right-3 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                BEST VALUE
              </div>
              <p className="text-xs text-text-tertiary mb-1">Annual</p>
              <p className="text-lg font-bold font-display text-text-primary">
                {yearlyPrice ?? '—'}
              </p>
              <p className="text-xs text-text-secondary">per year</p>
            </button>
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={handlePurchase} loading={loading} size="lg" className="w-full">
            Continue with {selectedPkg === 'flusso_yearly' ? 'Annual' : 'Monthly'}
          </Button>
          <button
            onClick={handleRestore}
            className="w-full text-xs text-text-tertiary hover:text-primary transition-colors text-center"
          >
            Restore purchases
          </button>
          <button
            onClick={() => router.replace('/app/dashboard')}
            className="w-full text-xs text-text-tertiary hover:text-text-secondary transition-colors text-center"
          >
            Maybe later
          </button>
        </div>
      </motion.div>
    </div>
  )
}
