export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUserRow {
  id: string;
  userCode: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: string;
  role: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { listings: number; buyerOffers: number };
}

export interface AdminUserDetail {
  user: AdminUserRow & { failedLoginCount: number; statusReason: string | null; updatedAt?: string };
  stats: {
    listingsByStatus: Record<string, number>;
    offersMade: number;
    offersReceived: number;
    dealsAsBuyer: number;
    dealsAsSeller: number;
    messagesSent: number;
  };
  recentListings: {
    id: string;
    title: string;
    price: number;
    status: string;
    verifiedAt: string | null;
    cityCode: string;
    createdAt: string;
    media?: { url: string }[];
  }[];
  notes: StaffNote[];
  history: { id?: string; action: string; actorId: string | null; actor?: { id: string; displayName: string; role: string } | null; details: Record<string, unknown> | null; createdAt: string }[];
}

export interface StaffNote {
  id: string;
  note: string;
  createdAt: string;
  author?: { id: string; displayName: string } | null;
}

export interface AdminListingRow {
  id: string;
  title: string;
  price: number;
  status: string;
  condition: string;
  cityCode: string;
  stateCode: string;
  verifiedAt: string | null;
  createdAt: string;
  publishedAt: string | null;
  submittedAt: string | null;
  seller: { id: string; userCode: string; displayName: string; status: string };
  category: { id: string; name: string } | null;
  media: { url: string; mediaType: string }[];
  sanitization: { status: string; score: number } | null;
  reviews: { action: string; remark: string | null; createdAt: string }[];
  _count: { offers: number; conversations: number; media: number };
}

export interface Sanitization {
  status: string;
  score: number;
  reasons?: string[] | null;
  checks?: Record<string, unknown> | null;
  reviewedAt?: string | null;
}

export interface ListingReview {
  id?: string;
  action: string;
  remark: string | null;
  visibleToSeller?: boolean;
  createdAt: string;
  reviewer?: { displayName: string } | null;
}

export interface AdminListingDetail {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  condition: string;
  status: string;
  cityCode: string;
  stateCode: string;
  countryCode: string;
  locationVisibility?: string;
  verifiedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  reservedAt: string | null;
  soldAt: string | null;
  createdAt: string;
  updatedAt: string;
  seller: { id: string; userCode: string; displayName: string; email: string | null; phone: string | null; status: string; createdAt?: string };
  category: { id: string; name: string; parent?: { name: string } | null } | null;
  attributes: {
    id: string;
    valueText: string | null;
    valueNumber: number | null;
    valueBoolean: boolean | null;
    valueDate: string | null;
    valueJson: unknown;
    attributeDefinition?: { name: string; dataType: string } | null;
  }[];
  media: { id: string; url: string; mediaType: string; mimeType?: string | null; sortOrder: number }[];
  sanitization: Sanitization | null;
  reviews: ListingReview[];
  _count: { offers: number; conversations: number; favorites: number };
  offerStats: Record<string, number>;
}

export interface ServiceArea {
  id: string;
  countryCode: string;
  stateCode: string;
  stateName: string;
  cityCode: string;
  cityName: string;
  isActive: boolean;
  buyingEnabled: boolean;
  sellingEnabled: boolean;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  children?: Category[];
}

export interface Analytics {
  periodDays: number;
  generatedAt: string;
  totals: {
    users: { total: number; byStatus: Record<string, number>; active: number; newInPeriod: number; signedInInPeriod: number };
    listings: { byStatus: Record<string, number>; verifiedLive: number; newInPeriod: number };
    offersInPeriod: number;
    dealsInPeriod: number;
    soldInPeriod: number;
    messagesInPeriod: number;
    conversationsInPeriod: number;
  };
  series: { day: string; newUsers: number; newListings: number; offers: number; messages: number; deals: number; sold: number }[];
  byCity: { cityCode: string; cityName: string; count: number }[];
  byCategory: { name: string; count: number }[];
  funnel: { published: number; withOffer: number; withDeal: number; sold: number };
  moderation: { queueSize: number; reviewedInPeriod: number; avgHoursToApprove: number | null; actions: Record<string, number> };
}

/** GET /admin/feedback row (closed-beta feedback inbox). */
export interface AdminFeedback {
  id: string;
  source: 'WEB' | 'MOBILE' | 'ADMIN';
  category: 'BUG' | 'IDEA' | 'CONFUSING' | 'PRAISE' | 'OTHER';
  rating: number | null;
  message: string;
  page: string | null;
  appVersion: string | null;
  userAgent: string | null;
  contactOk: boolean;
  status: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'WONT_FIX';
  staffNote: string | null;
  createdAt: string;
  updatedAt?: string;
  user: { id: string; userCode: string; displayName: string; email: string | null; phone: string | null } | null;
}

export interface AdminFeedbackList {
  items: AdminFeedback[];
  pagination: Pagination;
  summary: { byStatus: Partial<Record<AdminFeedback['status'], number>>; averageRating: number | null; ratedCount: number };
}
