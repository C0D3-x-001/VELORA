import { ArrowRight, Check, Zap, Sparkles, Film, Target, Users, Download, Star, ChevronDown, Play, TrendingUp, Clock, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut } from "../../lib/auth";
import { cn } from "../../lib/utils";
import Button from "../../components/ui/Button/Button";
import Card from "../../components/ui/Card/Card";
import Badge from "../../components/ui/Badge/Badge";
import { useScrollReveal, useCountUp } from "../../hooks/useScrollReveal";

const features = [
  { icon: Zap, title: "AI Clip Detection", desc: "Finds the strongest moments automatically using hook strength, emotional peaks, and story completion scoring." },
  { icon: Film, title: "Auto Captions", desc: "Creates readable captions with Modern, Karaoke, and Minimal styles. Default ON for maximum retention." },
  { icon: Target, title: "Viral Score", desc: "Every clip gets a 0-100 AI prediction with reasoning: hook, engagement, story, emotion, clarity." },
  { icon: Sparkles, title: "Content Package", desc: "Generates clickable titles, social captions, and relevant hashtags for every single clip." },
  { icon: Users, title: "Multi-Platform", desc: "Optimized for YouTube Shorts, TikTok, and Instagram Reels with correct aspect ratios built in." },
  { icon: Download, title: "Instant Download", desc: "Preview, rename, regenerate, or download clips individually or grab them all as a batch." },
];

const steps = [
  { num: "01", title: "Upload", desc: "Paste a YouTube link or drag & drop a video file. We handle up to 3 hours of footage.", icon: Play },
  { num: "02", title: "AI Finds Moments", desc: "Velora analyzes story, emotion, hooks, and engagement potential to find the viral moments.", icon: Sparkles },
  { num: "03", title: "Download Clips", desc: "Get ready-to-post Shorts, Reels, and TikToks with titles, captions, and hashtags.", icon: Download },
];

const testimonials = [
  { name: "Sarah Chen", role: "Podcaster & YouTuber", text: "I used to spend 8 hours editing one episode into clips. Now I paste the link and walk away. Velora found moments I missed watching it live.", score: 94, avatar: "SC" },
  { name: "Marcus Rivera", role: "TikTok Creator", text: "The Viral Score is scary accurate. I only post clips above 80 and my average views went from 5K to 47K in a month.", score: 91, avatar: "MR" },
  { name: "Aisha Patel", role: "Course Creator", text: "Turned a 3-hour workshop into 30 clips. My students started sharing them and my course signups tripled.", score: 88, avatar: "AP" },
];

const pricing = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    credits: "100 credits/mo",
    description: "Try Velora with no commitment",
    features: [
      { text: "Basic AI clipping", included: true },
      { text: "720p export", included: true },
      { text: "Standard captions", included: true },
      { text: "1 active project", included: true },
      { text: "Community support", included: true },
      { text: "Basic video stabilization", included: true },
    ],
    cta: "Start Free",
    variant: "secondary",
  },
  {
    name: "Starter",
    price: "$5",
    period: "/month",
    credits: "1,000 credits/mo",
    description: "For casual creators getting started",
    features: [
      { text: "1080p export", included: true },
      { text: "Watermark-free clips", included: true },
      { text: "3 active projects", included: true },
      { text: "1 GB storage", included: true },
      { text: "Email support", included: true },
      { text: "Improved stabilization", included: true },
    ],
    cta: "Get Starter",
    variant: "secondary",
  },
  {
    name: "Creator",
    price: "$12",
    period: "/month",
    credits: "5,000 credits/mo",
    description: "Built for content creators who post regularly",
    features: [
      { text: "Advanced AI clipping", included: true },
      { text: "Premium captions", included: true },
      { text: "Custom clip duration & count", included: true },
      { text: "Brand Kit & Saved Templates", included: true },
      { text: "10 active projects, 10 GB", included: true },
      { text: "Priority processing & support", included: true },
    ],
    cta: "Upgrade to Creator",
    variant: "primary",
    popular: true,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    credits: "15,000 credits/mo",
    description: "For professionals who need serious volume",
    features: [
      { text: "4K export", included: true },
      { text: "Animated & Pop-Up Captions", included: true },
      { text: "AI Close-Up Framing & Auto Punch-In", included: true },
      { text: "50 active projects, 50 GB", included: true },
      { text: "Batch Processing", included: true },
      { text: "3 Team Members", included: true },
    ],
    cta: "Go Pro",
    variant: "secondary",
    badge: "For Professionals",
  },
  {
    name: "Business",
    price: "$79",
    period: "/month",
    credits: "50,000 credits/mo",
    description: "For teams and agencies at scale",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "API Access", included: true },
      { text: "Unlimited projects, 500 GB", included: true },
      { text: "10 Team Members", included: true },
      { text: "Fastest processing", included: true },
      { text: "Dedicated support", included: true },
    ],
    cta: "Go Business",
    variant: "secondary",
    badge: "For Teams",
  },
];

