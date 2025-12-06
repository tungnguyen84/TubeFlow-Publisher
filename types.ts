
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
  SYSTEM_LOGS = 'SYSTEM_LOGS'
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
    totalUploadsToday: number;
    queuedJobs: number;
    failedJobs: number;
    recentActivity: {date: string, count: number}[];
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
