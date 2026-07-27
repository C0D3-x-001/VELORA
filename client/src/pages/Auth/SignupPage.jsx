import { Link } from "react-router-dom";
import { SignUp } from "../../lib/auth";
import { Zap, Shield, Clock, Gift } from "lucide-react";

const benefits = [
  { icon: Gift, title: "100 Free Credits", desc: "Start generating clips immediately, no card required." },
  { icon: Zap, title: "AI-Powered Pipeline", desc: "Transcription, analysis, clipping, and captions — fully automated." },
  { icon: Shield, title: "No Watermark", desc: "Clean clips ready for YouTube Shorts, TikTok, and Reels." },
  { icon: Clock, title: "Minutes, Not Hours", desc: "A 2-hour podcast becomes 10 viral clips in under 5 minutes." },
];

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-bg flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-accent/10 via-surface to-highlight/10 items-center justify-center p-12">
        <div className="absolute top-20 right-20 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-highlight/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-md space-y-10">
          <div>
            <Link to="/" className="inline-flex items-center gap-3 mb-8">
              <img src="/veloralogo.png" alt="Velora" className="w-12 h-12 rounded-xl object-contain" />
              <span className="font-bold text-2xl text-text">Velora</span>
            </Link>
            <h2 className="text-4xl font-bold text-text leading-tight">
              Start creating{" "}
              <span className="text-gradient">viral clips today</span>
            </h2>
            <p className="text-text-secondary text-lg mt-4">
              Join thousands of creators using AI to turn long-form content into scroll-stopping short-form clips.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {benefits.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-4 rounded-xl bg-surface/60 backdrop-blur border border-border space-y-2">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="font-semibold text-text text-sm">{title}</h3>
                <p className="text-text-secondary text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 text-sm text-text-muted">
            <div className="flex -space-x-2">
              {["bg-primary", "bg-accent", "bg-highlight", "bg-green-500"].map((bg, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-surface flex items-center justify-center text-white text-xs font-bold`}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <span>2,400+ creators already signed up</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden">
            <Link to="/" className="inline-flex items-center gap-3 mb-6">
              <img src="/veloralogo.png" alt="Velora" className="w-10 h-10 rounded-xl object-contain" />
              <span className="font-bold text-xl text-text">Velora</span>
            </Link>
            <h1 className="text-2xl font-bold text-text">Create your account</h1>
            <p className="text-text-secondary mt-2">Start with 100 free credits — no card required</p>
          </div>

          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-4">
              <Zap className="w-3.5 h-3.5" />
              100 free credits included
            </div>
            <h1 className="text-2xl font-bold text-text">Create your account</h1>
            <p className="text-text-secondary mt-1">Get started in seconds — no credit card needed</p>
          </div>

          <SignUp
            routing="path"
            path="/signup"
            afterSignUpUrl="/dashboard"
            signInUrl="/login"
          />

          <p className="text-center text-text-secondary text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
