import { CartProvider } from '@/components/cart-provider'
import { CityProvider } from '@/components/storefront/city-provider'
import { StoreUIProvider } from '@/components/storefront/ui-provider'
import { StoreHeader } from '@/components/storefront/header'
import { StoreFooter } from '@/components/storefront/footer'
import { CartDrawer } from '@/components/storefront/cart-drawer'
import { ProductDetailsModal } from '@/components/storefront/product-details-modal'
import { FloatingSupportButton } from '@/components/storefront/floating-support'
import type { PublicSettings } from '@/lib/settings'

/**
 * Storefront shell: providers, sticky header, page content, footer and the
 * three global overlays (cart drawer, product details, support button).
 */
export function StorefrontShell({ settings, children }: { settings: PublicSettings; children: React.ReactNode }) {
  return (
    <CityProvider>
      <CartProvider>
        <StoreUIProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-forest focus:px-4 focus:py-2 focus:text-white">
            Skip to content
          </a>
          <StoreHeader settings={settings} />
          <main id="main" className="page-enter">{children}</main>
          <StoreFooter settings={settings} />
          <CartDrawer />
          <ProductDetailsModal />
          <FloatingSupportButton supportPhone={settings.supportPhone} />
        </StoreUIProvider>
      </CartProvider>
    </CityProvider>
  )
}
