import { PLANS, PLAN_ORDER, CREDIT_PACKS as PLAN_PACKS, getRecommendedPlan as getRecommendedPlanFromPlans, getPlanCredits as getPlanCreditsFromPlans } from "./plans.js";

export const CREDIT_COSTS = {
  chat: 1,
  quickGeneration: 2,
  blog: 5,
  document: 8,
  research: 10,
  automation: 15,
  longForm: 20,
  agent: 25,
  clip: {
    '15s': 5,
    '30s': 10,
    '45s': 12,
    '60s': 15,
    '90s': 20,
    '120s': 25,
  },
  aiEditing: parseInt(process.env.AI_EDITING_CREDIT_COST || "15", 10),
};

export const CREDIT_COSTS_LABELS = {
  chat: 'AI Chat',
  quickGeneration: 'Quick Generation',
  blog: 'Content Generation',
  document: 'Document Analysis',
  research: 'Research Task',
  automation: 'Workflow Automation',
  longForm: 'Long-form Generation',
  agent: 'AI Agent Execution',
};

export const PLAN_DEFAULTS = {};
for (const id of PLAN_ORDER) {
  const p = PLANS[id];
  PLAN_DEFAULTS[id] = { credits: p.monthlyCredits, name: p.name, price: p.price, period: '/month', features: p.features };
}

export const CREDIT_PACKS = PLAN_PACKS;

export function calculateCreditsForClips({ clipCount, clipDuration }) {
  let perClip;
  const dur = clipDuration ?? 120;
  if (dur <= 15) perClip = CREDIT_COSTS.clip['15s'];
  else if (dur <= 30) perClip = CREDIT_COSTS.clip['30s'];
  else if (dur <= 45) perClip = CREDIT_COSTS.clip['45s'];
  else if (dur <= 60) perClip = CREDIT_COSTS.clip['60s'];
  else if (dur <= 90) perClip = CREDIT_COSTS.clip['90s'];
  else perClip = CREDIT_COSTS.clip['120s'];
  return clipCount * perClip;
}

export function estimateMonthlyCredits(usage) {
  const {
    chat = 0,
    quickGeneration = 0,
    blog = 0,
    document = 0,
    research = 0,
    automation = 0,
    longForm = 0,
    agent = 0,
  } = usage || {};

  return (
    chat * CREDIT_COSTS.chat +
    quickGeneration * CREDIT_COSTS.quickGeneration +
    blog * CREDIT_COSTS.blog +
    document * CREDIT_COSTS.document +
    research * CREDIT_COSTS.research +
    automation * CREDIT_COSTS.automation +
    longForm * CREDIT_COSTS.longForm +
    agent * CREDIT_COSTS.agent
  );
}

export function getRecommendedPlan(estimatedCredits) {
  return getRecommendedPlanFromPlans(estimatedCredits);
}

export function getPlanCredits(plan) {
  return getPlanCreditsFromPlans(plan);
}

export function formatCredits(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export const TRANSACTION_TYPES = {
  earned: 'earned',
  spent: 'spent',
  refund: 'refund',
  purchase: 'purchase',
  adjustment: 'adjustment',
  subscription_grant: 'subscription_grant',
  welcome_bonus: 'welcome_bonus',
};

export const TRANSACTION_SOURCES = {
  ai_chat: 'ai_chat',
  quick_generation: 'quick_generation',
  content_generation: 'content_generation',
  document_analysis: 'document_analysis',
  research_task: 'research_task',
  workflow_automation: 'workflow_automation',
  long_form_generation: 'long_form_generation',
  ai_agent_execution: 'ai_agent_execution',
  clip_generation: 'clip_generation',
  clip_regeneration: 'clip_regeneration',
  subscription: 'subscription',
  credit_pack: 'credit_pack',
  admin: 'admin',
  referral: 'referral',
  promotion: 'promotion',
};
