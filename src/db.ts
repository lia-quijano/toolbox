import Dexie, { type EntityTable } from 'dexie'

export interface Tool {
  id?: number
  name: string
  url: string
  description: string
  favicon: string
  ogImage: string
  source: 'producthunt' | 'github' | 'npm' | 'manual' | 'other'
  category: string
  subcategory: string
  tags: string[]
  pricingModel: 'free' | 'freemium' | 'paid' | 'open-source' | 'unknown'
  note: string
  rating: number | null
  savedAt: string
  metadata: Record<string, unknown>
}

/** Clean a page title into a concise tool name.
 *  Format: "ToolName — what it does"
 *  Cuts at natural phrase boundaries, never mid-thought.
 */
export function cleanToolName(title: string, url?: string): string {
  // Strip common trailing/leading noise
  let cleaned = title
    .replace(/\s*[-–—|·:]\s*(Home|Homepage|Official Site|Official Website|Welcome)$/i, '')
    .replace(/^(Meet the new|Meet|Introducing|Welcome to|Discover|Try)\s+/i, '') // strip leading filler
    .trim()

  const parts = cleaned.split(/\s+[-–—]\s+|\s*[|·:]\s*/)
  let name = parts[0].trim()

  // Has a separator — extract name + tagline
  if (parts.length > 1) {
    const raw = parts.slice(1).join(' ').trim()
      .replace(/^\d+\+?\s*/, '')
      .replace(/^[-–—]\s*/, '')
      .trim()

    const tagline = makeTagline(raw)
    if (tagline && tagline.toLowerCase() !== name.toLowerCase()) {
      return `${name} — ${tagline}`
    }
    return name
  }

  // No separator — try to extract a brand name
  const words = name.split(/\s+/)
  if (words.length <= 3) return name

  // Try extracting brand from URL hostname as a hint
  // e.g. "cursor.com" → brand is "Cursor"
  if (url) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '')
      const domain = hostname.split('.')[0]
      if (domain.length >= 3) {
        const brandFromUrl = domain.charAt(0).toUpperCase() + domain.slice(1)
        // Check if the domain name appears in the title
        const idx = words.findIndex((w) => w.toLowerCase() === domain.toLowerCase())
        if (idx >= 0) {
          // Use the word from the title (preserves original casing)
          const brandWord = words[idx]
          const rest = [...words.slice(0, idx), ...words.slice(idx + 1)].join(' ')
            .replace(/^(the new|new)\s+/i, '') // strip "the new" leftover
            .trim()
          const tagline = makeTagline(rest)
          if (tagline) return `${brandWord} — ${tagline}`
          return brandWord
        }
        // Domain doesn't appear in title — title is entirely descriptive
        // Use domain as name, title as tagline
        const tagline = makeTagline(cleaned)
        if (tagline) return `${brandFromUrl} — ${tagline}`
        return brandFromUrl
      }
    } catch { /* */ }
  }

  // Fallback: look for capitalized brand name at the start
  let nameEnd = 1
  for (let i = 1; i < Math.min(words.length, 3); i++) {
    const firstChar = words[i].charAt(0)
    if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
      nameEnd = i + 1
    } else {
      break
    }
  }

  const extractedName = words.slice(0, nameEnd).join(' ')
  const rest = words.slice(nameEnd).join(' ')

  if (rest) {
    const tagline = makeTagline(rest)
    if (tagline) return `${extractedName} — ${tagline}`
  }

  return name
}

// Words that shouldn't end a tagline — they leave it hanging
const TRAILING_STOP = new Set([
  'a', 'an', 'the', 'for', 'and', 'or', 'to', 'in', 'on', 'of',
  'with', 'by', 'from', 'at', 'is', 'are', 'was', 'your', 'our',
  'that', 'this', 'into', 'as',
])

function makeTagline(text: string): string {
  if (!text) return ''

  const words = text.split(/\s+/)

  // Take up to 4 words
  let slice = words.slice(0, 4)

  // Trim trailing stop words
  while (slice.length > 1 && TRAILING_STOP.has(slice[slice.length - 1].toLowerCase())) {
    slice.pop()
  }

  // If we trimmed everything meaningful, try just 2 words
  if (slice.length < 2 && words.length >= 2) {
    slice = words.slice(0, 2)
    while (slice.length > 1 && TRAILING_STOP.has(slice[slice.length - 1].toLowerCase())) {
      slice.pop()
    }
  }

  const result = slice.join(' ')
  if (result.length < 3) return ''
  return toSentenceCase(result)
}