const creditPacks = [
  { name: "Starter Pack", credits: "1,000", price: "$5", perCredit: "0.5¢/cr" },
  { name: "Creator Pack", credits: "5,000", price: "$20", perCredit: "0.4¢/cr", bestValue: true },
  { name: "Pro Pack", credits: "15,000", price: "$50", perCredit: "0.33¢/cr" },
  { name: "Business Pack", credits: "50,000", price: "$150", perCredit: "0.3¢/cr" },
];

const faqs = [
  { q: "How long can videos be?", a: "Velora supports videos up to 3 hours long. We handle long podcasts, full interviews, livestreams, and courses with ease." },
  { q: "Do I need editing experience?", a: "Not at all. Velora handles the entire pipeline automatically — from understanding your content to generating ready-to-post clips with captions and titles." },
  { q: "How does credit pricing work?", a: "Each clip costs credits based on its length: 15 seconds = 5 credits, 30 seconds = 10 credits, 45 seconds = 13 credits, 60 seconds = 15 credits, 90 seconds = 22 credits, 120 seconds = 30 credits. A typical 1-hour video produces 10-20 clips." },
  { q: "Can I customize captions?", a: "Yes. You can choose between Modern, Karaoke, and Minimal caption styles, or disable captions entirely. Style is applied per clip." },
  { q: "What platforms are supported?", a: "Velora optimizes clips for YouTube Shorts, TikTok, and Instagram Reels with the correct 9:16 vertical aspect ratio." },
  { q: "Is there a free trial?", a: "The Free plan gives you 100 credits on signup with no credit card required. That's enough to process several short videos and see the quality firsthand." },
];

const stats = [
  { value: 12400, suffix: "+", label: "Clips Generated" },
  { value: 3200, suffix: "+", label: "Active Creators" },
  { value: 94, suffix: "%", label: "Satisfaction Rate" },
];

function StatCounter({ value, suffix, label }) {
  const countRef = useCountUp(value, 2000);
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-text stat-number">
        <span ref={countRef}>0</span>{suffix}
      </div>
      <div className="text-sm text-text-secondary mt-1">{label}</div>
    </div>
  );
}

function FeatureIcon({ icon: Icon }) {
  return (
    <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
      <Icon className="w-5 h-5 text-primary" />
    </div>
  );
}

