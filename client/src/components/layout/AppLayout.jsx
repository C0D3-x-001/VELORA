import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "../../lib/utils";
import { Menu, X, LayoutDashboard, Video, CreditCard, Settings, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { UserButton, SignedIn, SignedOut, useSignOut, useUser } from "../../lib/auth";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/dashboard/create", label: "Create Project", icon: Video },
  { path: "/billing", label: "Billing", icon: CreditCard },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const signOut = useSignOut();
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-bg flex">
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-surface/95 backdrop-blur-glass border-r border-border transition-all duration-300 ease-out flex-col hidden lg:flex",
          collapsed ? "w-20" : "w-64"
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          {!collapsed && (
            <span className="flex items-center gap-2 text-display-sm text-primary">
                <img src="/veloralogo.png" alt="Velora" className="w-6 h-6 rounded-lg object-contain mix-blend-screen" />
              Velora
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-xl text-text-secondary hover:text-text hover:bg-surface-subtle transition-all duration-200"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Desktop sidebar navigation">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-body-sm font-medium text-text-secondary transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-glow-primary"
                  : "hover:text-text hover:bg-surface-subtle border border-transparent"
              )}
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <SignedIn>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-subtle">
              <UserButton afterSignOutUrl="/" />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium text-text truncate">{user?.firstName || user?.username || "Creator"}</p>
                  <p className="text-body-xs text-text-muted truncate">{user?.primaryEmailAddress?.emailAddress || ""}</p>
                </div>
              )}
            </div>
            <button
              onClick={signOut}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-text-secondary hover:text-danger hover:bg-danger/10 transition-all duration-200",
                collapsed && "justify-center"
              )}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-body-sm font-medium">Log Out</span>}
            </button>
          </SignedIn>
          <SignedOut>
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-text-secondary text-body-sm">Sign in to continue</span>
            </div>
          </SignedOut>
        </div>
      </aside>

      <div className={cn("flex-1 flex flex-col min-w-0", collapsed ? "lg:ml-20" : "lg:ml-64")}>
        <header className="h-16 bg-bg/80 backdrop-blur-glass border-b border-border sticky top-0 z-30">
          <div className="flex items-center justify-between h-full px-6">
            <button
              className="lg:hidden p-2 rounded-xl text-text-secondary hover:text-text hover:bg-surface-subtle transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1 lg:hidden" />
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <NavLink to="/login" className="text-text-secondary hover:text-text text-body-sm font-medium">
                Sign In
              </NavLink>
            </SignedOut>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        >
          <aside className="fixed left-0 top-0 h-full w-64 bg-surface border-r border-border animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between h-16 px-4 border-b border-border">
              <span className="flex items-center gap-2 text-display-sm text-primary">
              <img src="/veloralogo.png" alt="Velora" className="w-6 h-6 rounded-lg object-contain mix-blend-screen" />
                Velora
              </span>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl text-text-secondary hover:text-text hover:bg-surface-subtle transition-colors" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="px-3 py-4 space-y-1 pb-20 overflow-y-auto max-h-[calc(100vh-4rem)]" role="navigation" aria-label="Mobile sidebar navigation">
              {navItems.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-body-sm font-medium text-text-secondary transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "hover:text-text hover:bg-surface-subtle border border-transparent"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
              <button
                onClick={() => { setMobileOpen(false); signOut(); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-body-sm font-medium">Log Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}