/** Sentence case: capitalise first letter, lowercase the rest
 *  Preserves known brand-style words (API, UI, CSS, AI, etc.)
 */
const PRESERVE_CASE = new Set([
  'AI', 'API', 'APIs', 'CLI', 'CSS', 'CMS', 'CRM', 'DB', 'DNS', 'HTML',
  'HTTP', 'IDE', 'iOS', 'JS', 'ML', 'npm', 'OSS', 'QA', 'REST', 'SaaS',
  'SDK', 'SEO', 'SQL', 'SSH', 'SSL', 'SVG', 'UI', 'UX', 'URL', 'VPN',
])

function toSentenceCase(text: string): string {
  const words = text.split(/\s+/)
  return words.map((word, i) => {
    const upper = word.toUpperCase()
    if (PRESERVE_CASE.has(upper) || PRESERVE_CASE.has(word)) return word
    if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    return word.toLowerCase()
  }).join(' ')
}

/** Shorten description to a brief tagline */
export function briefDescription(desc: string): string {
  if (!desc) return ''
  const firstSentence = desc.split(/[.!?]\s/)[0]
  if (firstSentence.length <= 80) return firstSentence
  return firstSentence.slice(0, 77).replace(/\s+\S*$/, '') + '...'
}

// ─── Category → Subcategory taxonomy ───────────────────────────────

export const TAXONOMY: Record<string, string[]> = {
  'Design': [
    'Colour & Palette',
    'Fonts & Type',
    'Iconography',
    'Visuals & Assets',
    'Inspo & Galleries',
    'Interface Kits',
    'Prototyping',
    'Design Systems',
    'General',
  ],
  'Dev Tools': [
    'Frameworks',
    'Packages & Libs',
    'APIs & SDKs',
    'Terminal & CLI',
    'Editors & IDEs',
    'QA & Testing',
    'Data Stores',
    'UI Components',
    'Infra & Deploy',
    'General',
  ],
  'No-Code': [
    'App Builders',
    'Site Builders',
    'Automations',
    'Forms & Surveys',
    'Internal Tooling',
    'General',
  ],
  'AI': [
    'Assistants & Chat',
    'Image Synthesis',
    'Code Helpers',
    'Copywriting',
    'Voice & Audio',
    'Video AI',
    'Agents & Autonomy',
    'Open Models',
    'General',
  ],
  'Marketing': [
    'Analytics',
    'Search & SEO',
    'Email & Outreach',
    'Social',
    'Content & Copy',
    'Ads & Paid',
    'General',
  ],
  'Productivity': [
    'Projects',
    'Notes & Docs',
    'Team & Collab',
    'Time & Focus',
    'Scheduling',
    'Files & Storage',
    'General',
  ],
  'Media': [
    'Editing',
    'Screen Capture',
    'Generation',
    'Live & Streaming',
    'Podcasts',
    'General',
  ],
  'Commerce': [
    'Platforms',
    'Payments',
    'Storefronts',
    'Inventory',
    'General',
  ],
  'Startup': [
    'Fundraising',
    'Legal & Compliance',
    'Talent & Hiring',
    'Pitch Materials',
    'Starters & Kits',
    'General',
  ],
  'Other': [
    'Uncategorised',
  ],
}

export const CATEGORIES = Object.keys(TAXONOMY)

// Sidebar grouping
export const CATEGORY_GROUPS: { label: string; categories: string[] }[] = [
  { label: 'Build', categories: ['Design', 'Dev Tools', 'No-Code'] },
  { label: 'Grow', categories: ['AI', 'Marketing', 'Productivity'] },
  { label: 'Run', categories: ['Media', 'Commerce', 'Startup'] },
]

export function getSubcategories(category: string): string[] {
  return TAXONOMY[category] || ['General']
}

export const PRICING_MODELS = [
  'free',
  'freemium',
  'paid',
  'open-source',
  'unknown',
] as const

// ─── Auto-detection ────────────────────────────────────────────────

