
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Job, VideoItem, Channel, AppSettings } from '../types';

// FIX CỨNG KẾT NỐI
const SUPABASE_URL = "https://yirtnjaxbtenoqbyfkxe.supabase.co";
const SUPABASE_KEY = "sb_publishable_IoqoydoYYvPowv00SZL5pg_FWoFjV9L";

const supabaseInstance: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export const getSupabase = (): SupabaseClient => {
  return supabaseInstance;
};

export const initSupabase = (url: string, key: string) => {
  return supabaseInstance;
};

/* --- Data Access Layer --- */

// --- CHANNELS ---
export const fetchChannels = async (): Promise<Channel[]> => {
  const { data, error } = await supabaseInstance.from('channels').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Lỗi lấy channels:", error);
    return [];
  }
  
  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url || 'https://ui-avatars.com/api/?name=' + row.name,
    subscriberCount: row.subscriber_count,
    groupId: row.group_id,
    status: row.status,
    lastSync: new Date(row.last_sync).toLocaleString('vi-VN'),
    tags: row.tags || [],
    youtubeId: row.youtube_id,
    
    // Auth
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0,
    
    // Custom Config
    clientId: row.client_id,
    clientSecret: row.client_secret,
    
    // Defaults
    defaultTitle: row.default_title,
    defaultDescription: row.default_description,
    defaultTags: row.default_tags || []
  }));
};

export const addChannel = async (channel: Partial<Channel>) => {
  const { error } = await supabaseInstance.from('channels').insert({
    youtube_id: channel.id || Math.random().toString(36),
    name: channel.name,
    avatar_url: channel.avatarUrl,
    subscriber_count: channel.subscriberCount || 0,
    status: 'ACTIVE',
    tags: channel.tags || [],
    // Lưu các cấu hình custom
    client_id: channel.clientId,
    client_secret: channel.clientSecret,
    default_title: channel.defaultTitle,
    default_description: channel.defaultDescription,
    default_tags: channel.defaultTags
  });
  if (error) throw error;
};

// MỚI: Hàm cập nhật cấu hình kênh (Client ID, Secret, Metadata)
export const updateChannelConfig = async (id: string, config: Partial<Channel>) => {
    const updateData: any = {};
    
    // Chỉ update các trường có giá trị (cho phép chuỗi rỗng để xóa config cũ)
    if (config.clientId !== undefined) updateData.client_id = config.clientId;
    if (config.clientSecret !== undefined) updateData.client_secret = config.clientSecret;
    if (config.defaultTitle !== undefined) updateData.default_title = config.defaultTitle;
    if (config.defaultDescription !== undefined) updateData.default_description = config.defaultDescription;
    if (config.defaultTags !== undefined) updateData.default_tags = config.defaultTags;

    const { error } = await supabaseInstance.from('channels').update(updateData).eq('id', id);
    if (error) throw error;
};

export const updateChannelCredentials = async (id: string, accessToken: string, refreshToken: string, expiresInSeconds: number) => {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    
    const updateData: any = {
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
        last_sync: new Date().toISOString(),
        status: 'ACTIVE' // Reset status về Active khi reconnect
    };

    // Chỉ update refresh token nếu có (đôi khi Google không trả lại refresh token nếu đã cấp rồi)
    if (refreshToken) {
        updateData.refresh_token = refreshToken;
    }

    const { error } = await supabaseInstance.from('channels').update(updateData).eq('id', id);

    if (error) throw error;
};

// Hàm cập nhật riêng Access Token (dùng khi Auto Refresh)
export const updateChannelAccessTokenOnly = async (id: string, accessToken: string, expiresInSeconds: number) => {
     const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
     const { error } = await supabaseInstance.from('channels').update({
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
    }).eq('id', id);
    if (error) console.error("Lỗi update token mới:", error);
}

export const deleteChannel = async (id: string) => {
  const { error } = await supabaseInstance.from('channels').delete().eq('id', id);
  if (error) throw error;
};

// --- VIDEOS ---
export const fetchVideos = async (): Promise<VideoItem[]> => {
  const { data, error } = await supabaseInstance.from('videos').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  
  return data.map((row: any) => ({
    id: row.id,
    filename: row.filename,
    filePath: row.file_path,
    duration: row.duration_seconds ? `${Math.floor(row.duration_seconds/60)}:${row.duration_seconds%60}` : 'Unknown',
    resolution: row.resolution || 'Unknown',
    status: row.status,
    metadata: {
      title: row.title_template || '',
      description: row.desc_template || '',
      tags: row.tags || [],
      visibility: 'private'
    }
  }));
};

export const saveVideo = async (video: Partial<VideoItem>) => {
  const { data: existing } = await supabaseInstance.from('videos').select('id').eq('filename', video.filename).single();
  if (existing) return; 

  const { error } = await supabaseInstance.from('videos').insert({
    filename: video.filename,
    file_path: video.filePath,
    resolution: video.resolution,
    status: 'DRAFT',
    title_template: video.metadata?.title || video.filename,
    desc_template: video.metadata?.description,
    tags: video.metadata?.tags || []
  });
  if (error) throw error;
};

export const updateVideoMetadata = async (id: string, metadata: any) => {
  const { error } = await supabaseInstance.from('videos').update({
    title_template: metadata.title,
    desc_template: metadata.description,
    tags: metadata.tags
  }).eq('id', id);
  if (error) throw error;
};

