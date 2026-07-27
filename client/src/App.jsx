import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { SignedIn } from "./lib/auth";
import AppLayout from "./components/layout/AppLayout";
import Spinner from "./components/ui/Spinner/Spinner";
import ErrorBoundary from "./components/ErrorBoundary";

const LandingPage = lazy(() => import("./pages/Landing/LandingPage"));
const LoginPage = lazy(() => import("./pages/Auth/LoginPage"));
const SignupPage = lazy(() => import("./pages/Auth/SignupPage"));
const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage"));
const CreateProjectPage = lazy(() => import("./pages/CreateProject/CreateProjectPage"));
const ProcessingPage = lazy(() => import("./pages/Processing/ProcessingPage"));
const ResultsPage = lazy(() => import("./pages/Results/ResultsPage"));
const ClipEditorPage = lazy(() => import("./pages/ClipEditor/ClipEditorPage"));
const BillingPage = lazy(() => import("./pages/Billing/BillingPage"));
const SettingsPage = lazy(() => import("./pages/Settings/SettingsPage"));

function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner size="lg" />
    </div>
  );
}

function ProtectedRoute() {
  return (
    <SignedIn>
      <Outlet />
    </SignedIn>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login/*" element={<LoginPage />} />
        <Route path="/signup/*" element={<SignupPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/create" element={<CreateProjectPage />} />
            <Route path="/dashboard/projects/:id/processing" element={<ProcessingPage />} />
            <Route path="/dashboard/projects/:id/results" element={<ResultsPage />} />
            <Route path="/dashboard/projects/:id/clips/:clipId/edit" element={<ClipEditorPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
