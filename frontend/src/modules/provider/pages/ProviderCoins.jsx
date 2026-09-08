import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import CoinWalletPanel from "@/components/CoinWalletPanel";

/**
 * Partner / Sewak RozSewa Coins wallet.
 *
 * Deliberately separate from ProviderWallet: that page is real money (earnings,
 * dues, withdrawals), this one is reward points that can only ever be spent on
 * a subscription. Keeping the two apart is what stops anyone reading a coin
 * balance as withdrawable cash.
 */
const ProviderCoins = () => (
  <div className="min-h-screen bg-background pb-24 md:pb-8">
    <ProviderTopNav />
    <main className="container max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-black tracking-tighter text-foreground">
          RozSewa Coins
        </h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Earn coins by completing job targets, then use them to cut the cost of
          your subscription.
        </p>
      </div>

      <CoinWalletPanel />
    </main>
    <ProviderBottomNav />
  </div>
);

export default ProviderCoins;