// Known domains → category (highest confidence signal)
const DOMAIN_CATEGORIES: Record<string, string> = {
  // Design
  'figma.com': 'Design', 'canva.com': 'Design', 'sketch.com': 'Design',
  'dribbble.com': 'Design', 'behance.net': 'Design', 'coolors.co': 'Design',
  'color.adobe.com': 'Design', 'fonts.google.com': 'Design', 'fontshare.com': 'Design',
  'iconscout.com': 'Design', 'icons8.com': 'Design', 'heroicons.com': 'Design',
  'lucide.dev': 'Design', 'phosphoricons.com': 'Design', 'feathericons.com': 'Design',
  'undraw.co': 'Design', 'storyset.com': 'Design', 'unsplash.com': 'Design',
  'pexels.com': 'Design', 'awwwards.com': 'Design', 'mobbin.com': 'Design',
  'screenlane.com': 'Design', 'uigarage.net': 'Design', 'framer.com': 'Design',
  'penpot.app': 'Design', 'zeplin.io': 'Design', 'principle.app': 'Design',
  'rive.app': 'Design', 'lottiefiles.com': 'Design', 'spline.design': 'Design',
  'storybook.js.org': 'Design', 'chromatic.com': 'Design',
  'iconsax.io': 'Design', 'fontjoy.com': 'Design', 'typescale.com': 'Design',
  'realtime.co': 'Design', 'muzli.com': 'Design',

  // Dev Tools
  'github.com': 'Dev Tools', 'gitlab.com': 'Dev Tools', 'bitbucket.org': 'Dev Tools',
  'npmjs.com': 'Dev Tools', 'pypi.org': 'Dev Tools', 'crates.io': 'Dev Tools',
  'stackoverflow.com': 'Dev Tools', 'codepen.io': 'Dev Tools', 'codesandbox.io': 'Dev Tools',
  'replit.com': 'Dev Tools', 'stackblitz.com': 'Dev Tools',
  'vercel.com': 'Dev Tools', 'netlify.com': 'Dev Tools', 'railway.app': 'Dev Tools',
  'render.com': 'Dev Tools', 'fly.io': 'Dev Tools', 'supabase.com': 'Dev Tools',
  'planetscale.com': 'Dev Tools', 'neon.tech': 'Dev Tools', 'upstash.com': 'Dev Tools',
  'docker.com': 'Dev Tools', 'kubernetes.io': 'Dev Tools',
  'nextjs.org': 'Dev Tools', 'svelte.dev': 'Dev Tools', 'remix.run': 'Dev Tools',
  'nuxt.com': 'Dev Tools', 'astro.build': 'Dev Tools', 'vite.dev': 'Dev Tools',
  'tailwindcss.com': 'Dev Tools', 'shadcn.com': 'Dev Tools',
  'code.visualstudio.com': 'Dev Tools', 'cursor.com': 'Dev Tools',
  'sentry.io': 'Dev Tools', 'datadog.com': 'Dev Tools', 'grafana.com': 'Dev Tools',
  'postman.com': 'Dev Tools', 'insomnia.rest': 'Dev Tools', 'hoppscotch.io': 'Dev Tools',
  'prisma.io': 'Dev Tools', 'drizzle.team': 'Dev Tools',

  // AI
  'openai.com': 'AI', 'anthropic.com': 'AI', 'claude.ai': 'AI',
  'chat.openai.com': 'AI', 'gemini.google.com': 'AI', 'perplexity.ai': 'AI',
  'midjourney.com': 'AI', 'stability.ai': 'AI', 'runway.ml': 'AI',
  'huggingface.co': 'AI', 'replicate.com': 'AI', 'together.ai': 'AI',
  'elevenlabs.io': 'AI', 'descript.com': 'AI', 'jasper.ai': 'AI',
  'copy.ai': 'AI', 'writesonic.com': 'AI', 'grammarly.com': 'AI',
  'synthesia.io': 'AI', 'heygen.com': 'AI', 'pika.art': 'AI',
  'v0.dev': 'AI', 'bolt.new': 'AI', 'lovable.dev': 'AI',
  'cursor.sh': 'AI', 'codeium.com': 'AI', 'tabnine.com': 'AI',
  'langchain.com': 'AI', 'llamaindex.ai': 'AI', 'pinecone.io': 'AI',

  // No-Code
  'bubble.io': 'No-Code', 'webflow.com': 'No-Code',
  'softr.io': 'No-Code', 'glide.com': 'No-Code', 'adalo.com': 'No-Code',
  'retool.com': 'No-Code', 'appsmith.com': 'No-Code', 'tooljet.com': 'No-Code',
  'airtable.com': 'No-Code', 'zapier.com': 'No-Code', 'make.com': 'No-Code',
  'n8n.io': 'No-Code', 'typeform.com': 'No-Code', 'tally.so': 'No-Code',
  'jotform.com': 'No-Code', 'carrd.co': 'No-Code', 'squarespace.com': 'No-Code',
  'wix.com': 'No-Code', 'wordpress.com': 'No-Code',

  // Productivity
  'notion.so': 'Productivity', 'linear.app': 'Productivity', 'asana.com': 'Productivity',
  'trello.com': 'Productivity', 'monday.com': 'Productivity', 'clickup.com': 'Productivity',
  'jira.atlassian.com': 'Productivity', 'basecamp.com': 'Productivity',
  'todoist.com': 'Productivity', 'things.com': 'Productivity', 'ticktick.com': 'Productivity',
  'obsidian.md': 'Productivity', 'roamresearch.com': 'Productivity', 'logseq.com': 'Productivity',
  'craft.do': 'Productivity', 'coda.io': 'Productivity', 'slite.com': 'Productivity',
  'slack.com': 'Productivity', 'discord.com': 'Productivity', 'loom.com': 'Productivity',
  'miro.com': 'Productivity', 'whimsical.com': 'Productivity', 'excalidraw.com': 'Productivity',
  'calendly.com': 'Productivity', 'cal.com': 'Productivity',
  'toggl.com': 'Productivity', 'clockify.me': 'Productivity',
  'dropbox.com': 'Productivity', 'box.com': 'Productivity',
  '1password.com': 'Productivity', 'bitwarden.com': 'Productivity',
  'raindrop.io': 'Productivity', 'pocket.com': 'Productivity',
  'superhuman.com': 'Productivity', 'height.app': 'Productivity',
  'arc.net': 'Productivity', 'raycast.com': 'Productivity', 'alfred.app': 'Productivity',

  // Marketing
  'mailchimp.com': 'Marketing', 'convertkit.com': 'Marketing', 'beehiiv.com': 'Marketing',
  'substack.com': 'Marketing', 'hubspot.com': 'Marketing', 'semrush.com': 'Marketing',
  'ahrefs.com': 'Marketing', 'moz.com': 'Marketing', 'hotjar.com': 'Marketing',
  'mixpanel.com': 'Marketing', 'amplitude.com': 'Marketing', 'posthog.com': 'Marketing',
  'plausible.io': 'Marketing', 'buffer.com': 'Marketing', 'hootsuite.com': 'Marketing',
  'later.com': 'Marketing', 'sproutsocial.com': 'Marketing',
  'intercom.com': 'Marketing', 'crisp.chat': 'Marketing', 'drift.com': 'Marketing',
  'producthunt.com': 'Marketing',

  // Media
  'youtube.com': 'Media', 'vimeo.com': 'Media', 'streamyard.com': 'Media',
  'riverside.fm': 'Media', 'capcut.com': 'Media',
  'davinciresolve.com': 'Media', 'clipchamp.com': 'Media',
  'anchor.fm': 'Media', 'transistor.fm': 'Media', 'buzzsprout.com': 'Media',
  'cleanshot.com': 'Media', 'screen.studio': 'Media',
  'cloudinary.com': 'Media', 'imgix.com': 'Media', 'mux.com': 'Media',

  // Commerce
  'shopify.com': 'Commerce', 'stripe.com': 'Commerce', 'lemonsqueezy.com': 'Commerce',
  'gumroad.com': 'Commerce', 'paddle.com': 'Commerce', 'chargebee.com': 'Commerce',
  'woocommerce.com': 'Commerce', 'bigcommerce.com': 'Commerce',
  'medusajs.com': 'Commerce', 'saleor.io': 'Commerce',

  // Startup
  'ycombinator.com': 'Startup', 'crunchbase.com': 'Startup', 'angellist.com': 'Startup',
  'docsend.com': 'Startup', 'pitch.com': 'Startup', 'slidebean.com': 'Startup',
  'clerky.com': 'Startup', 'stripe.com/atlas': 'Startup',
  'indiehackers.com': 'Startup', 'microacquire.com': 'Startup',
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', 'machine learning', 'ml', 'gpt', 'llm', 'neural', 'chatbot', 'artificial intelligence', 'deep learning', 'nlp', 'copilot', 'generative', 'diffusion', 'openai', 'anthropic', 'gemini', 'language model', 'prompt', 'embedding', 'vector database', 'rag', 'fine-tun'],
  'Design': ['design', 'figma', 'sketch', 'ui kit', 'prototyp', 'wireframe', 'mockup', 'icon', 'illustration', 'color palette', 'typography', 'font', 'gradient', 'canva', 'ui design', 'ux design', 'graphic design', 'visual design', 'brand', 'logo', 'layout', 'responsive design'],
  'Dev Tools': ['developer', 'devtool', 'debugging', 'linter', 'formatter', 'bundler', 'compiler', 'ide', 'editor', 'vscode', 'framework', 'library', 'package', 'npm', 'api', 'rest', 'graphql', 'sdk', 'cli', 'terminal', 'github', 'database', 'component', 'open source', 'repository', 'deploy', 'hosting', 'server', 'backend', 'frontend', 'full stack', 'devops', 'ci/cd', 'monitoring', 'logging', 'testing', 'code review', 'version control', 'git'],
  'No-Code': ['no-code', 'nocode', 'low-code', 'lowcode', 'visual builder', 'drag and drop', 'bubble', 'webflow', 'airtable', 'zapier', 'without code', 'build without', 'automat', 'workflow automation', 'app builder', 'website builder', 'form builder'],
  'Marketing': ['marketing', 'seo', 'analytics', 'email campaign', 'social media schedul', 'google analytics', 'ads', 'content marketing', 'newsletter', 'conversion', 'growth', 'acquisition', 'retention', 'engagement', 'audience', 'campaign', 'funnel', 'landing page', 'a/b test', 'tracking', 'attribution'],
  'Productivity': ['productiv', 'project management', 'note', 'todo', 'task', 'organiz', 'notion', 'trello', 'asana', 'calendar', 'collaboration', 'team', 'workspace', 'document', 'knowledge base', 'wiki', 'roadmap', 'issue track', 'bug track', 'time track', 'schedule', 'meeting', 'bookmark', 'password manager', 'file sharing', 'planning', 'kanban', 'sprint', 'agile'],
  'Media': ['video edit', 'screen record', 'video generat', 'streaming', 'podcast', 'loom', 'obs', 'youtube', 'audio edit', 'transcri', 'subtitle', 'caption', 'thumbnail', 'media manage', 'content creat', 'video produc'],
  'Commerce': ['e-commerce', 'ecommerce', 'shopify', 'stripe', 'payment', 'storefront', 'checkout', 'woocommerce', 'subscription', 'billing', 'invoice', 'merchant', 'cart', 'product catalog', 'inventory'],
  'Startup': ['startup', 'pitch deck', 'fundrais', 'investor', 'boilerplate', 'saas template', 'mvp', 'launch', 'founder', 'venture', 'accelerat', 'incubat', 'seed round', 'series a'],
}

