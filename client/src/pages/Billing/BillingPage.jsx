import { useState, useMemo } from "react";
import {
  Zap, Crown, Check, ArrowRight, Gift, TrendingDown,
  TrendingUp, ShoppingCart, Coins, Receipt, HelpCircle, ChevronDown,
  Shield, BarChart3, FileText, AlertCircle, Sparkles, Filter, Building2, Info, Trash2
} from "lucide-react";
import { useCredits, useBilling, useCreditTransactions, useClearTransactions, useCreateCheckoutSession, useCreatePortalSession, usePricing } from "../../hooks/queries";
import Card from "../../components/ui/Card/Card";
import Badge from "../../components/ui/Badge/Badge";
import Button from "../../components/ui/Button/Button";
import Spinner from "../../components/ui/Spinner/Spinner";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import { SkeletonBilling } from "../../components/ui/Skeleton/Skeleton";
import { cn, formatCredits, formatNumber, getErrorMessage } from "../../lib/utils";

export default function BillingPage() {
  const { data: creditsData, isLoading: creditsLoading, error: creditsError } = useCredits();
  const { data: billingData, isLoading: billingLoading, error: billingError } = useBilling();
  const [txFilter, setTxFilter] = useState("");
  const { data: allTransactions, isLoading: txLoading } = useCreditTransactions({ limit: 50 });
  const { data: pricing } = usePricing();
  const checkout = useCreateCheckoutSession();
  const portal = useCreatePortalSession();
  const [portalLoading, setPortalLoading] = useState(false);
  const clearHistory = useClearTransactions();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const balance = creditsData?.balance ?? 0;
  const plan = creditsData?.plan || billingData?.plan || "free";
  const isPaid = plan !== "free";

  const transactions = useMemo(() => {
    if (!allTransactions) return [];
    if (!txFilter) return allTransactions;
    return allTransactions.filter((tx) => tx.type === txFilter);
  }, [allTransactions, txFilter]);

  const plansList = useMemo(() => {
    if (!pricing?.plansFull || !pricing?.planOrder) return [];
    return pricing.planOrder.map((id) => pricing.plansFull[id]).filter(Boolean);
  }, [pricing]);

  const creditPacks = pricing?.creditPacks || [];
  const enterprise = pricing?.enterprise || null;
  const comparisonRows = pricing?.comparisonRows || [];
  const faqs = pricing?.faqs || [];

  if (creditsLoading || billingLoading) return <SkeletonBilling />;

  if (creditsError || billingError) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text">Billing & Credits</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your subscription and credit balance</p>
        </div>
        <EmptyState
          variant="danger"
          icon={<AlertCircle className="w-7 h-7" />}
          title="Failed to load billing"
          description={getErrorMessage(creditsError || billingError, "Something went wrong while loading your billing information.")}
          action={{ onClick: () => window.location.reload(), children: "Retry" }}
        />
      </div>
    );
  }

  const txTypeConfig = {
    earned: { icon: Gift, color: "bg-success/10 text-success", prefix: "+" },
    spent: { icon: TrendingDown, color: "bg-danger/10 text-danger", prefix: "" },
    refund: { icon: TrendingUp, color: "bg-highlight/10 text-highlight", prefix: "+" },
    purchase: { icon: ShoppingCart, color: "bg-primary/10 text-primary", prefix: "+" },
    adjustment: { icon: Sparkles, color: "bg-accent/10 text-accent", prefix: "" },
    subscription_grant: { icon: Crown, color: "bg-primary/10 text-primary", prefix: "+" },
    welcome_bonus: { icon: Gift, color: "bg-success/10 text-success", prefix: "+" },
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text">Billing & Credits</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your subscription and credit balance</p>
        </div>
      </div>

      {/* Balance Card */}
      <Card className="glass-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Available Credits</p>
              <p className="text-3xl sm:text-4xl font-bold text-text tabular-nums">{formatCredits(balance)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isPaid ? "viral" : "highlight"} size="md">
              <Crown className="w-3.5 h-3.5 mr-1" /> {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => checkout.mutate(plansList.find((p) => p.id !== plan && p.price > 0)?.id || "starter")}>
              <ArrowRight className="w-4 h-4 mr-1" /> Upgrade
            </Button>
          </div>
        </div>
        <div className="mt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-surface-subtle/50 border border-border/50">
              <p className="text-2xl font-bold text-text tabular-nums">{formatCredits(balance)}</p>
              <p className="text-xs text-text-secondary mt-1">Current Balance</p>
            </div>
            <div className="p-4 rounded-xl bg-surface-subtle/50 border border-border/50">
              <p className="text-2xl font-bold text-text tabular-nums">{formatCredits(creditsData?.usedThisMonth || 0)}</p>
              <p className="text-xs text-text-secondary mt-1">Used This Month</p>
            </div>
            <div className="p-4 rounded-xl bg-surface-subtle/50 border border-border/50">
              <p className="text-2xl font-bold text-text tabular-nums">{formatCredits(creditsData?.rollover || 0)}</p>
              <p className="text-xs text-text-secondary mt-1">Bonus Credits</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
            <Info className="w-3.5 h-3.5" />
            <span>Subscription credits renew monthly. Bonus credits (from packs) never expire.</span>
          </div>
        </div>
      </Card>

      {/* Subscription Plans */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-text">Subscription Plans</h2>
        </div>
        <p className="text-sm text-text-secondary mb-5">Choose the plan that fits your workflow. Upgrade or downgrade anytime.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {plansList.map((p) => {
            const isActive = p.id === plan;
            const isPopular = p.badge === "Most Popular";
            return (
              <Card
                key={p.id}
                className={cn(
                  "glass-card p-5 sm:p-6 relative overflow-visible flex flex-col transition-all duration-200",
                  isActive && "ring-2 ring-primary/40 border-primary/30",
                  isPopular && !isActive && "border-primary/20 shadow-lg shadow-primary/5"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <Badge variant="viral" size="sm">Most Popular</Badge>
                  </div>
                )}
                {p.badge && p.badge !== "Most Popular" && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <Badge variant="highlight" size="sm">{p.badge}</Badge>
                  </div>
                )}
                {isActive && (
                  <div className="absolute -top-2.5 right-4">
                    <Badge variant="primary" size="sm">
                      <Check className="w-3 h-3 mr-0.5" /> Current
                    </Badge>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-primary">{p.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-text">
                      {p.price === 0 ? "Free" : `$${p.price}`}
                    </span>
                    {p.price > 0 && <span className="text-sm text-text-secondary">/mo</span>}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{formatCredits(p.monthlyCredits)}/mo</p>
                  {p.estimatedClips && (
                    <p className="text-xs text-highlight mt-1">{p.estimatedClips}</p>
                  )}
                </div>

                {p.recommendedUser && (
                  <p className="text-[11px] text-text-muted mb-3">{p.recommendedUser}</p>
                )}

                <ul className="space-y-1.5 mb-5 flex-1">
                  {p.features.slice(0, 6).map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <div className={cn(
                        "w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0",
                        f.included ? "bg-success/15 text-success" : "bg-surface-overlay text-text-muted"
                      )}>
                        {f.included ? <Check className="w-2 h-2" /> : <span className="w-1 h-px bg-text-muted" />}
                      </div>
                      <span className={cn("text-xs", f.included ? "text-text-secondary" : "text-text-muted line-through")}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full h-10"
                  variant={isActive ? "secondary" : isPopular ? "primary" : "secondary"}
                  disabled={isActive || checkout.isPending}
                  loading={checkout.isPending && !isActive}
                  aria-label={isActive ? "Current plan" : `Upgrade to ${p.name}`}
                  onClick={() => { if (!isActive) checkout.mutate(p.id); }}
                >
                  {isActive ? "Current Plan" : p.price === 0 ? "Get Started" : `Upgrade to ${p.name}`}
                  {!isActive && p.price > 0 && <ArrowRight className="w-4 h-4" />}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Enterprise */}
        {enterprise && (
          <Card className="glass-card mt-4 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text">{enterprise.name}</p>
                    <Badge variant="accent" size="sm">Contact Sales</Badge>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{enterprise.description}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" className="flex-shrink-0">
                Contact Sales <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Credit Packs */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Coins className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-text">Credit Packs</h2>
        </div>
        <p className="text-sm text-text-secondary mb-5">One-time purchase. Credits never expire. Used after subscription credits run out.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {creditPacks.map((pack) => (
            <button
              key={pack.id}
              onClick={() => checkout.mutate(pack.id)}
              disabled={checkout.isPending}
              className={cn(
                "relative p-4 sm:p-5 rounded-xl border-2 text-center transition-all duration-200 hover:-translate-y-0.5",
                pack.badge === "Best Value"
                  ? "border-accent/30 bg-accent/5 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10"
                  : "border-border bg-surface hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              )}
            >
              {pack.badge && (
                <span className={cn(
                  "absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full",
                  pack.badge === "Best Value" ? "text-accent bg-accent/10" : "text-primary bg-primary/10"
                )}>
                  {pack.badge}
                </span>
              )}
              <p className="text-xs font-medium text-text-secondary mb-1">{pack.name}</p>
              <p className="text-xl sm:text-2xl font-bold text-text">{formatCredits(pack.credits)}</p>
              <p className="text-sm font-semibold text-primary mt-1">${pack.price}</p>
              <p className="text-[10px] text-text-muted mt-1">{pack.perCredit}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Plan Comparison Table */}
      {comparisonRows.length > 0 && plansList.length > 0 && (
        <Card className="glass-card p-5 sm:p-6 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-highlight" />
            <h2 className="text-lg font-semibold text-text">Plan Comparison</h2>
          </div>
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-4 text-text-secondary font-medium">Feature</th>
                {plansList.map((p) => (
                  <th key={p.id} className={cn("text-center py-3 px-3 font-medium", p.id === plan ? "text-primary" : "text-text-secondary")}>
                    {p.name}
                    {p.badge === "Most Popular" && <span className="block text-[10px] text-primary font-normal">Most Popular</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.key} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-4 text-text-secondary">{row.label}</td>
                  {plansList.map((p) => {
                    const val = p.comparison?.[row.key];
                    return (
                      <td key={p.id} className="text-center py-3 px-3">
                        {typeof val === "boolean" ? (
                          val ? <Check className="w-4 h-4 text-success mx-auto" /> : <span className="text-text-muted">—</span>
                        ) : (
                          <span className={cn("text-xs", p.id === plan ? "text-text font-semibold" : "text-text-secondary")}>{val || "—"}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Credit Cost Breakdown */}
      <Card className="glass-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-highlight" />
          <h2 className="text-lg font-semibold text-text">Credit Cost Per Clip</h2>
        </div>
        <p className="text-xs text-text-secondary mb-5">Credits consumed per clip based on duration</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {pricing?.costs?.clip
            ? Object.entries(pricing.costs.clip).map(([duration, credits]) => (
                <div key={duration} className="p-3 rounded-xl bg-surface-subtle/50 border border-border/50 text-center">
                  <p className="text-lg font-bold text-text">{credits}</p>
                  <p className="text-[11px] text-text-secondary">cr / {duration}</p>
                </div>
              ))
            : [
                { d: "15s", c: 5 }, { d: "30s", c: 10 }, { d: "45s", c: 12 },
                { d: "60s", c: 15 }, { d: "90s", c: 20 }, { d: "120s", c: 25 },
              ].map((item) => (
                <div key={item.d} className="p-3 rounded-xl bg-surface-subtle/50 border border-border/50 text-center">
                  <p className="text-lg font-bold text-text">{item.c}</p>
                  <p className="text-[11px] text-text-secondary">cr / {item.d}</p>
                </div>
              ))}
        </div>
      </Card>

      {/* Manage Subscription */}
      {isPaid && (
        <Card className="glass-card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">Manage Subscription</p>
                <p className="text-xs text-text-secondary">Update payment, cancel, or view invoices</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="h-9 flex-shrink-0"
              loading={portalLoading}
              onClick={() => {
                setPortalLoading(true);
                portal.mutate(undefined, {
                  onSuccess: (data) => { if (data?.url) window.location.href = data.url; setPortalLoading(false); },
                  onError: () => setPortalLoading(false),
                });
              }}
            >
              Open Billing Portal
            </Button>
          </div>
        </Card>
      )}

      {/* Transaction History */}
      <Card className="glass-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-text-secondary" />
            <h2 className="text-lg font-semibold text-text">Transaction History</h2>
          </div>
          <div className="flex items-center gap-2">
            {allTransactions?.length > 0 && (
              <>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 text-xs text-danger/60 hover:text-danger transition-colors px-2 py-1.5 rounded-lg hover:bg-danger/10"
                  disabled={clearHistory.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear History
                </button>
                <span className="w-px h-4 bg-border" />
              </>
            )}
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={txFilter}
              onChange={(e) => setTxFilter(e.target.value)}
              className="text-sm bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-colors"
            >
              <option value="">All Types</option>
              <option value="spent">Spent</option>
              <option value="earned">Earned</option>
              <option value="purchase">Purchases</option>
              <option value="refund">Refunds</option>
              <option value="adjustment">Adjustments</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-text-secondary mb-4">Recent credit activity and billing transactions</p>
        {txLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Spinner size="md" />
            <p className="text-text-secondary text-xs animate-pulse">Loading transactions...</p>
          </div>
        ) : !transactions?.length ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="No transactions yet"
            description="Your credit activity will appear here once you start generating clips or purchase credits."
            action={{ onClick: () => window.location.reload(), children: "Refresh" }}
            className="py-6"
          />
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {transactions.map((tx, i) => {
              const cfg = txTypeConfig[tx.type] || txTypeConfig.spent;
              const Icon = cfg.icon;
              const date = tx.created_at
                ? new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "";
              return (
                <div key={tx.id || i} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-subtle/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", cfg.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">{tx.reason || tx.type}</p>
                      <p className="text-[11px] text-text-muted">{date}</p>
                    </div>
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums", tx.amount > 0 ? "text-success" : "text-danger")}>
                    {cfg.prefix}{formatNumber(Math.abs(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* FAQ */}
      {faqs.length > 0 && (
        <div>
          <div className="text-center mb-5">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold text-text">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <Card key={i} className="glass-card p-0 overflow-hidden">
                <details className="group">
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                    <span className="text-sm font-medium text-text pr-4">{faq.q}</span>
                    <ChevronDown className="w-4 h-4 text-text-muted group-open:rotate-180 transition-transform flex-shrink-0" />
                  </summary>
                  <div className="px-5 pb-4 text-xs text-text-secondary leading-relaxed border-t border-border pt-3">{faq.a}</div>
                </details>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Clear History Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="glass-card mx-4 max-w-sm w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">Clear Transaction History</h3>
                <p className="text-xs text-text-secondary mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              All transaction records will be permanently deleted. Your current credit balance will not be affected.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearConfirm(false)}
                disabled={clearHistory.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={clearHistory.isPending}
                onClick={() => {
                  clearHistory.mutate(undefined, {
                    onSuccess: () => setShowClearConfirm(false),
                    onError: () => setShowClearConfirm(false),
                  });
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear All
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
