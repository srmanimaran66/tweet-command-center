export const MOCK_TRENDS = [
  {
    id: 'tr_001',
    title: 'AI agents are replacing junior roles faster than expected',
    category: 'AI & Technology',
    niche_tags: ['ai', 'saas', 'startups', 'productivity', 'future-of-work'],
    summary: 'Companies are reporting 30-40% reduction in junior hiring budgets as AI coding and operations tools mature. The debate: is this opportunity or crisis for early-career professionals?',
    relevance_score: 95,
    freshness_score: 90,
  },
  {
    id: 'tr_002',
    title: 'Founder-led content is outperforming paid ads 3:1 in 2026',
    category: 'Marketing & Content',
    niche_tags: ['founders', 'content', 'marketing', 'growth', 'b2b'],
    summary: 'Multiple SaaS founders report organic content (X, LinkedIn) generating 3x more qualified pipeline than equivalent ad spend. Authenticity beats polish.',
    relevance_score: 92,
    freshness_score: 85,
  },
  {
    id: 'tr_003',
    title: 'The "vibe coding" movement is reshaping how products get built',
    category: 'AI & Technology',
    niche_tags: ['ai', 'coding', 'startups', 'product', 'innovation'],
    summary: 'Non-technical founders are shipping MVPs in days using AI-assisted coding. Traditional dev agencies are scrambling to adapt their pricing models.',
    relevance_score: 88,
    freshness_score: 92,
  },
  {
    id: 'tr_004',
    title: 'LinkedIn engagement has dropped 40% while X creators grow',
    category: 'Social Media & Creator Economy',
    niche_tags: ['content', 'creators', 'social-media', 'audience', 'growth'],
    summary: 'Data shows organic reach on LinkedIn declining sharply while X (Twitter) creator accounts with strong hooks and daily posting see 2-3x audience growth.',
    relevance_score: 90,
    freshness_score: 88,
  },
  {
    id: 'tr_005',
    title: 'Bootstrapped companies are outperforming VC-backed competitors',
    category: 'Startups & Business',
    niche_tags: ['founders', 'bootstrapping', 'startups', 'business', 'growth'],
    summary: 'In the current market, capital-efficient bootstrapped SaaS companies are posting higher NRR and lower churn than their VC-backed counterparts with 10x the runway.',
    relevance_score: 87,
    freshness_score: 82,
  },
  {
    id: 'tr_006',
    title: 'One-person businesses are hitting $1M ARR without hiring',
    category: 'Startups & Business',
    niche_tags: ['solo-founder', 'business', 'saas', 'indie-hacker', 'automation'],
    summary: 'The rise of AI tools and no-code platforms is enabling solo operators to run $1M+ businesses. The playbook: automate everything, outsource rest, focus on distribution.',
    relevance_score: 89,
    freshness_score: 86,
  },
  {
    id: 'tr_007',
    title: 'Mental health among founders is the hidden startup metric',
    category: 'Founder Mindset & Wellness',
    niche_tags: ['founders', 'mindset', 'wellness', 'leadership', 'burnout'],
    summary: 'A growing conversation about founder mental health is reshaping startup culture. The "grind culture" narrative is being replaced with sustainable performance frameworks.',
    relevance_score: 84,
    freshness_score: 80,
  },
  {
    id: 'tr_008',
    title: 'Micro-niching is the fastest path to authority in 2026',
    category: 'Marketing & Content',
    niche_tags: ['niche', 'authority', 'personal-brand', 'content', 'positioning'],
    summary: 'Creators who narrow their focus to a specific audience segment are growing 5x faster than generalists. "Everyone is my customer" is the new red flag for brand strategy.',
    relevance_score: 93,
    freshness_score: 84,
  },
  {
    id: 'tr_009',
    title: 'Community-led growth is replacing product-led growth as the hot model',
    category: 'Startups & Business',
    niche_tags: ['community', 'growth', 'saas', 'retention', 'b2b'],
    summary: 'Top SaaS companies in 2026 are reporting that community engagement metrics (forums, Discord, events) are stronger predictors of retention than product usage scores.',
    relevance_score: 85,
    freshness_score: 83,
  },
  {
    id: 'tr_010',
    title: 'The 4-day work week experiment results are in — and surprising',
    category: 'Work & Productivity',
    niche_tags: ['productivity', 'work', 'founders', 'teams', 'future-of-work'],
    summary: 'Companies that ran 6-month 4-day work week pilots report 12% productivity increase on average. The debate: is this the future of work or a privilege only established companies can afford?',
    relevance_score: 82,
    freshness_score: 78,
  },
];

export function getTrendsForProfile(profile) {
  const keywords = [
    ...(profile.primaryTopic || '').toLowerCase().split(/\s+/),
    ...(profile.secondaryTopic || '').toLowerCase().split(/\s+/),
    ...(profile.audience || '').toLowerCase().split(/\s+/),
  ].filter(k => k.length > 3);

  const scored = MOCK_TRENDS.map(trend => {
    const tagMatches = trend.niche_tags.filter(tag =>
      keywords.some(k => tag.includes(k) || k.includes(tag))
    ).length;
    return { ...trend, match_score: tagMatches * 20 + trend.relevance_score };
  });

  return scored.sort((a, b) => b.match_score - a.match_score).slice(0, 7);
}
