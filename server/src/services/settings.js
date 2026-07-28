import { supabaseAdmin, isConfigured } from "../config/supabase.js";

const DEFAULT_SETTINGS = {
  default_caption_style: "modern",
  default_caption_preset: "classic",
  default_caption_position: "center",
  default_caption_config: null,
  default_platform: "vertical",
  default_stabilization: true,
  default_face_tracking: true,
  default_auto_reframe: true,
  default_close_up_framing: false,
  default_close_up_mode: "closeup",
  default_auto_punch_in: false,
  default_auto_speaker_switch: true,
  email_notifications: true,
  processing_notifications: true,
  marketing_emails: false,
  theme: "dark",
};

export async function getSettings(userId) {
  if (!isConfigured) return DEFAULT_SETTINGS;

  const { data, error } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, default_caption_style, default_caption_preset, default_caption_position, default_caption_config, default_platform, default_stabilization, default_face_tracking, default_auto_reframe, default_close_up_framing, default_close_up_mode, default_auto_punch_in, default_auto_speaker_switch, email_notifications, processing_notifications, marketing_emails, theme")
    .eq("user_id", userId)
    .single();

  if (error || !data) return DEFAULT_SETTINGS;
  return {
    default_caption_style: data.default_caption_style,
    default_caption_preset: data.default_caption_preset || "classic",
    default_caption_position: data.default_caption_position || "center",
    default_caption_config: data.default_caption_config || null,
    default_platform: data.default_platform,
    default_stabilization: data.default_stabilization ?? true,
    default_face_tracking: data.default_face_tracking ?? true,
    default_auto_reframe: data.default_auto_reframe ?? true,
    default_close_up_framing: data.default_close_up_framing ?? false,
    default_close_up_mode: data.default_close_up_mode || "closeup",
    default_auto_punch_in: data.default_auto_punch_in ?? false,
    default_auto_speaker_switch: data.default_auto_speaker_switch ?? true,
    email_notifications: data.email_notifications,
    processing_notifications: data.processing_notifications,
    marketing_emails: data.marketing_emails,
    theme: data.theme || "dark",
  };
}

const VALID_CAPTION_STYLES = ["modern", "karaoke", "minimal", "none"];
const VALID_PLATFORMS = ["tiktok", "youtube", "reels", "vertical", "landscape"];
const VALID_THEMES = ["dark", "light", "system"];
const VALID_CLOSE_UP_MODES = ["closeup", "medium", "wide"];
const VALID_CAPTION_PRESETS = ["classic", "bounce", "highlight", "karaoke", "minimal"];

export async function updateSettings(userId, settings) {
  const payload = {
    user_id: userId,
    default_caption_style: VALID_CAPTION_STYLES.includes(settings.default_caption_style) ? settings.default_caption_style : "modern",
    default_caption_preset: VALID_CAPTION_PRESETS.includes(settings.default_caption_preset) ? settings.default_caption_preset : "classic",
    default_caption_position: settings.default_caption_position || "center",
    default_caption_config: settings.default_caption_config || null,
    default_platform: VALID_PLATFORMS.includes(settings.default_platform) ? settings.default_platform : "vertical",
    default_stabilization: settings.default_stabilization ?? true,
    default_face_tracking: settings.default_face_tracking ?? true,
    default_auto_reframe: settings.default_auto_reframe ?? true,
    default_close_up_framing: settings.default_close_up_framing ?? false,
    default_close_up_mode: VALID_CLOSE_UP_MODES.includes(settings.default_close_up_mode) ? settings.default_close_up_mode : "closeup",
    default_auto_punch_in: settings.default_auto_punch_in ?? false,
    default_auto_speaker_switch: settings.default_auto_speaker_switch ?? true,
    email_notifications: settings.email_notifications ?? true,
    processing_notifications: settings.processing_notifications ?? true,
    marketing_emails: settings.marketing_emails ?? false,
    theme: VALID_THEMES.includes(settings.theme) ? settings.theme : "dark",
  };

  if (!isConfigured) return { success: true, settings: payload };

  const { error } = await supabaseAdmin
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;

  return { success: true, settings: payload };
}
