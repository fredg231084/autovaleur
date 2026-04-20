/**
 * Tracking utilities for source attribution
 * Implements internal tracking system (independent of GA/Ads)
 */

export interface TrackingData {
  source_first: string;
  campaign_first: string;
  medium_first: string;
  content_first: string;
  term_first: string;
  referrer_first: string;
  landing_page_first: string;
  first_seen_at: string;
  cta: string;
  entry_page: string;
  app_entry_url: string;
  flow_id: string;
}

const TRACKING_STORAGE_KEY = 'av_tracking';
const SESSION_DURATION_MS = 30 * 60 * 1000;

interface StoredTrackingData {
  source_first: string;
  campaign_first: string;
  medium_first: string;
  content_first: string;
  term_first: string;
  referrer_first: string;
  landing_page_first: string;
  first_seen_at: string;
  session_id: string;
  last_activity: number;
}

function classifySource(referrer: string): string {
  if (!referrer) return 'direct';

  const ref = referrer.toLowerCase();

  if (ref.includes('google')) return 'organic';
  if (ref.includes('bing')) return 'organic';
  if (ref.includes('yahoo')) return 'organic';
  if (ref.includes('duckduckgo')) return 'organic';

  if (ref.includes('facebook')) return 'referral';
  if (ref.includes('instagram')) return 'referral';
  if (ref.includes('twitter')) return 'referral';
  if (ref.includes('linkedin')) return 'referral';
  if (ref.includes('tiktok')) return 'referral';

  return 'referral';
}

function extractUTMParams(url: string): {
  source?: string;
  campaign?: string;
  medium?: string;
  content?: string;
  term?: string;
} {
  try {
    const urlObj = new URL(url);
    return {
      source: urlObj.searchParams.get('utm_source') || undefined,
      campaign: urlObj.searchParams.get('utm_campaign') || undefined,
      medium: urlObj.searchParams.get('utm_medium') || undefined,
      content: urlObj.searchParams.get('utm_content') || undefined,
      term: urlObj.searchParams.get('utm_term') || undefined,
    };
  } catch {
    return {};
  }
}

function extractCustomParams(url: string): {
  source?: string;
  cta?: string;
  entry_page?: string;
} {
  try {
    const urlObj = new URL(url);
    return {
      source: urlObj.searchParams.get('source') || undefined,
      cta: urlObj.searchParams.get('cta') || undefined,
      entry_page: urlObj.searchParams.get('lp') || urlObj.searchParams.get('entry_page') || undefined,
    };
  } catch {
    return {};
  }
}

function determineSource(url: string, referrer: string): string {
  const utm = extractUTMParams(url);
  if (utm.source) return utm.source;

  const custom = extractCustomParams(url);
  if (custom.source) return custom.source;

  const classified = classifySource(referrer);
  return classified;
}

function enhanceSourceClassification(source: string, medium?: string): string {
  if (!medium) return source;

  const med = medium.toLowerCase();

  if (source.includes('google') && (med.includes('cpc') || med.includes('ppc') || med.includes('paid'))) {
    return 'google_ads';
  }

  if (source.includes('facebook') && (med.includes('cpc') || med.includes('paid') || med.includes('social'))) {
    return 'facebook_ads';
  }

  if (source.includes('instagram') && (med.includes('cpc') || med.includes('paid') || med.includes('social'))) {
    return 'facebook_ads';
  }

  return source;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function isSessionExpired(lastActivity: number): boolean {
  return Date.now() - lastActivity > SESSION_DURATION_MS;
}

function getStoredTracking(): StoredTrackingData | null {
  try {
    const stored = localStorage.getItem(TRACKING_STORAGE_KEY);
    if (!stored) return null;

    const data: StoredTrackingData = JSON.parse(stored);

    if (isSessionExpired(data.last_activity)) {
      localStorage.removeItem(TRACKING_STORAGE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function storeTracking(data: StoredTrackingData): void {
  try {
    localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // LocalStorage not available or full
  }
}

export function updateTrackingActivity(): void {
  const stored = getStoredTracking();
  if (stored) {
    stored.last_activity = Date.now();
    storeTracking(stored);
  }
}

export function initializeTracking(): void {
  const currentUrl = window.location.href;
  const referrer = document.referrer;
  const landingPage = window.location.pathname;

  const existing = getStoredTracking();
  if (existing) {
    updateTrackingActivity();
    return;
  }

  const utm = extractUTMParams(currentUrl);
  const source = determineSource(currentUrl, referrer);
  const enhancedSource = enhanceSourceClassification(source, utm.medium);

  const trackingData: StoredTrackingData = {
    source_first: enhancedSource,
    campaign_first: utm.campaign || '',
    medium_first: utm.medium || '',
    content_first: utm.content || '',
    term_first: utm.term || '',
    referrer_first: referrer,
    landing_page_first: landingPage,
    first_seen_at: new Date().toISOString(),
    session_id: generateSessionId(),
    last_activity: Date.now(),
  };

  storeTracking(trackingData);
}

export function getTrackingData(): TrackingData {
  const stored = getStoredTracking();
  const currentUrl = window.location.href;
  const custom = extractCustomParams(currentUrl);

  if (!stored) {
    const referrer = document.referrer;
    const source = determineSource(currentUrl, referrer);
    const utm = extractUTMParams(currentUrl);
    const enhancedSource = enhanceSourceClassification(source, utm.medium);

    return {
      source_first: enhancedSource,
      campaign_first: utm.campaign || '',
      medium_first: utm.medium || '',
      content_first: utm.content || '',
      term_first: utm.term || '',
      referrer_first: referrer,
      landing_page_first: window.location.pathname,
      first_seen_at: new Date().toISOString(),
      cta: custom.cta || '',
      entry_page: custom.entry_page || '',
      app_entry_url: currentUrl,
      flow_id: 'home_visit_booking',
    };
  }

  return {
    source_first: stored.source_first,
    campaign_first: stored.campaign_first,
    medium_first: stored.medium_first,
    content_first: stored.content_first,
    term_first: stored.term_first,
    referrer_first: stored.referrer_first,
    landing_page_first: stored.landing_page_first,
    first_seen_at: stored.first_seen_at,
    cta: custom.cta || '',
    entry_page: custom.entry_page || '',
    app_entry_url: currentUrl,
    flow_id: 'home_visit_booking',
  };
}

export function clearTrackingData(): void {
  try {
    localStorage.removeItem(TRACKING_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