// --- JOBS ---
export const createJob = async (job: Partial<Job>) => {
  const { error } = await supabaseInstance.from('upload_jobs').insert({
    video_id: job.videoId,
    channel_id: job.channelId,
    scheduled_time: job.scheduledTime,
    status: 'QUEUED'
  });
  if (error) throw error;
};

export const fetchJobs = async (): Promise<Job[]> => {
  // Join lấy đủ thông tin để Refresh Token và Default Metadata
  const { data, error } = await supabaseInstance
    .from('upload_jobs')
    .select(`
      id, status, scheduled_time, retries, error_log,
      videos (title_template, desc_template, tags),
      channels (name, access_token, refresh_token, token_expires_at, client_id, client_secret, default_title, default_description, default_tags)
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return data.map((row: any) => ({
    id: row.id,
    videoId: row.video_id,
    channelId: row.channel_id,
    videoTitle: row.videos?.title_template || 'Video đã xóa',
    channelName: row.channels?.name || 'Kênh đã xóa',
    status: row.status,
    progress: row.status === 'COMPLETED' ? 100 : 0,
    scheduledTime: new Date(row.scheduled_time).toLocaleString('vi-VN'),
    retries: row.retries || 0,
    errorMessage: row.error_log,

    // Auth Data cho Upload
    accessToken: row.channels?.access_token,
    refreshToken: row.channels?.refresh_token,
    tokenExpiresAt: row.channels?.token_expires_at ? new Date(row.channels?.token_expires_at).getTime() : 0,
    clientId: row.channels?.client_id,
    clientSecret: row.channels?.client_secret,

    // Metadata
    videoMetadata: {
        title: row.videos?.title_template || '',
        description: row.videos?.desc_template || '',
        tags: row.videos?.tags || [],
        visibility: 'public'
    },
    // Channel Defaults
    channelDefaultMetadata: {
        title: row.channels?.default_title,
        description: row.channels?.default_description,
        tags: row.channels?.default_tags || []
    }
  }));
};

export const updateJobStatus = async (id: string, status: string, errorLog: string = '') => {
    const { error } = await supabaseInstance.from('upload_jobs').update({
        status: status,
        error_log: errorLog
    }).eq('id', id);
    if (error) console.error("Update Job Error", JSON.stringify(error));
}

export const deleteJob = async (id: string) => {
    await supabaseInstance.from('upload_jobs').delete().eq('id', id);
}

// --- SETTINGS ---
export const fetchSystemSettings = async (): Promise<{youtubeApiKey: string, googleClientId: string}> => {
  try {
    const { data, error } = await supabaseInstance.from('global_settings').select('*').single();
    if (error || !data) return { youtubeApiKey: '', googleClientId: '' };
    return {
      youtubeApiKey: data.youtube_api_key || '',
      googleClientId: data.google_client_id || ''
    };
  } catch (e) {
    return { youtubeApiKey: '', googleClientId: '' };
  }
};

export const saveSystemSettings = async (youtubeApiKey: string, googleClientId: string) => {
  const { error } = await supabaseInstance.from('global_settings').upsert({
    id: 1,
    youtube_api_key: youtubeApiKey,
    google_client_id: googleClientId,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
};

// Hàm Generate SQL cập nhật
export const generateSchemaSQL = (): string => {
  return `
-- 1. Enable UUID
create extension if not exists "uuid-ossp";

-- 2. Table: Global Settings
create table if not exists public.global_settings (
  id int primary key default 1,
  youtube_api_key text,
  google_client_id text,
  updated_at timestamptz default now(),
  constraint single_row_const check (id = 1)
);
alter table public.global_settings enable row level security;
create policy "Enable all" on public.global_settings for all using (true) with check (true);

-- 3. Table: Channels (Đã update thêm cột)
create table if not exists public.channels (
  id uuid primary key default uuid_generate_v4(),
  youtube_id text,
  name text not null,
  avatar_url text,
  subscriber_count bigint default 0,
  status text default 'ACTIVE',
  tags text[],
  last_sync timestamptz default now(),
  created_at timestamptz default now(),
  -- Auth fields
  access_token text, 
  refresh_token text,
  token_expires_at timestamptz,
  client_id text,
  client_secret text,
  -- Defaults
  default_title text,
  default_description text,
  default_tags text[]
);

-- Cột mới (Nếu bảng đã có)
alter table public.channels add column if not exists refresh_token text;
alter table public.channels add column if not exists client_id text;
alter table public.channels add column if not exists client_secret text;
alter table public.channels add column if not exists default_title text;
alter table public.channels add column if not exists default_description text;
alter table public.channels add column if not exists default_tags text[];

alter table public.channels enable row level security;
create policy "Enable all" on public.channels for all using (true) with check (true);

-- 4. Table: Videos
create table if not exists public.videos (
  id uuid primary key default uuid_generate_v4(),
  filename text not null,
  file_path text,
  duration_seconds int,
  resolution text,
  status text default 'DRAFT',
  title_template text,
  desc_template text,
  tags text[],
  created_at timestamptz default now()
);
alter table public.videos enable row level security;
create policy "Enable all" on public.videos for all using (true) with check (true);

-- 5. Table: Jobs
create table if not exists public.upload_jobs (
  id uuid primary key default uuid_generate_v4(),
  video_id uuid references public.videos(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  scheduled_time timestamptz,
  status text default 'QUEUED',
  retries int default 0,
  error_log text,
  created_at timestamptz default now()
);
alter table public.upload_jobs enable row level security;
create policy "Enable all" on public.upload_jobs for all using (true) with check (true);
`;
};
