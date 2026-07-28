import { useState, useEffect, useMemo, useRef } from "react";
import {
  User, Bell, Shield, Palette, Save, Check, Sun, Moon, Monitor,
  AlertTriangle, Mail, Lock, Eye, EyeOff, CheckCircle2, XCircle,
  AlertCircle, Trash2, Sparkles, Globe, Wand2
} from "lucide-react";
import { useUser, useSignOut } from "../../lib/auth";
import { useSettings, useUpdateSettings, useDeleteAccount, useUpdateEmail, useUpdatePassword } from "../../hooks/queries";
import { useTheme } from "../../lib/theme";
import { useToast } from "../../components/ui/Toast/Toast";
import Card from "../../components/ui/Card/Card";
import Button from "../../components/ui/Button/Button";
import Badge from "../../components/ui/Badge/Badge";
import Modal from "../../components/ui/Modal/Modal";
import { SkeletonCard } from "../../components/ui/Skeleton/Skeleton";
import { cn, getErrorMessage } from "../../lib/utils";
import CaptionEditor from "../../components/ui/CaptionEditor/CaptionEditor";

const captionStyles = [
  { value: "bounce", label: "Bounce", desc: "Words bounce in with energy" },
  { value: "highlight", label: "Highlight", desc: "Full sentence, current word highlighted" },
  { value: "karaoke", label: "Karaoke", desc: "Words light up as spoken" },
  { value: "classic", label: "Classic", desc: "Entire sentence at once" },
  { value: "minimal", label: "Minimal", desc: "Simple clean subtitles" },
  { value: "none", label: "None", desc: "No captions" },
];

const platforms = [
  { value: "vertical", label: "Vertical (9:16)", icon: "📱" },
  { value: "landscape", label: "Landscape (16:9)", icon: "🖥️" },
];

const closeUpModes = [
  { value: "closeup", label: "Close-Up", desc: "75% face" },
  { value: "medium", label: "Medium", desc: "45% face" },
  { value: "wide", label: "Wide", desc: "25% face" },
];

const tabs = [
  { id: "profile", label: "Profile", icon: User, desc: "Personal information" },
  { id: "preferences", label: "Preferences", icon: Palette, desc: "Defaults & appearance" },
  { id: "notifications", label: "Notifications", icon: Bell, desc: "Email & alerts" },
  { id: "security", label: "Security", icon: Shield, desc: "Password & account" },
];

function TabButton({ tab, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200",
        isActive
          ? "bg-primary/10 text-primary border border-primary/20 shadow-sm shadow-primary/10"
          : "text-text-secondary hover:text-text hover:bg-surface-subtle border border-transparent"
      )}
    >
      <tab.icon className="w-4.5 h-4.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{tab.label}</p>
        <p className="text-[11px] text-text-muted truncate">{tab.desc}</p>
      </div>
    </button>
  );
}

function Toggle({ checked, onChange, label, description, badge }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-text">{label}</p>
          {badge && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-accent/15 text-accent">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0",
          checked ? "bg-primary" : "bg-surface-overlay"
        )}
      >
        <span className={cn(
          "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm",
          checked && "translate-x-4"
        )} />
      </button>
    </label>
  );
}

