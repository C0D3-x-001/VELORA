import { Link } from "react-router-dom";
import { SignIn } from "../../lib/auth";
import { Film, Sparkles, Target } from "lucide-react";

const features = [
  { icon: Film, title: "AI Clip Detection", desc: "Find the strongest moments in any video automatically." },
  { icon: Sparkles, title: "Auto Captions", desc: "Professional captions in Modern, Karaoke, or Minimal style." },
  { icon: Target, title: "Viral Score", desc: "Every clip scored 0-100 with AI-powered engagement prediction." },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/10 via-surface to-accent/10 items-center justify-center p-12">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-highlight/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-md space-y-10">
          <div>
            <Link to="/" className="inline-flex items-center gap-3 mb-8">
              <img src="/veloralogo.png" alt="Velora" className="w-12 h-12 rounded-xl object-contain" />
              <span className="font-bold text-2xl text-text">Velora</span>
            </Link>
            <h2 className="text-4xl font-bold text-text leading-tight">
              Turn long videos into{" "}
              <span className="text-gradient">viral short-form content</span>
            </h2>
            <p className="text-text-secondary text-lg mt-4">
              Upload a podcast, interview, or YouTube video. Velora finds the best moments, adds captions, and gives you ready-to-post clips.
            </p>
          </div>

          <div className="space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-4 rounded-xl bg-surface/60 backdrop-blur border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-text text-sm">{title}</h3>
                  <p className="text-text-secondary text-sm mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-text-muted text-sm">
            "Velora cut my editing time from 3 hours to 5 minutes." — Creator with 100K+ subscribers
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden">
            <Link to="/" className="inline-flex items-center gap-3 mb-6">
              <img src="/veloralogo.png" alt="Velora" className="w-10 h-10 rounded-xl object-contain" />
              <span className="font-bold text-xl text-text">Velora</span>
            </Link>
            <h1 className="text-2xl font-bold text-text">Welcome back</h1>
            <p className="text-text-secondary mt-2">Sign in to continue creating viral clips</p>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-2xl font-bold text-text">Sign in to Velora</h1>
            <p className="text-text-secondary mt-1">Enter your credentials to access your account</p>
          </div>

          <SignIn
            routing="path"
            path="/login"
            afterSignInUrl="/dashboard"
            signUpUrl="/signup"
          />

          <p className="text-center text-text-secondary text-sm">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Start free with 100 credits
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
