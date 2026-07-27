import { useEffect } from "react";
import { getDevUser } from "./clerkConfig";
import { useClerkAuth } from "./ClerkAuthContext";
import { Link } from "react-router-dom";
import {
  useUser as clerkUseUser,
  useAuth as clerkUseAuth,
  useClerk as clerkUseClerk,
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  RedirectToSignIn as ClerkRedirect,
  UserButton as ClerkUserButton,
  SignIn as ClerkSignIn,
  SignUp as ClerkSignUp,
} from "@clerk/clerk-react";

const devUser = getDevUser();

export function useUser() {
  const { clerkAvailable } = useClerkAuth();
  let clerkResult = null;
  try { clerkResult = clerkUseUser(); } catch {}
  if (clerkAvailable && clerkResult) return clerkResult;
  return { user: devUser.user, isLoaded: true, isSignedIn: true };
}

export function useAuth() {
  const { clerkAvailable } = useClerkAuth();
  let clerkResult = null;
  try { clerkResult = clerkUseAuth(); } catch {}
  if (clerkAvailable && clerkResult) return clerkResult;
  return { isSignedIn: true, userId: "dev_user_001", isLoaded: true };
}

export function useSignOut() {
  const { clerkAvailable } = useClerkAuth();
  let clerk = null;
  try { clerk = clerkUseClerk(); } catch {}
  if (clerkAvailable && clerk) {
    return async () => { await clerk.signOut(); window.location.href = "/"; };
  }
  return () => { window.location.href = "/"; };
}

export function SignedIn({ children }) {
  const { clerkAvailable } = useClerkAuth();
  if (!clerkAvailable) return <>{children}</>;
  return <ClerkSignedIn>{children}</ClerkSignedIn>;
}

export function SignedOut({ children }) {
  const { clerkAvailable } = useClerkAuth();
  if (!clerkAvailable) return null;
  return <ClerkSignedOut>{children}</ClerkSignedOut>;
}

export function RedirectToSignIn() {
  const { clerkAvailable } = useClerkAuth();
  useEffect(() => {
    if (!clerkAvailable) {
      window.location.href = "/login";
    }
  }, [clerkAvailable]);
  if (!clerkAvailable) return null;
  return <ClerkRedirect />;
}

export function UserButton(props) {
  const { clerkAvailable } = useClerkAuth();
  if (!clerkAvailable) {
    return (
      <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
        C
      </div>
    );
  }
  return <ClerkUserButton {...props} />;
}

export function SignIn(props) {
  const { clerkAvailable } = useClerkAuth();
  if (!clerkAvailable) {
    return (
      <div className="text-center py-8">
        <p className="text-text-secondary mb-4">Clerk not configured. Add your key to .env</p>
        <Link to="/dashboard" className="text-primary hover:underline text-sm font-medium">
          Go to Dashboard (dev mode)
        </Link>
      </div>
    );
  }
  return <ClerkSignIn {...props} />;
}

export function SignUp(props) {
  const { clerkAvailable } = useClerkAuth();
  if (!clerkAvailable) {
    return (
      <div className="text-center py-8">
        <p className="text-text-secondary mb-4">Clerk not configured. Add your key to .env</p>
        <Link to="/dashboard" className="text-primary hover:underline text-sm font-medium">
          Go to Dashboard (dev mode)
        </Link>
      </div>
    );
  }
  return <ClerkSignUp {...props} />;
}
