
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
  refreshToken?: string; // MỚI: Dùng để lấy token mới khi hết hạn
  tokenExpiresAt?: number; 
  
  // Config riêng cho từng kênh (Optional overrides)
  clientId?: string;      // MỚI
  clientSecret?: string;  // MỚI
  
  // Default Metadata
  defaultTitle?: string;       // MỚI
  defaultDescription?: string; // MỚI
  defaultTags?: string[];      // MỚI
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
}

export interface Job {
  id: string;
  videoId: string;
  channelId: string;
  videoTitle: string; 
  channelName: string; 
  status: 'QUEUED' | 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'PAUSED' | 'QUOTA_LIMIT'; // MỚI: QUOTA_LIMIT
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
  SETTINGS = 'SETTINGS'
}
