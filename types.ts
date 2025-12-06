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
  youtubeId: string; // ID thật trên YouTube (bắt đầu bằng UC...)
  accessToken?: string; // Token lưu trong DB
  tokenExpiresAt?: number; // Timestamp (ms) khi token hết hạn
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
  filePath: string; // Virtual path reference
  scheduledTime?: string;
  targetChannelIds: string[];
}

export interface Job {
  id: string;
  videoId: string;
  channelId: string;
  videoTitle: string; // Cached for display
  channelName: string; // Cached for display
  status: 'QUEUED' | 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'PAUSED';
  progress: number;
  scheduledTime: string;
  errorMessage?: string;
  retries: number;
}

export interface AppSettings {
  supabaseUrl: string;
  supabaseKey: string;
  youtubeApiKey: string; // Key để đọc Data public
  googleClientId: string; // Key để hiện popup Login OAuth
  maxConcurrentUploads: number;
  uploadDelay: number; // ms
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