const SUBCATEGORY_KEYWORDS: Record<string, Record<string, string[]>> = {
  'Design': {
    'Colour & Palette': ['color', 'palette', 'gradient', 'hue', 'swatch'],
    'Fonts & Type': ['font', 'typograph', 'typeface', 'lettering', 'google fonts'],
    'Iconography': ['icon', 'svg icon', 'icon set', 'icon pack', 'lucide', 'heroicons', 'phosphor'],
    'Visuals & Assets': ['illustrat', 'vector', 'mockup', 'asset', 'template', 'stock photo', 'texture'],
    'Inspo & Galleries': ['inspir', 'dribbble', 'behance', 'awwwards', 'gallery', 'showcase'],
    'Interface Kits': ['ui kit', 'ui-kit', 'component kit', 'design kit'],
    'Prototyping': ['prototype', 'prototyping', 'wireframe', 'invision', 'framer'],
    'Design Systems': ['design system', 'token', 'style guide', 'storybook'],
  },
  'AI': {
    'Assistants & Chat': ['chatbot', 'assistant', 'chat', 'conversational', 'claude', 'chatgpt'],
    'Image Synthesis': ['image generat', 'midjourney', 'dall-e', 'stable diffusion', 'text to image', 'ai art'],
    'Code Helpers': ['code generat', 'copilot', 'code assist', 'ai code', 'cursor', 'codeium'],
    'Copywriting': ['writing', 'copywriting', 'content generat', 'text generat', 'grammar', 'jasper'],
    'Voice & Audio': ['audio', 'voice', 'speech', 'text to speech', 'transcri', 'elevenlabs'],
    'Video AI': ['ai video', 'video generat', 'deepfake', 'runway', 'synthesia'],
    'Agents & Autonomy': ['agent', 'autonomous', 'workflow', 'crew', 'langchain'],
    'Open Models': ['open source', 'hugging face', 'ollama', 'local model'],
  },
  'Dev Tools': {
    'Frameworks': ['framework', 'next.js', 'nuxt', 'remix', 'django', 'rails', 'laravel', 'express', 'fastapi', 'nestjs', 'svelte'],
    'Packages & Libs': ['library', 'package', 'module', 'npm package', 'pip package'],
    'APIs & SDKs': ['api', 'rest api', 'graphql', 'webhook', 'endpoint', 'sdk'],
    'Terminal & CLI': ['cli', 'command line', 'terminal', 'shell'],
    'Editors & IDEs': ['ide', 'editor', 'vscode', 'neovim', 'devcontainer', 'codespace'],
    'QA & Testing': ['test', 'jest', 'vitest', 'playwright', 'cypress', 'e2e'],
    'Data Stores': ['database', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'supabase', 'planetscale'],
    'UI Components': ['component', 'ui library', 'shadcn', 'radix', 'headless ui', 'chakra'],
    'Infra & Deploy': ['deploy', 'ci/cd', 'docker', 'kubernetes', 'terraform', 'vercel', 'netlify', 'aws'],
  },
}

