import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Job, VideoItem, Channel, AppSettings } from '../types';

// FIX CỨNG KẾT NỐI
const SUPABASE_URL = "https://yirtnjaxbtenoqbyfkxe.supabase.co";
const SUPABASE_KEY = "sb_publishable_IoqoydoYYvPowv00SZL5pg_FWoFjV9L";

// Khởi tạo ngay lập tức (Singleton)
const supabaseInstance: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export const getSupabase = (): SupabaseClient => {
  return supabaseInstance;
};

// Hàm này giữ lại để tương thích ngược, nhưng không cần gọi thủ công nữa
export const initSupabase = (url: string, key: string) => {
  console.log("Supabase đã được fix cứng kết nối.");
  return supabaseInstance;
};

/* --- Data Access Layer --- */

// --- CHANNELS ---
export const fetchChannels = async (): Promise<Channel[]> => {
  const { data, error } = await supabaseInstance.from('channels').select('*');
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
    accessToken: row.access_token,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0
  }));
};

export const addChannel = async (channel: Partial<Channel>) => {
  // Thực tế cần OAuth, nhưng ở đây ta lưu metadata vào DB thật
  const { error } = await supabaseInstance.from('channels').insert({
    youtube_id: channel.id || Math.random().toString(36),
    name: channel.name,
    avatar_url: channel.avatarUrl,
    subscriber_count: channel.subscriberCount || 0,
    status: 'ACTIVE',
    tags: channel.tags || []
  });
  if (error) throw error;
};

// MỚI: Cập nhật Token vào DB
export const updateChannelCredentials = async (id: string, accessToken: string, expiresInSeconds: number) => {
    // Tính thời gian hết hạn
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    
    const { error } = await supabaseInstance.from('channels').update({
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
        last_sync: new Date().toISOString()
    }).eq('id', id);

    if (error) throw error;
};

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
  // Kiểm tra trùng lặp
  const { data: existing } = await supabaseInstance.from('videos').select('id').eq('filename', video.filename).single();
  
  if (existing) {
    console.log("Video đã tồn tại, bỏ qua insert:", video.filename);
    return; 
  }

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
  // Join videos and channels tables
  const { data, error } = await supabaseInstance
    .from('upload_jobs')
    .select(`
      id, status, scheduled_time, retries, error_log,
      videos (title_template),
      channels (name)
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
    errorMessage: row.error_log
  }));
};

export const deleteJob = async (id: string) => {
    await supabaseInstance.from('upload_jobs').delete().eq('id', id);
}

// --- SYSTEM SETTINGS (Keys) ---
export const fetchSystemSettings = async (): Promise<{youtubeApiKey: string, googleClientId: string}> => {
  try {
    const { data, error } = await supabaseInstance.from('global_settings').select('*').single();
    if (error || !data) {
      return { youtubeApiKey: '', googleClientId: '' };
    }
    return {
      youtubeApiKey: data.youtube_api_key || '',
      googleClientId: data.google_client_id || ''
    };
  } catch (e) {
    console.warn("Chưa có bảng global_settings hoặc lỗi kết nối:", e);
    return { youtubeApiKey: '', googleClientId: '' };
  }
};

export const saveSystemSettings = async (youtubeApiKey: string, googleClientId: string) => {
  // ID = 1 để đảm bảo chỉ có 1 dòng config (Singleton pattern trong DB)
  const { error } = await supabaseInstance.from('global_settings').upsert({
    id: 1,
    youtube_api_key: youtubeApiKey,
    google_client_id: googleClientId,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
};


export const generateSchemaSQL = (): string => {
  return `
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Table: Global Settings (Lưu API Keys)
create table if not exists public.global_settings (
  id int primary key default 1,
  youtube_api_key text,
  google_client_id text,
  updated_at timestamptz default now(),
  constraint single_row_const check (id = 1)
);

-- RLS Settings (Drop trước để tránh lỗi)
alter table public.global_settings enable row level security;
drop policy if exists "Enable all access settings" on public.global_settings;
create policy "Enable all access settings" on public.global_settings for all using (true) with check (true);


-- 2. Table: Channels
create table if not exists public.channels (
  id uuid primary key default uuid_generate_v4(),
  youtube_id text,
  name text not null,
  avatar_url text,
  subscriber_count bigint default 0,
  status text default 'ACTIVE',
  tags text[],
  last_sync timestamptz default now(),
  access_token text, 
  token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- Update Columns
alter table public.channels add column if not exists access_token text;
alter table public.channels add column if not exists token_expires_at timestamptz;

-- RLS Channels
alter table public.channels enable row level security;
drop policy if exists "Enable all access channels" on public.channels;
create policy "Enable all access channels" on public.channels for all using (true) with check (true);


-- 3. Table: Videos
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

-- RLS Videos
alter table public.videos enable row level security;
drop policy if exists "Enable all access videos" on public.videos;
create policy "Enable all access videos" on public.videos for all using (true) with check (true);


-- 4. Table: Jobs
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

-- RLS Jobs
alter table public.upload_jobs enable row level security;
drop policy if exists "Enable all access jobs" on public.upload_jobs;
create policy "Enable all access jobs" on public.upload_jobs for all using (true) with check (true);
`;
};