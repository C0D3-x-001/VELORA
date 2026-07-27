import { useState, useMemo, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Video, TrendingUp, CreditCard, Clock, Download,
  Trash2, Sparkles, AlertCircle, Zap, Play, Upload,
  Link2, BarChart3, Flame, ChevronRight, TrendingDown, ArrowUpRight, Crown, Gift
} from "lucide-react";
import { useUser } from "../../lib/auth";
import { useProjects, useDeleteProject, useCredits, useCreditTransactions } from "../../hooks/queries";
import { useToast } from "../../components/ui/Toast/Toast";
import { formatDuration, formatCredits, cn, getErrorMessage, formatNumber } from "../../lib/utils";
import Button from "../../components/ui/Button/Button";
import Card from "../../components/ui/Card/Card";
import Badge from "../../components/ui/Badge/Badge";
import Modal from "../../components/ui/Modal/Modal";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import { SkeletonDashboard } from "../../components/ui/Skeleton/Skeleton";

const STATUS_CONFIG = {
  completed: { label: "Completed", variant: "success" },
  processing: { label: "Processing", variant: "warning" },
  analyzing: { label: "Analyzing", variant: "accent" },
  downloading: { label: "Downloading", variant: "highlight" },
  transcribing: { label: "Transcribing", variant: "primary" },
  uploading: { label: "Uploading", variant: "primary" },
  failed: { label: "Failed", variant: "danger" },
  created: { label: "Queued", variant: "default" },
};

const StatCard = memo(function StatCard({ icon: Icon, label, value, accent, trend, action }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", accent)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {trend !== undefined && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md",
            trend >= 0 ? "text-success bg-success/10" : "text-danger bg-danger/10"
          )}>
            <TrendingUp className={cn("w-3 h-3", trend < 0 && "rotate-180")} />
            {Math.abs(trend)}
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-text tabular-nums">{value}</p>
      {action && (
        <Link to={action.href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover mt-2 transition-colors">
          {action.label}
          <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </Card>
  );
});