const PRICING_KEYWORDS: Record<string, string[]> = {
  'free': ['free', 'no cost', '100% free'],
  'freemium': ['freemium', 'free tier', 'free plan', 'starter plan', 'hobby plan', 'free forever'],
  'paid': ['pricing', 'per month', '/mo', 'per year', '/yr', 'enterprise', 'pro plan', 'premium', 'buy now', 'purchase'],
  'open-source': ['open source', 'open-source', 'oss', 'mit license', 'apache license', 'gpl', 'bsd license', 'mozilla public'],
}

function matchKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

export function detectCategory(text: string, url: string): string {
  const hostname = new URL(url).hostname.replace(/^www\./, '')

  // 1. Exact domain match (highest confidence)
  if (DOMAIN_CATEGORIES[hostname]) return DOMAIN_CATEGORIES[hostname]

  // 2. Check if any known domain is a suffix (e.g. "app.linear.app" matches "linear.app")
  for (const [domain, cat] of Object.entries(DOMAIN_CATEGORIES)) {
    if (hostname.endsWith(domain) || hostname.endsWith('.' + domain)) return cat
  }

  // 3. Check the base domain (e.g. "docs.stripe.com" → "stripe.com")
  const parts = hostname.split('.')
  if (parts.length > 2) {
    const baseDomain = parts.slice(-2).join('.')
    if (DOMAIN_CATEGORIES[baseDomain]) return DOMAIN_CATEGORIES[baseDomain]
  }

  // 4. Keyword matching from page content
  const combined = text.toLowerCase()
  let bestMatch = 'Other'
  let bestScore = 0

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => combined.includes(kw)).length
    if (score > bestScore) {
      bestScore = score
      bestMatch = cat
    }
  }

  return bestMatch
}

