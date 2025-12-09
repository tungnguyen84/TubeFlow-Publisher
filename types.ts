

export enum ChannelStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  QUOTA_LIMIT = 'QUOTA_LIMIT',
  DISCONNECTED = 'DISCONNECTED'
}

export enum VideoStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED'
}

export interface ProxyItem {
  id: string;
  ip: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  status: 'ACTIVE' | 'DEAD' | 'UNKNOWN';
  lastChecked?: string;
  location?: string; // VD: US, VN
}

export interface Channel {
  id: string;
  name: string;
  avatarUrl: string;
  subscriberCount: number;
  groupId: string | null;
  status: ChannelStatus;
  lastSync: string;
  tags: string[];
  youtubeId: string; 
  
  // Stats - New Fields
  totalViews?: number;
  videoCount?: number;
  lastStatsSync?: string; // Thời điểm cập nhật số liệu view/sub cuối cùng

  // Auth Data
  accessToken?: string; 
  refreshToken?: string; 
  tokenExpiresAt?: number; 
  
  // Config riêng cho từng kênh (Optional overrides)
  clientId?: string;      
  clientSecret?: string;  
  
  // Default Metadata & Settings
  defaultTitle?: string;       
  defaultDescription?: string; 
  defaultTags?: string[];      
  defaultFolderPath?: string; 
  
  // Schedule Binding
  currentTemplateId?: string; // ID của lịch mẫu đang áp dụng cho kênh này
  
  // Proxy Binding
  proxyId?: string;
  proxyIP?: string; // Để hiển thị nhanh
}

export interface ChannelGroup {
  id: string;
  name: string;
  niche: string;
}

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl?: string;
  playlistId?: string;
  visibility: 'public' | 'private' | 'unlisted';
}

export interface VideoItem {
  id: string;
  filename: string;
  duration: string;
  resolution: string;
  status: VideoStatus;
  metadata: VideoMetadata;
  filePath: string; 
  scheduledTime?: string;
  targetChannelIds: string[];
  
  // Binding Channel
  channelId?: string; // Video này thuộc về kênh nào
  channelName?: string; // Tên kênh sở hữu
  youtubeVideoId?: string; // ID trên YouTube sau khi upload
}

export interface Job {
  id: string;
  videoId: string;
  channelId: string;
  videoTitle: string; 
  videoFilename?: string; // NEW: Để auto match file
  videoFilePath?: string; // NEW: Full path for cleanup script
  channelName: string; 
  status: 'QUEUED' | 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'PAUSED' | 'QUOTA_LIMIT';
  progress: number;
  scheduledTime: string;
  errorMessage?: string;
  retries: number;
  
  // Data join để xử lý upload
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  tokenExpiresAt?: number;
  
  channelDefaultMetadata?: {
      title?: string;
      description?: string;
      tags?: string[];
      defaultFolderPath?: string; // NEW: Để match folder
  };

  videoMetadata?: VideoMetadata;
}

export interface AppSettings {
  supabaseUrl: string;
  supabaseKey: string;
  youtubeApiKey: string; 
  googleClientId: string; 
  maxConcurrentUploads: number;
  uploadDelay: number; 
  defaultVideoPath: string;
}

export enum View {
  DASHBOARD = 'DASHBOARD',
  CHANNELS = 'CHANNELS',
  VIDEOS = 'VIDEOS',
  SCHEDULER = 'SCHEDULER',
  QUEUE = 'QUEUE',
  SETTINGS = 'SETTINGS',
  PROXIES = 'PROXIES',
  ANALYTICS = 'ANALYTICS',
  SYSTEM_LOGS = 'SYSTEM_LOGS',
  ADVANCED_TOOLS = 'ADVANCED_TOOLS',
  // NEW VIEWS
  GROWTH_HACKING = 'GROWTH_HACKING',
  COMMUNITY_HUB = 'COMMUNITY_HUB',
  SAFETY_CENTER = 'SAFETY_CENTER',
  CONTENT_STUDIO = 'CONTENT_STUDIO'
}

// --- NEW TYPES FOR AUTO SCHEDULER ---
export interface TimeSlot {
    time: string; // "09:00"
    count: number; // Số lượng video đăng trong slot này
}

export interface ScheduleTemplate {
    id: string;
    name: string;
    cycleDays: number; // 1 = Hàng ngày, 2 = Cách 1 ngày (2 ngày/lần)...
    timeSlots: TimeSlot[];
    createdAt?: string;
}

export interface DashboardStats {
    totalChannels: number;
    uploadsInPeriod: number; // Renamed from totalUploadsToday for clarity
    queuedJobs: number;
    failedInPeriod: number;
    activeChannelsInPeriod: number; // Count distinct channels uploaded in period
    recentActivity: {date: string, count: number}[];
    errorBreakdown: { type: string, count: number, details: string[] }[]; // NEW: Detailed Error Stats
}

// --- ANALYTICS TYPES ---
export interface VideoAnalytics {
    id: string; // YouTube Video ID
    title: string;
    channelName: string;
    publishedAt: string;
    thumbnailUrl: string;
    stats: {
        viewCount: number;
        likeCount: number;
        commentCount: number;
    };
    performance?: 'HIGH' | 'AVG' | 'LOW'; // So với trung bình kênh
}

export interface ChannelAnalytics {
    channelId: string;
    channelName: string;
    subscriberCount: number;
    totalViews: number;
    videoCount: number;
}

export interface YouTubeVideoStats {
    id: string;
    title: string;
    publishedAt: string;
    thumbnailUrl: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
}

// --- NEW TYPES FOR ADVANCED TOOLS ---
export interface UnifiedComment {
    id: string;
    authorDisplayName: string;
    authorProfileImageUrl: string;
    textDisplay: string;
    publishedAt: string;
    videoTitle: string;
    channelId: string;
    channelName: string; // Mapped locally
    canReply: boolean;
    sentiment?: 'POSITIVE' | 'NEGATIVE' | 'SPAM' | 'QUESTION' | 'UNKNOWN'; // NEW
    replies?: {
        id: string;
        authorDisplayName: string;
        authorProfileImageUrl: string;
        textDisplay: string;
        publishedAt: string;
    }[];
}

export interface CompetitorVideo {
    id: string;
    title: string;
    publishedAt: string;
    thumbnailUrl: string;
    viewCount: number;
    channelTitle: string;
    daysAgo: number;
    velocity?: number; // Views per day
}

// --- NEW TYPES FOR EXPANSION PACK ---
export interface LinkAsset {
    id: string;
    name: string;
    url: string;
    description?: string;
}

export interface ABTest {
    id: string;
    videoId: string;
    channelId: string;
    variantA: { title: string, thumbnail?: string };
    variantB: { title: string, thumbnail?: string };
    status: 'RUNNING' | 'COMPLETED';
    winner?: 'A' | 'B';
    startDate: string;
}
