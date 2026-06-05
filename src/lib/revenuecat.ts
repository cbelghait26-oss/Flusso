'use client'

let purchasesInstance: unknown = null

export async function configurePurchases(uid: string): Promise<void> {
  if (typeof window === 'undefined') return
  const apiKey = process.env.NEXT_PUBLIC_RC_API_KEY
  if (!apiKey) {
    console.warn('[RevenueCat] NEXT_PUBLIC_RC_API_KEY is not set')
    return
  }
  try {
    const { Purchases } = await import('@revenuecat/purchases-js')
    purchasesInstance = Purchases.configure(apiKey, uid)
  } catch (err) {
    console.error('[RevenueCat] configure error', err)
  }
}

export async function getCustomerInfo() {
  if (!purchasesInstance) return null
  try {
    const { Purchases } = await import('@revenuecat/purchases-js')
    return await Purchases.getSharedInstance().getCustomerInfo()
  } catch {
    return null
  }
}

export async function getOfferings() {
  if (!purchasesInstance) return null
  try {
    const { Purchases } = await import('@revenuecat/purchases-js')
    return await Purchases.getSharedInstance().getOfferings()
  } catch {
    return null
  }
}

export async function purchasePackage(pkg: unknown) {
  const { Purchases } = await import('@revenuecat/purchases-js')
  return Purchases.getSharedInstance().purchase({ rcPackage: pkg as never })
}

export async function restorePurchases() {
  const { Purchases } = await import('@revenuecat/purchases-js')
  // restorePurchases may not exist in all SDK versions — use syncPurchases fallback
  const instance = Purchases.getSharedInstance() as any
  return instance.restorePurchases?.() ?? instance.syncPurchases?.()
}