export function detectSubcategory(text: string, url: string, category: string): string {
  const subcatKeywords = SUBCATEGORY_KEYWORDS[category]
  if (!subcatKeywords) return getSubcategories(category)[0]

  const hostname = new URL(url).hostname
  const combined = (text + ' ' + hostname).toLowerCase()
  let bestMatch = 'General'
  let bestScore = 0

  for (const [subcat, keywords] of Object.entries(subcatKeywords)) {
    const score = keywords.filter((kw) => combined.includes(kw)).length
    if (score > bestScore) {
      bestScore = score
      bestMatch = subcat
    }
  }

  return bestMatch
}

export function detectPricing(text: string, url: string): Tool['pricingModel'] {
  const hostname = new URL(url).hostname
  if (hostname.includes('github.com')) return 'open-source'

  const combined = text.toLowerCase()
  if (matchKeywords(combined, PRICING_KEYWORDS['open-source'])) return 'open-source'
  if (matchKeywords(combined, PRICING_KEYWORDS['freemium'])) return 'freemium'
  if (matchKeywords(combined, PRICING_KEYWORDS['paid'])) return 'paid'
  if (matchKeywords(combined, PRICING_KEYWORDS['free'])) return 'free'
  return 'unknown'
}

// ─── Database ──────────────────────────────────────────────────────

const db = new Dexie('ToolboxDB') as Dexie & {
  tools: EntityTable<Tool, 'id'>
}

db.version(5).stores({
  tools: '++id, name, url, source, category, subcategory, pricingModel, savedAt, *tags',
})

export { db }