const ProjectCard = memo(function ProjectCard({ project, onClick, onDelete }) {
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.created;
  const isTerminal = project.status === "completed" || project.status === "failed";

  return (
    <Card
      hover
      className="p-0 overflow-hidden group"
      onClick={onClick}
    >
      <div className="aspect-video bg-bg relative overflow-hidden">
        {project.thumbnail_url ? (
          <>
            <img
              src={project.thumbnail_url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-subtle">
            <Video className="w-10 h-10 text-text-muted" />
          </div>
        )}

        <div className="absolute top-2.5 left-2.5">
          <Badge variant={status.variant} size="sm">{status.label}</Badge>
        </div>

        {project.avg_viral_score != null && (
          <div className="absolute top-2.5 right-2.5">
            <Badge variant="viral" size="sm">
              <Flame className="w-3 h-3" />
              {project.avg_viral_score}
            </Badge>
          </div>
        )}

        {isTerminal && project.thumbnail_url && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}
      </div>

      <div className="p-3.5 sm:p-4">
        <h3 className="font-semibold text-sm text-text truncate mb-1.5">{project.title}</h3>
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          {project.duration_seconds > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(project.duration_seconds)}
            </span>
          )}
          {project.clips_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <Video className="w-3.5 h-3.5" />
              {project.clips_count} clip{project.clips_count !== 1 ? "s" : ""}
            </span>
          )}
          {project.status === "completed" && !project.clips_count && (
            <span className="inline-flex items-center gap-1 text-text-muted">
              <AlertCircle className="w-3 h-3" />
              No clips found
            </span>
          )}
        </div>

        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          {isTerminal ? (
            <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" asChild>
              <Link to={`/dashboard/projects/${project.id}/results`}>
                <Download className="w-3.5 h-3.5" />
                <span>View Clips</span>
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" asChild>
              <Link to={`/dashboard/projects/${project.id}/processing`}>
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Progress</span>
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-text-secondary hover:text-danger hover:bg-danger/10"
            onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
            aria-label={`Delete ${project.title}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
});

function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { icon: Link2, label: "Paste YouTube URL", desc: "Analyze any public video", href: "/dashboard/create", color: "bg-primary/10 text-primary" },
        { icon: Upload, label: "Upload Video", desc: "Drag & drop or browse", href: "/dashboard/create", color: "bg-accent/10 text-accent" },
        { icon: Zap, label: "Buy Credits", desc: "10-25 per clip", href: "/billing", color: "bg-highlight/10 text-highlight" },
      ].map(({ icon: Icon, label, desc, href, color }) => (
        <Link
          key={label}
          to={href}
          className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-surface hover:bg-surface-hover hover:border-border transition-all duration-200 group"
        >
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110", color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text truncate">{label}</p>
            <p className="text-xs text-text-secondary truncate">{desc}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted ml-auto flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text-secondary" />
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { data: projects, isLoading, error } = useProjects();
  const { data: creditsData } = useCredits();
  const { data: transactions } = useCreditTransactions({ limit: 5 });
  const deleteMutation = useDeleteProject();
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleDelete = (id) => setDeleteConfirm(id);
  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm, {
        onSuccess: () => {
          toast({ title: "Project deleted", description: "The project and all its clips have been removed.", type: "success" });
          setDeleteConfirm(null);
        },
        onError: () => {
          toast({ title: "Delete failed", description: "Something went wrong. Please try again.", type: "error" });
          setDeleteConfirm(null);
        },
      });
    }
  };

  const recentSpend = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter(t => t.type === "spent" && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [transactions]);

  const recentEarned = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter(t => ["earned", "purchase", "subscription_grant", "welcome_bonus"].includes(t.type) && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const projectStats = useMemo(() => {
    if (!projects) return { projectCount: 0, totalClips: 0, avgScore: null, completedCount: 0, processingProjects: [] };
    const projectCount = projects.length;
    const totalClips = projects.reduce((sum, p) => sum + (p.clips_count || 0), 0);
    const scores = projects.filter(p => p.avg_viral_score).map(p => p.avg_viral_score);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const completedCount = projects.filter(p => p.status === "completed").length;
    const processingProjects = projects.filter(p => !["completed", "failed", "created"].includes(p.status));
    return { projectCount, totalClips, avgScore, completedCount, processingProjects };
  }, [projects]);

  if (isLoading) return <SkeletonDashboard />;

  if (error) {
    return (
      <EmptyState
        variant="danger"
        icon={<AlertCircle className="w-7 h-7" />}
        title="Failed to load dashboard"
        description={getErrorMessage(error, "Something went wrong while loading your data.")}
        action={{ onClick: () => window.location.reload(), children: "Retry" }}
        secondaryAction={{ onClick: () => window.location.reload(), children: "Reload Page" }}
      />
    );
  }

  const userName = user?.firstName || "Creator";
  const userCredits = creditsData?.balance ?? 0;
  const userPlan = creditsData?.plan || "free";
  const PLAN_CREDITS = { free: 100, starter: 1000, creator: 5000, pro: 15000, business: 50000 };
  const maxCredits = PLAN_CREDITS[userPlan] || 100;
  const progressPercent = Math.min((userCredits / maxCredits) * 100, 100);
  const { projectCount, totalClips, avgScore, completedCount, processingProjects } = projectStats;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const isEmpty = projectCount === 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text flex items-center gap-2.5">
            {greeting}, {userName}
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-highlight animate-pulse-soft" />
          </h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1">
            {isEmpty ? "Let's create your first viral clip" : "Ready to create more viral content?"}
          </p>
        </div>
        <Button asChild variant="primary" size="md">
          <Link to="/dashboard/create">
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </Link>
        </Button>
      </div>

      {/* Credit Card */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-surface via-surface to-surface-overlay">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Available Credits</p>
              <p className="text-3xl sm:text-4xl font-bold text-text tabular-nums">{formatCredits(userCredits)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={userPlan === "free" ? "default" : userPlan === "creator" ? "viral" : "accent"} size="md">
              <Crown className="w-3.5 h-3.5 mr-1" /> {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan
            </Badge>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/billing">
                <ArrowUpRight className="w-4 h-4 mr-1" /> Upgrade
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-text-secondary">Credit Balance</span>
              <span className="font-bold text-text">{formatCredits(userCredits)} / {formatCredits(maxCredits)}</span>
            </div>
            <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-primary to-accent"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-text-secondary mt-1">
              {progressPercent >= 100 ? "Credits low" : `${Math.round(progressPercent)}% of monthly allocation remaining`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
            <div className="text-center p-3 rounded-xl bg-surface-overlay">
              <p className="text-2xl font-bold text-text">{formatCredits(maxCredits)}</p>
              <p className="text-xs text-text-secondary mt-1">Monthly Allocation</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-surface-overlay">
              <p className="text-2xl font-bold text-success">+{formatCredits(recentEarned)}</p>
              <p className="text-xs text-text-secondary mt-1">Added This Period</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-surface-overlay">
              <p className="text-2xl font-bold text-danger">-{formatCredits(recentSpend)}</p>
              <p className="text-xs text-text-secondary mt-1">Spent This Period</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Video}
          label="Projects"
          value={projectCount}
          accent="bg-accent/10 text-accent"
          trend={completedCount > 0 ? completedCount : undefined}
          action={{ label: "View all", href: "/dashboard" }}
        />
        <StatCard
          icon={Zap}
          label="Clips Generated"
          value={totalClips}
          accent="bg-highlight/10 text-highlight"
        />
        <StatCard
          icon={Flame}
          label="Avg Viral Score"
          value={avgScore != null ? avgScore : "—"}
          accent="bg-green-500/10 text-green-400"
        />
        <StatCard
          icon={Sparkles}
          label="Total Spend"
          value={formatCredits(recentSpend)}
          accent="bg-primary/10 text-primary"
        />
      </div>

      {/* Processing indicator */}
      {processingProjects.length > 0 && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-4 h-4 text-primary animate-pulse-soft" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">
                {processingProjects.length} project{processingProjects.length !== 1 ? "s" : ""} processing
              </p>
              <p className="text-xs text-text-secondary truncate">
                {processingProjects.map(p => p.title).join(", ")}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs flex-shrink-0" asChild>
              <Link to={`/dashboard/projects/${processingProjects[0].id}/processing`}>
                View
                <ChevronRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-text">Recent Credit Activity</h2>
            <p className="text-xs text-text-muted mt-0.5">Latest transactions and credit changes</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link to="/billing">
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
        {transactions?.length ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {transactions.slice(0, 5).map((tx, i) => {
              const isPositive = tx.amount > 0;
              const typeColors = {
                spent: "bg-danger/10 text-danger",
                earned: "bg-success/10 text-success",
                purchase: "bg-primary/10 text-primary",
                refund: "bg-highlight/10 text-highlight",
                adjustment: "bg-accent/10 text-accent",
                subscription_grant: "bg-primary/10 text-primary",
                welcome_bonus: "bg-success/10 text-success",
              };
              const icons = {
                spent: TrendingDown,
                earned: Sparkles,
                purchase: ArrowUpRight,
                refund: TrendingUp,
                adjustment: Sparkles,
                subscription_grant: Crown,
                welcome_bonus: Gift,
              };
              const Icon = icons[tx.type] || Sparkles;
              const date = tx.created_at
                ? new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "";
              return (
                <div key={tx.id || i} className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-subtle transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", typeColors[tx.type] || "bg-surface-overlay text-text-secondary")}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{tx.reason || tx.type}</p>
                      <p className="text-[11px] text-text-muted">{date}</p>
                    </div>
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums", isPositive ? "text-success" : "text-danger")}>
                    {isPositive ? "+" : ""}{formatNumber(Math.abs(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-text-secondary text-sm">No recent transactions</p>
            <p className="text-xs text-text-muted mt-1">Generate clips or purchase credits to see activity here</p>
          </div>
        )}
      </Card>

      {/* Projects Section */}
      {!isEmpty && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-text">Recent Projects</h2>
              <p className="text-xs text-text-muted mt-0.5">{projectCount} total</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
              <Link to="/dashboard/create">
                <Plus className="w-3.5 h-3.5" />
                New
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects?.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(
                  ["completed", "failed"].includes(project.status)
                    ? `/dashboard/projects/${project.id}/results`
                    : `/dashboard/projects/${project.id}/processing`
                )}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="space-y-6">
          <EmptyState
            icon={<Play className="w-7 h-7 ml-0.5" fill="currentColor" />}
            title="No projects yet"
            description="Upload a video or paste a YouTube URL. Velora will analyze the content and generate viral-ready clips with captions."
            action={{ asChild: true, children: <Link to="/dashboard/create"><Plus className="w-4 h-4" /> Create Your First Project</Link> }}
            secondaryAction={{ asChild: true, children: <Link to="/billing"><CreditCard className="w-4 h-4" /> Buy Credits</Link> }}
          />

          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 text-center">Quick Actions</p>
            <QuickActions />
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Project" size="sm">
        <p className="text-sm text-text-secondary mb-6">
          Are you sure you want to delete this project? This action cannot be undone and all clips will be permanently removed.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