export default function LandingPage() {
  const heroRef = useScrollReveal();
  const socialRef = useScrollReveal();
  const stepsRef = useScrollReveal();
  const featuresRef = useScrollReveal();
  const testimonialsRef = useScrollReveal();
  const pricingRef = useScrollReveal();
  const faqRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <div className="min-h-screen bg-bg">
      {/* ─── Header ─── */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-bg/70 backdrop-blur-xl border-b border-border">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
                <img src="/veloralogo.png" alt="Velora" className="w-9 h-9 rounded-xl object-contain" />
            <span className="font-bold text-xl text-text tracking-tight">Velora</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-text-secondary text-sm font-medium">
            <a href="#features" className="hover:text-text transition-colors duration-200">Features</a>
            <a href="#how-it-works" className="hover:text-text transition-colors duration-200">How It Works</a>
            <a href="#pricing" className="hover:text-text transition-colors duration-200">Pricing</a>
            <a href="#faq" className="hover:text-text transition-colors duration-200">FAQ</a>
          </div>
          <div className="flex items-center gap-2.5">
            <SignedOut>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Start Free</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </nav>
      </header>

      <main>
        {/* ─── Hero ─── */}
        <section ref={heroRef} className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28 lg:pt-44 lg:pb-36 px-4 sm:px-6">
          <div className="hero-glow-primary -top-40 -left-40 opacity-60" />
          <div className="hero-glow-accent top-20 -right-32 opacity-40" />
          <div className="hero-glow-highlight bottom-0 left-1/3 opacity-30" />

          <div className="max-w-7xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <div className="reveal">
                  <Badge variant="viral" className="mb-6">New: AI Viral Score Engine</Badge>
                </div>
                <h1 className="reveal reveal-delay-1 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text leading-[1.08] mb-6 tracking-tight">
                  Turn long videos into{" "}
                  <span className="bg-gradient-to-r from-primary via-accent to-highlight bg-clip-text text-transparent">
                    viral short-form content
                  </span>
                </h1>
                <p className="reveal reveal-delay-2 text-lg md:text-xl text-text-secondary mb-8 max-w-lg leading-relaxed">
                  Upload a podcast, interview, or YouTube video. Velora finds the best moments,
                  adds captions, scores viral potential, and gives you ready-to-post clips.
                </p>
                <div className="reveal reveal-delay-3 flex flex-col sm:flex-row gap-3">
                  <SignedOut>
                    <Button size="xl" asChild>
                      <Link to="/signup">
                        Start Creating Free
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </Button>
                  </SignedOut>
                  <SignedIn>
                    <Button size="xl" asChild>
                      <Link to="/dashboard/create">
                        Create New Project
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </Button>
                  </SignedIn>
                  <Button variant="secondary" size="xl" asChild>
                    <a href="#how-it-works">See How It Works</a>
                  </Button>
                </div>
                <div className="reveal reveal-delay-4 mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-text-secondary">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-highlight flex-shrink-0" />
                    <span>100 free credits on signup</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-highlight flex-shrink-0" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-highlight flex-shrink-0" />
                    <span>Cancel anytime</span>
                  </div>
                </div>
              </div>

              <div className="relative reveal-scale reveal-delay-2">
                <div className="float-y">
                  <div className="bg-surface rounded-2xl border border-border p-4 shadow-elevated">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="aspect-video bg-bg rounded-xl border border-border flex items-center justify-center relative overflow-hidden">
                      <div className="text-center p-6">
                        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/10">
                          <Film className="w-10 h-10 text-primary" />
                        </div>
                        <p className="text-text-secondary text-sm mb-3">Long-form Video</p>
                        <div className="flex items-center justify-center gap-2 my-3">
                          <div className="h-px w-8 bg-border" />
                          <ArrowRight className="w-5 h-5 text-highlight" />
                          <div className="h-px w-8 bg-border" />
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 max-w-sm mx-auto">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="aspect-video bg-surface rounded-lg border border-border flex items-center justify-center">
                              <span className="text-[10px] text-text-muted">Clip {i}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md rounded-xl px-3 py-2 text-xs text-text-secondary flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-highlight font-semibold">Score: 94</span>
                        <span className="text-border">|</span>
                        <span>Hook: Strong</span>
                        <span className="text-border">|</span>
                        <span>Emotion: High</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-8 -right-8 w-72 h-72 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -top-16 -left-16 w-96 h-96 bg-accent/15 rounded-full blur-3xl pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Social Proof ─── */}
        <section ref={socialRef} className="py-16 border-y border-border bg-surface/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="reveal grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 items-center">
              {stats.map((s) => (
                <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
              ))}
              <div className="text-center hidden md:block">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-text">4.9</div>
                <div className="text-sm text-text-secondary mt-1">Average Rating</div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── How It Works ─── */}
        <section id="how-it-works" ref={stepsRef} className="py-24 md:py-32 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <div className="reveal"><Badge variant="accent" className="mb-4">How It Works</Badge></div>
              <h2 className="reveal reveal-delay-1 text-3xl sm:text-4xl md:text-5xl font-bold text-text mb-4 tracking-tight">Three simple steps</h2>
              <p className="reveal reveal-delay-2 text-text-secondary text-lg max-w-xl mx-auto">From upload to viral clips in minutes, not hours.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
              <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              {steps.map((step, i) => (
                <div key={step.num} className={cn("reveal", `reveal-delay-${i + 1}`)}>
                  <Card className="text-center p-8 lg:p-10 relative bg-surface">
                    <div className="relative inline-flex mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-primary/25">
                        {step.num}
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-text mb-3">{step.title}</h3>
                    <p className="text-text-secondary leading-relaxed">{step.desc}</p>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Features ─── */}
        <section id="features" ref={featuresRef} className="py-24 md:py-32 px-4 sm:px-6 bg-surface/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <div className="reveal"><Badge variant="accent" className="mb-4">Features</Badge></div>
              <h2 className="reveal reveal-delay-1 text-3xl sm:text-4xl md:text-5xl font-bold text-text mb-4 tracking-tight">Everything you need to go viral</h2>
              <p className="reveal reveal-delay-2 text-text-secondary text-lg max-w-xl mx-auto">Professional AI tools built for creators who want real results.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
              {features.map((f, i) => (
                <div key={f.title} className={cn("reveal", `reveal-delay-${Math.min(i + 1, 6)}`)}>
                  <Card hover className="p-6 h-full">
                    <FeatureIcon icon={f.icon} />
                    <h3 className="text-lg font-semibold text-text mb-2">{f.title}</h3>
                    <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Testimonials ─── */}
        <section ref={testimonialsRef} className="py-24 md:py-32 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <div className="reveal"><Badge variant="accent" className="mb-4">Testimonials</Badge></div>
              <h2 className="reveal reveal-delay-1 text-3xl sm:text-4xl md:text-5xl font-bold text-text mb-4 tracking-tight">Creators love Velora</h2>
              <p className="reveal reveal-delay-2 text-text-secondary text-lg max-w-xl mx-auto">Join thousands of creators already turning long-form into viral content.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
              {testimonials.map((t, i) => (
                <div key={t.name} className={cn("reveal", `reveal-delay-${i + 1}`)}>
                  <Card className="p-6 lg:p-7 h-full flex flex-col">
                    <div className="flex items-center gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-4 h-4 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="text-text-secondary text-sm leading-relaxed mb-6 flex-1">"{t.text}"</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {t.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text truncate">{t.name}</p>
                        <p className="text-xs text-text-muted truncate">{t.role}</p>
                      </div>
                      <div className="ml-auto flex-shrink-0">
                        <Badge variant="viral" size="sm">{t.score}</Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Pricing ─── */}
        <section id="pricing" ref={pricingRef} className="py-24 md:py-32 px-4 sm:px-6 bg-surface/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <div className="reveal"><Badge variant="accent" className="mb-4">Pricing</Badge></div>
              <h2 className="reveal reveal-delay-1 text-3xl sm:text-4xl md:text-5xl font-bold text-text mb-4 tracking-tight">Simple, transparent pricing</h2>
              <p className="reveal reveal-delay-2 text-text-secondary text-lg max-w-xl mx-auto">Start free. Upgrade when you need more. No hidden fees.</p>
            </div>

            <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 max-w-7xl mx-auto mb-12">
              {pricing.map((plan, i) => (
                <div key={plan.name} className={cn("reveal snap-center flex-shrink-0 w-[280px] sm:w-[300px]", `reveal-delay-${Math.min(i + 1, 6)}`)}>
                  <Card className={cn("p-7 lg:p-8 relative h-full flex flex-col", plan.popular && "border-primary/30 shadow-xl shadow-primary/10")}>
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge variant="viral" size="sm">Most Popular</Badge>
                      </div>
                    )}
                    {plan.badge && !plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge variant="highlight" size="sm">{plan.badge}</Badge>
                      </div>
                    )}
                    <div className="mb-6">
                      <span className="text-text-muted text-xs uppercase tracking-wider font-medium">{plan.name}</span>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-5xl font-bold text-text">{plan.price}</span>
                        <span className="text-text-secondary text-sm">{plan.period}</span>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">{plan.credits}</p>
                      <p className="mt-2 text-xs text-text-muted">{plan.description}</p>
                    </div>
                    <ul className="space-y-2.5 mb-8 flex-1">
                      {plan.features.map((f) => (
                        <li key={f.text} className="flex items-start gap-2.5 text-sm text-text-secondary">
                          <Check className="w-4 h-4 text-highlight flex-shrink-0 mt-0.5" />
                          <span>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                    <SignedOut>
                      <Button className="w-full" variant={plan.variant} size="lg" asChild>
                        <Link to="/signup">{plan.cta}</Link>
                      </Button>
                    </SignedOut>
                    <SignedIn>
                      <Button className="w-full" variant={plan.variant} size="lg" asChild>
                        <Link to="/billing">{plan.cta}</Link>
                      </Button>
                    </SignedIn>
                  </Card>
                </div>
              ))}
            </div>

            <div className="reveal">
              <p className="text-center text-sm text-text-muted mb-6 uppercase tracking-wider font-medium">Need more credits? Buy packs anytime.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
                {creditPacks.map((pack) => (
                  <Card key={pack.name} hover className={cn("p-4 text-center relative", pack.bestValue && "border-primary/30")}>
                    {pack.bestValue && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <Badge variant="primary" size="sm">Best Value</Badge>
                      </div>
                    )}
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-2">{pack.name}</p>
                    <p className="text-2xl font-bold text-text">{pack.credits}</p>
                    <p className="text-sm text-text-secondary mt-1">{pack.price}</p>
                    <p className="text-xs text-text-muted mt-1">{pack.perCredit}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" ref={faqRef} className="py-24 md:py-32 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <div className="reveal"><Badge variant="accent" className="mb-4">FAQ</Badge></div>
              <h2 className="reveal reveal-delay-1 text-3xl sm:text-4xl md:text-5xl font-bold text-text mb-4 tracking-tight">Common questions</h2>
              <p className="reveal reveal-delay-2 text-text-secondary text-lg">Everything you need to know about Velora.</p>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className={cn("reveal", `reveal-delay-${Math.min(i + 1, 6)}`)}>
                  <Card className="overflow-hidden">
                    <details className="group">
                      <summary className="flex items-center justify-between gap-4 p-5 sm:p-6 cursor-pointer list-none select-none">
                        <span className="font-medium text-text">{faq.q}</span>
                        <ChevronDown className="w-5 h-5 text-text-secondary group-open:rotate-180 transition-transform duration-300 flex-shrink-0" />
                      </summary>
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-text-secondary text-sm leading-relaxed border-t border-border pt-4">
                        {faq.a}
                      </div>
                    </details>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section ref={ctaRef} className="relative py-24 md:py-32 px-4 sm:px-6 overflow-hidden">
          <div className="hero-glow-primary top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
          <div className="hero-glow-accent top-0 right-0 opacity-30" />
          <div className="max-w-3xl mx-auto text-center relative">
            <h2 className="reveal text-3xl sm:text-4xl md:text-5xl font-bold text-text mb-6 tracking-tight">
              Ready to create your first viral clips?
            </h2>
            <p className="reveal reveal-delay-1 text-text-secondary text-lg mb-8 max-w-lg mx-auto">
              Join thousands of creators using Velora to grow their audience with AI-powered content.
            </p>
            <div className="reveal reveal-delay-2 flex flex-col sm:flex-row gap-3 justify-center">
              <SignedOut>
                <Button size="xl" asChild>
                  <Link to="/signup">
                    Start Free - 100 Credits
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button size="xl" asChild>
                  <Link to="/dashboard/create">
                    Create Project
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
              </SignedIn>
              <Button variant="secondary" size="xl" asChild>
                <a href="#pricing">View Pricing</a>
              </Button>
            </div>
            <div className="reveal reveal-delay-3 mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-text-secondary">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-highlight flex-shrink-0" />
                <span>Setup in 30 seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-highlight flex-shrink-0" />
                <span>No credit card needed</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-highlight flex-shrink-0" />
                <span>Results in minutes</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border bg-surface/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10 lg:gap-16">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/veloralogo.png" alt="Velora" className="w-9 h-9 rounded-xl object-contain" />
                <span className="font-bold text-xl text-text tracking-tight">Velora</span>
              </div>
              <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
                Turn long-form videos into viral short-form content with AI.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm text-text-secondary">
                <li><a href="#features" className="hover:text-text transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-text transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-text transition-colors">How It Works</a></li>
                <li><a href="#faq" className="hover:text-text transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text mb-4">Company</h4>
              <ul className="space-y-2.5 text-sm text-text-secondary">
                <li><a href="#" className="hover:text-text transition-colors">About</a></li>
                <li><a href="#" className="hover:text-text transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-text transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-text transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm text-text-secondary">
                <li><a href="#" className="hover:text-text transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-text transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-text transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-text-muted text-sm">&copy; 2026 Velora. All rights reserved.</p>
            <div className="flex items-center gap-5 text-sm text-text-muted">
              <a href="#" className="hover:text-text transition-colors">Twitter</a>
              <a href="#" className="hover:text-text transition-colors">Discord</a>
              <a href="#" className="hover:text-text transition-colors">YouTube</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