function PasswordStrength({ password }) {
  const strength = useMemo(() => {
    if (!password) return null;
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (hasUpper && hasNumber) score++;
    if (hasSpecial) score++;
    if (score <= 1) return { level: 1, label: "Weak", color: "bg-danger", textColor: "text-danger" };
    if (score === 2) return { level: 2, label: "Fair", color: "bg-warning", textColor: "text-warning" };
    if (score === 3) return { level: 3, label: "Good", color: "bg-primary", textColor: "text-primary" };
    return { level: 4, label: "Strong", color: "bg-success", textColor: "text-success" };
  }, [password]);

  if (!strength) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= strength.level ? strength.color : "bg-surface-overlay")} />
        ))}
      </div>
      <p className="text-[11px] text-text-muted">
        Strength: <span className={cn("font-medium", strength.textColor)}>{strength.label}</span>
      </p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description, color = "bg-primary/10 text-primary" }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-text">{title}</h3>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const signOut = useSignOut();
  const { data: serverSettings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const deleteMutation = useDeleteAccount();
  const updateEmailMutation = useUpdateEmail();
  const updatePasswordMutation = useUpdatePassword();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const [captionStyle, setCaptionStyle] = useState("classic");
  const [captionPreset, setCaptionPreset] = useState("classic");
  const [captionPosition, setCaptionPosition] = useState("center");
  const [captionConfig, setCaptionConfig] = useState({
    verticalPct: 50,
    fontSize: 40,
    fontName: "Poppins",
    fontWeight: 700,
    textColor: "#FFFFFF",
    highlightColor: "#FFD700",
    highlightBg: "rgba(255,215,0,0.2)",
    highlightRadius: 6,
    highlightGlow: false,
    highlightScale: 1.15,
    animIn: 80,
    animOut: 80,
  });
  const [defaultPlatform, setDefaultPlatform] = useState("vertical");
  const [stabilization, setStabilization] = useState(true);
  const [faceTracking, setFaceTracking] = useState(true);
  const [autoReframe, setAutoReframe] = useState(true);
  const [closeUpFraming, setCloseUpFraming] = useState(false);
  const [closeUpMode, setCloseUpMode] = useState("closeup");
  const [autoPunchIn, setAutoPunchIn] = useState(false);
  const [autoSpeakerSwitch, setAutoSpeakerSwitch] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [processingNotifications, setProcessingNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const savedTimerRef = useRef(null);
  const emailTimerRef = useRef(null);
  const passwordTimerRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      if (passwordTimerRef.current) clearTimeout(passwordTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (serverSettings && !initializedRef.current) {
      initializedRef.current = true;
      const savedStyle = serverSettings.default_caption_style || "classic";
      const validPresets = ["bounce", "highlight", "karaoke", "classic", "minimal"];
      setCaptionStyle(validPresets.includes(savedStyle) ? "classic" : savedStyle);
      setCaptionPreset(validPresets.includes(savedStyle) ? savedStyle : (serverSettings.default_caption_preset || "classic"));
      setCaptionPosition(serverSettings.default_caption_position || "center");
      if (serverSettings.default_caption_config) setCaptionConfig(serverSettings.default_caption_config);
      setDefaultPlatform(serverSettings.default_platform || "vertical");
      setStabilization(serverSettings.default_stabilization ?? true);
      setFaceTracking(serverSettings.default_face_tracking ?? true);
      setAutoReframe(serverSettings.default_auto_reframe ?? true);
      setCloseUpFraming(serverSettings.default_close_up_framing ?? false);
      setCloseUpMode(serverSettings.default_close_up_mode || "closeup");
      setAutoPunchIn(serverSettings.default_auto_punch_in ?? false);
      setAutoSpeakerSwitch(serverSettings.default_auto_speaker_switch ?? true);
      setEmailNotifications(serverSettings.email_notifications ?? true);
      setProcessingNotifications(serverSettings.processing_notifications ?? true);
      setMarketingEmails(serverSettings.marketing_emails ?? false);
      if (serverSettings.theme) setTheme(serverSettings.theme);
      setDirty(false);
    }
    if (user) {
      setFullName(user?.fullName || "");
      setBio((prev) => prev || serverSettings.bio || "");
    }
  }, [serverSettings, user, setTheme]);

  const markDirty = () => { setDirty(true); setSaved(false); };

  const profileCompletion = useMemo(() => {
    const fields = [
      { label: "Full Name", value: fullName?.trim() },
      { label: "Bio", value: bio?.trim() },
      { label: "Email", value: user?.primaryEmailAddress?.emailAddress?.trim() },
    ];
    const filled = fields.filter((f) => f.value).length;
    return { fields, filled, total: fields.length, pct: Math.round((filled / fields.length) * 100) };
  }, [fullName, bio, user]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        default_caption_style: captionStyle,
        default_caption_preset: captionPreset,
        default_caption_position: captionPosition,
        default_caption_config: captionConfig,
        default_platform: defaultPlatform,
        default_stabilization: stabilization,
        default_face_tracking: faceTracking,
        default_auto_reframe: autoReframe,
        default_close_up_framing: closeUpFraming,
        default_close_up_mode: closeUpMode,
        default_auto_punch_in: autoPunchIn,
        default_auto_speaker_switch: autoSpeakerSwitch,
        email_notifications: emailNotifications,
        processing_notifications: processingNotifications,
        marketing_emails: marketingEmails,
        theme,
        full_name: fullName,
        bio,
      });
      setSaved(true);
      setDirty(false);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: "Save failed", description: getErrorMessage(err, "Failed to save settings."), type: "error" });
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    try {
      await deleteMutation.mutateAsync();
      await signOut();
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Failed to delete account. Please try again."));
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes("@")) return;
    try {
      await updateEmailMutation.mutateAsync({ email: newEmail, currentPassword: emailPassword || undefined });
      setEmailSaved(true);
      setNewEmail("");
      setEmailPassword("");
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      emailTimerRef.current = setTimeout(() => setEmailSaved(false), 3000);
      toast({ title: "Email updated", description: "Your email has been changed successfully.", type: "success" });
    } catch (err) {
      toast({ title: "Update failed", description: getErrorMessage(err, "Failed to update email."), type: "error" });
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 8) return;
    if (newPassword !== confirmPassword) return;
    try {
      await updatePasswordMutation.mutateAsync({ currentPassword: currentPassword || undefined, newPassword });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (passwordTimerRef.current) clearTimeout(passwordTimerRef.current);
      passwordTimerRef.current = setTimeout(() => setPasswordSaved(false), 3000);
      toast({ title: "Password updated", description: "Your password has been changed successfully.", type: "success" });
    } catch (err) {
      toast({ title: "Update failed", description: getErrorMessage(err, "Failed to update password."), type: "error" });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-surface-overlay rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-surface-overlay rounded-md animate-pulse" />
        </div>
        <div className="grid lg:grid-cols-[220px_1fr] gap-6">
          <SkeletonCard />
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Unsaved changes banner */}
      {dirty && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-warning/10 border border-warning/20 animate-slide-down">
          <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          <p className="text-xs font-medium text-warning">You have unsaved changes</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text">Settings</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage your account preferences</p>
        </div>
        <Button
          onClick={handleSave}
          variant={saved ? "success" : "primary"}
          className="h-10"
          disabled={!dirty || saved || updateMutation.isPending}
          loading={updateMutation.isPending}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar */}
        <aside>
          <Card className="glass-card p-3 lg:sticky lg:top-24">
            {/* Profile summary */}
            <div className="flex items-center gap-2.5 mb-3 px-2 py-2">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text truncate">{user?.firstName || "Creator"}</p>
                <p className="text-[11px] text-text-muted truncate">{user?.primaryEmailAddress?.emailAddress || ""}</p>
              </div>
            </div>
            <div className="h-px bg-border mx-2 mb-2" />
            {/* Tabs */}
            <div className="space-y-0.5">
              {tabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                />
              ))}
            </div>
          </Card>
        </aside>

        {/* Content */}
        <main className="space-y-5 min-w-0">
          {/* Profile */}
          {activeTab === "profile" && (
            <>
              <Card className="glass-card p-5">
                <h3 className="text-sm font-semibold text-text mb-3">Profile Completion</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-2 bg-surface-overlay rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        profileCompletion.pct === 100 ? "bg-success" : profileCompletion.pct >= 66 ? "bg-primary" : profileCompletion.pct >= 33 ? "bg-warning" : "bg-danger"
                      )}
                      style={{ width: `${profileCompletion.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-text">{profileCompletion.pct}%</span>
                </div>
                <div className="space-y-1.5">
                  {profileCompletion.fields.map((f) => (
                    <div key={f.label} className="flex items-center gap-2 text-xs">
                      {f.value ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-text-muted" />
                      )}
                      <span className={f.value ? "text-text-secondary" : "text-text-muted"}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="glass-card p-5 space-y-5">
                <SectionHeader icon={User} title="Personal Information" description="Your public profile details" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name</label>
                    <input
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); markDirty(); }}
                      placeholder="Your name"
                      className="w-full h-10 px-3 input-base text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
                    <input
                      value={user?.primaryEmailAddress?.emailAddress || ""}
                      disabled
                      className="w-full h-10 px-3 bg-surface-subtle border border-border rounded-xl text-sm text-text-muted cursor-not-allowed opacity-60"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => { setBio(e.target.value); markDirty(); }}
                    rows={3}
                    placeholder="Tell us about yourself"
                    className="w-full px-3 py-2.5 input-base text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Avatar</label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center">
                      <User className="w-7 h-7 text-primary" />
                    </div>
                    <Button variant="secondary" size="sm" className="h-9">Change Avatar</Button>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* Preferences */}
          {activeTab === "preferences" && (
            <>
              <Card className="glass-card p-5">
                <SectionHeader icon={Palette} title="Appearance" description="Choose your preferred color scheme" color="bg-accent/10 text-accent" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
                  {[
                    { value: "dark", label: "Dark", icon: Moon, desc: "Easy on the eyes" },
                    { value: "light", label: "Light", icon: Sun, desc: "Clean and bright" },
                    { value: "system", label: "System", icon: Monitor, desc: "Match OS" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setTheme(opt.value); markDirty(); }}
                      className={cn(
                        "p-4 rounded-xl border-2 text-center transition-all duration-200",
                        theme === opt.value
                          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                          : "border-border bg-surface hover:border-border-strong hover:bg-surface-subtle"
                      )}
                    >
                      <opt.icon className={cn("w-5 h-5 mx-auto mb-2", theme === opt.value ? "text-primary" : "text-text-secondary")} />
                      <p className="text-sm font-medium text-text">{opt.label}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="glass-card p-5">
                <SectionHeader icon={Sparkles} title="Default Caption Style" description="Applied automatically to new projects" color="bg-highlight/10 text-highlight" />
                <div className="grid grid-cols-2 gap-2.5 mt-4">
                  {captionStyles.map((cs) => (
                    <button
                      key={cs.value}
                      onClick={() => { setCaptionStyle(cs.value === "none" ? "none" : "classic"); setCaptionPreset(cs.value); markDirty(); }}
                      className={cn(
                        "p-3.5 rounded-xl border-2 text-left transition-all duration-200",
                        captionPreset === cs.value && captionStyle !== "none"
                          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                          : "border-border bg-surface hover:border-border-strong hover:bg-surface-subtle"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-text capitalize">{cs.label}</span>
                        {captionPreset === cs.value && captionStyle !== "none" && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-[11px] text-text-secondary">{cs.desc}</p>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="glass-card p-5">
                <SectionHeader icon={Globe} title="Default Platform" description="Optimizes aspect ratio and format" color="bg-green-500/10 text-green-400" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
                  {platforms.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => { setDefaultPlatform(p.value); markDirty(); }}
                      className={cn(
                        "p-4 rounded-xl border-2 text-center transition-all duration-200",
                        defaultPlatform === p.value
                          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                          : "border-border bg-surface hover:border-border-strong hover:bg-surface-subtle"
                      )}
                    >
                      <span className="text-2xl block mb-1.5">{p.icon}</span>
                      <span className="text-sm font-medium text-text">{p.label}</span>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Caption Position & Customization */}
              <Card className="glass-card p-5">
                <SectionHeader icon={Sparkles} title="Default Caption Customization" description="Configure appearance and position of captions" color="bg-purple-500/10 text-purple-400" />
                <CaptionEditor value={captionConfig} onChange={(v) => { setCaptionConfig(v); markDirty(); }} className="mt-4" />
              </Card>

              {/* Video Enhancements */}
              <Card className="glass-card p-5">
                <SectionHeader icon={Wand2} title="Video Enhancements" description="Default settings for AI-powered improvements" color="bg-cyan-500/10 text-cyan-400" />
                <div className="space-y-3 mt-4">
                  <Toggle checked={stabilization} onChange={(v) => { setStabilization(v); markDirty(); }} label="Video Stabilization" description="Smooth out shaky footage using FFmpeg vidstab" />
                  <Toggle checked={faceTracking} onChange={(v) => { setFaceTracking(v); markDirty(); }} label="AI Face Tracking" description="Keep faces centered and well-framed" />
                  <Toggle checked={autoReframe} onChange={(v) => { setAutoReframe(v); markDirty(); }} label="Smart Auto-Reframe" description="Reframe for target aspect ratio intelligently" />
                  <div className="border-t border-border pt-3 mt-3">
                    <Toggle checked={closeUpFraming} onChange={(v) => { setCloseUpFraming(v); markDirty(); }} label="AI Close-Up Framing" description="Smooth camera motion with face/speaker detection" badge="PRO" />
                    {closeUpFraming && (
                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        {closeUpModes.map((cm) => (
                          <button
                            key={cm.value}
                            onClick={() => { setCloseUpMode(cm.value); markDirty(); }}
                            className={cn(
                              "p-2 rounded-lg border text-center transition-all duration-200",
                              closeUpMode === cm.value
                                ? "border-primary bg-primary/5 text-text shadow-sm shadow-primary/10"
                                : "border-border bg-surface text-text-secondary hover:border-border-strong"
                            )}
                          >
                            <div className="text-xs font-medium">{cm.label}</div>
                            <div className="text-[9px] text-text-muted">{cm.desc}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 space-y-3">
                      <Toggle checked={autoPunchIn} onChange={(v) => { setAutoPunchIn(v); markDirty(); }} label="Auto Punch-In" description="Scale in during emphasis moments" badge="PRO" />
                      <Toggle checked={autoSpeakerSwitch} onChange={(v) => { setAutoSpeakerSwitch(v); markDirty(); }} label="Auto Speaker Switching" description="Switch framing when speaker changes" />
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* Notifications */}
          {activeTab === "notifications" && (
            <>
              <Card className="glass-card p-5 space-y-4">
                <SectionHeader icon={Mail} title="Email Notifications" description="Choose what emails you receive" />
                <div className="space-y-0">
                  <Toggle
                    checked={processingNotifications}
                    onChange={(v) => { setProcessingNotifications(v); markDirty(); }}
                    label="Clip processing complete"
                    description="Get notified when your clips are ready"
                  />
                  <div className="h-px bg-border my-3" />
                  <Toggle
                    checked={emailNotifications}
                    onChange={(v) => { setEmailNotifications(v); markDirty(); }}
                    label="Weekly usage summary"
                    description="Credits used, clips generated, viral scores"
                  />
                  <div className="h-px bg-border my-3" />
                  <Toggle
                    checked={marketingEmails}
                    onChange={(v) => { setMarketingEmails(v); markDirty(); }}
                    label="Marketing emails"
                    description="Product updates, tips, and promotions"
                  />
                </div>
              </Card>

              <Card className="glass-card p-5 space-y-4">
                <SectionHeader icon={Bell} title="In-App Notifications" description="Real-time alerts in your dashboard" color="bg-accent/10 text-accent" />
                <div className="space-y-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text">Processing updates</p>
                      <p className="text-xs text-text-secondary">Real-time progress in the dashboard</p>
                    </div>
                    <Badge variant="success" size="sm">Always On</Badge>
                  </div>
                  <div className="h-px bg-border my-3" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text">Credit balance alerts</p>
                      <p className="text-xs text-text-secondary">Notify when credits run low</p>
                    </div>
                    <Badge variant="primary" size="sm">Always On</Badge>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* Security */}
          {activeTab === "security" && (
            <>
              <Card className="glass-card p-5 space-y-4">
                <SectionHeader icon={Mail} title="Change Email" description="Update the email address on your account" />
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Current Email</label>
                    <input
                      value={user?.primaryEmailAddress?.emailAddress || ""}
                      disabled
                      className="w-full h-10 px-3 bg-surface-subtle border border-border rounded-xl text-sm text-text-muted cursor-not-allowed opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">New Email</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="new@email.com"
                      className="w-full h-10 px-3 input-base text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Current Password</label>
                    <div className="relative">
                      <input
                        type={showEmailPassword ? "text" : "password"}
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        placeholder="Required to change email"
                        className="w-full h-10 px-3 pr-10 input-base text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPassword(!showEmailPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                      >
                        {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    variant={emailSaved ? "success" : "primary"}
                    className="h-10"
                    disabled={!newEmail || !newEmail.includes("@") || !emailPassword || updateEmailMutation.isPending}
                    loading={updateEmailMutation.isPending}
                    onClick={handleUpdateEmail}
                  >
                    {emailSaved ? <Check className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    {emailSaved ? "Email Updated!" : "Update Email"}
                  </Button>
                </div>
              </Card>

              <Card className="glass-card p-5 space-y-4">
                <SectionHeader icon={Lock} title="Change Password" description="Ensure your account stays secure" color="bg-accent/10 text-accent" />
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full h-10 px-3 pr-10 input-base text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full h-10 px-3 pr-10 input-base text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={newPassword} />
                    {newPassword && newPassword.length < 8 && (
                      <p className="text-danger text-[11px] mt-1">Minimum 8 characters</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full h-10 px-3 input-base text-sm"
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-danger text-[11px] mt-1">Passwords do not match</p>
                    )}
                  </div>
                  <Button
                    variant={passwordSaved ? "success" : "primary"}
                    className="h-10"
                    disabled={!newPassword || newPassword.length < 8 || newPassword !== confirmPassword || updatePasswordMutation.isPending}
                    loading={updatePasswordMutation.isPending}
                    onClick={handleUpdatePassword}
                  >
                    {passwordSaved ? <Check className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {passwordSaved ? "Password Updated!" : "Update Password"}
                  </Button>
                </div>
              </Card>

              <Card className="glass-card p-5 border-danger/20">
                <SectionHeader icon={Trash2} title="Danger Zone" description="Irreversible actions" color="bg-danger/10 text-danger" />
                <p className="text-xs text-text-secondary mt-3 mb-3">Permanently delete your account, all projects, clips, and credit history.</p>
                <Button variant="danger" size="sm" className="h-9" onClick={() => setShowDeleteConfirm(true)}>
                  Delete Account
                </Button>
              </Card>
            </>
          )}
        </main>
      </div>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setDeleteInput(""); setDeleteError(""); }} title="Delete Account" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-danger/10 border border-danger/20">
            <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              This will permanently delete your account, all projects, clips, and credit history. This action cannot be undone.
            </p>
          </div>
          {deleteError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20">
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
              <p className="text-xs text-danger">{deleteError}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Type <span className="font-bold text-text">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="w-full h-10 px-3 input-base text-sm focus:border-danger/50 focus:ring-2 focus:ring-danger/20"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" className="h-9" onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); setDeleteError(""); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="h-9"
              disabled={deleteInput !== "DELETE" || deleteMutation.isPending}
              loading={deleteMutation.isPending}
              onClick={handleDeleteAccount}
            >
              Delete Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
