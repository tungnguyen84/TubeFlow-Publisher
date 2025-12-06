
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Job, VideoItem, Channel, AppSettings, ScheduleTemplate, DashboardStats, ProxyItem } from '../types';

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

// --- PROXIES ---
export const fetchProxies = async (): Promise<ProxyItem[]> => {
    try {
        const { data, error } = await supabaseInstance.from('proxies').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data.map((row: any) => ({
            id: row.id,
            ip: row.ip,
            port: row.port,
            username: row.username,
            password: row.password,
            protocol: row.protocol,
            status: row.status,
            lastChecked: row.last_checked ? new Date(row.last_checked).toLocaleString('vi-VN') : undefined,
            location: row.location
        }));
    } catch (e) {
        console.warn("Table proxies likely not exists yet.");
        return [];
    }
};

export const saveProxy = async (proxy: Partial<ProxyItem>) => {
    const { error } = await supabaseInstance.from('proxies').insert({
        ip: proxy.ip,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
        protocol: proxy.protocol,
        status: 'UNKNOWN',
        location: proxy.location
    });
    if (error) throw error;
};

export const deleteProxy = async (id: string) => {
    const { error } = await supabaseInstance.from('proxies').delete().eq('id', id);
    if (error) throw error;
};

// --- CHANNELS ---
export const fetchChannels = async (): Promise<Channel[]> => {
  // 1. Try fetching with proxies join
  // NOTE: This might fail if the user hasn't run the migration to create 'proxies' table/relation.
  let { data, error } = await supabaseInstance.from('channels').select(`
    *,
    proxies (ip, port, protocol)
  `).order('created_at', { ascending: false });
  
  // 2. Fallback: If relation 'proxies' not found or error, fetch without join
  if (error) {
    console.warn("Lỗi lấy channels kèm proxy (có thể chưa update DB), đang thử lại chế độ cơ bản...", error);
    const retry = await supabaseInstance.from('channels').select('*').order('created_at', { ascending: false });
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("Lỗi lấy channels (Fatal):", JSON.stringify(error));
    return [];
  }
  
  return (data || []).map((row: any) => ({
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
    defaultTags: row.default_tags || [],
    defaultFolderPath: row.default_folder_path,
    
    // Schedule Binding
    currentTemplateId: row.current_template_id,

    // Proxy Binding
    proxyId: row.proxy_id,
    proxyIP: row.proxies ? `${row.proxies.protocol}://${row.proxies.ip}:${row.proxies.port}` : undefined
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
    default_tags: channel.defaultTags,
    default_folder_path: channel.defaultFolderPath,
    proxy_id: channel.proxyId
  });
  if (error) throw error;
};

// Hàm cập nhật cấu hình kênh
export const updateChannelConfig = async (id: string, config: Partial<Channel>) => {
    const updateData: any = {};
    
    // Chỉ update các trường có giá trị
    if (config.clientId !== undefined) updateData.client_id = config.clientId;
    if (config.clientSecret !== undefined) updateData.client_secret = config.clientSecret;
    if (config.defaultTitle !== undefined) updateData.default_title = config.defaultTitle;
    if (config.defaultDescription !== undefined) updateData.default_description = config.defaultDescription;
    if (config.defaultTags !== undefined) updateData.default_tags = config.defaultTags;
    if (config.defaultFolderPath !== undefined) updateData.default_folder_path = config.defaultFolderPath;
    if (config.proxyId !== undefined) updateData.proxy_id = config.proxyId;

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

    if (refreshToken) {
        updateData.refresh_token = refreshToken;
    }

    const { error } = await supabaseInstance.from('channels').update(updateData).eq('id', id);

    if (error) throw error;
};

export const updateChannelAccessTokenOnly = async (id: string, accessToken: string, expiresInSeconds: number) => {
     const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
     const { error } = await supabaseInstance.from('channels').update({
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
    }).eq('id', id);
    if (error) console.error("Lỗi update token mới:", error);
}

export const updateChannelTemplate = async (channelId: string, templateId: string) => {
    await supabaseInstance.from('channels').update({ current_template_id: templateId }).eq('id', channelId);
}

export const deleteChannel = async (id: string) => {
  const { error } = await supabaseInstance.from('channels').delete().eq('id', id);
  if (error) throw error;
};

// --- VIDEOS ---
export const fetchVideos = async (
    filters: { channelId?: string, status?: string, folder?: string, limit?: number } = {}
): Promise<VideoItem[]> => {
  let query = supabaseInstance
    .from('videos')
    .select(`*, channels(name)`)
    .order('created_at', { ascending: false });

  if (filters.channelId) {
      query = query.eq('channel_id', filters.channelId);
  }
  if (filters.status) {
      query = query.eq('status', filters.status);
  }
  if (filters.folder) {
      query = query.ilike('file_path', `%${filters.folder}%`);
  }
  
  // Logic giới hạn số lượng bản ghi
  if (filters.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
  }
    
  const { data, error } = await query;
  if (error) throw error;
  
  return data.map((row: any) => ({
    id: row.id,
    filename: row.filename,
    filePath: row.file_path,
    duration: row.duration_seconds ? `${Math.floor(row.duration_seconds/60)}:${row.duration_seconds%60}` : 'Unknown',
    resolution: row.resolution || 'Unknown',
    status: row.status,
    // Binding Info
    channelId: row.channel_id,
    channelName: row.channels?.name,
    youtubeVideoId: row.youtube_video_id,

    metadata: {
      title: row.title_template || '',
      description: row.desc_template || '',
      tags: row.tags || [],
      visibility: 'private'
    }
  }));
};

export const saveVideo = async (video: Partial<VideoItem>): Promise<string> => {
  // Kiểm tra trùng lặp theo filename. Nếu có channelId, check trùng filename TRONG channel đó
  let query = supabaseInstance.from('videos').select('id').eq('filename', video.filename);
  if (video.channelId) {
      query = query.eq('channel_id', video.channelId);
  }
  
  const { data: existing } = await query.maybeSingle();
  
  if (existing) {
    return existing.id; 
  }

  const { data, error } = await supabaseInstance.from('videos').insert({
    filename: video.filename,
    file_path: video.filePath,
    resolution: video.resolution,
    status: 'DRAFT',
    title_template: video.metadata?.title || video.filename,
    desc_template: video.metadata?.description,
    tags: video.metadata?.tags || [],
    channel_id: video.channelId // Lưu channel ownership
  }).select('id').single();

  if (error) throw error;
  return data.id;
};

// Hàm mới: Quét file từ folder (thực chất là nhận list file từ client) và sync vào DB cho Channel
export const syncVideosForChannel = async (channelId: string, folderPath: string, files: {name: string}[]) => {
    // 1. Chuẩn bị đường dẫn cơ sở.
    // Lưu ý: folderPath là chuỗi người dùng nhập (C:\Videos\...)
    const cleanFolderPath = folderPath.endsWith('\\') || folderPath.endsWith('/') ? folderPath : folderPath + '\\';

    for (const file of files) {
        const fullPath = cleanFolderPath + file.name;
        const fileNameNoExt = file.name.replace(/\.[^/.]+$/, "");
        
        // 2. Upsert Video: Nếu video tên đó đã có ở kênh này -> Update path. Nếu chưa -> Insert
        const { data: existing } = await supabaseInstance
            .from('videos')
            .select('id')
            .eq('channel_id', channelId)
            .eq('filename', file.name)
            .maybeSingle();

        if (existing) {
            // Update path nếu cần
            await supabaseInstance.from('videos').update({ file_path: fullPath }).eq('id', existing.id);
        } else {
            // Insert mới
            await supabaseInstance.from('videos').insert({
                filename: file.name,
                file_path: fullPath,
                channel_id: channelId,
                status: 'DRAFT',
                title_template: fileNameNoExt,
                desc_template: '',
                tags: []
            });
        }
    }
}

export const updateVideoMetadata = async (id: string, metadata: any) => {
  const { error } = await supabaseInstance.from('videos').update({
    title_template: metadata.title,
    desc_template: metadata.description,
    tags: metadata.tags
  }).eq('id', id);
  if (error) throw error;
};

export const updateVideoYoutubeId = async (id: string, youtubeVideoId: string) => {
    const { error } = await supabaseInstance.from('videos').update({
        youtube_video_id: youtubeVideoId,
        status: 'PUBLISHED'
    }).eq('id', id);
    if (error) throw error;
}

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

// Hàm fetchErrorLogs: Chỉ lấy những job bị lỗi hoặc limit, không giới hạn ngày (hoặc giới hạn rộng)
export const fetchErrorLogs = async (): Promise<Job[]> => {
    const { data, error } = await supabaseInstance
        .from('upload_jobs')
        .select(`
            id, status, scheduled_time, retries, error_log, created_at,
            videos (title_template, desc_template, tags),
            channels (name, access_token, refresh_token)
        `)
        .in('status', ['FAILED', 'QUOTA_LIMIT'])
        .order('scheduled_time', { ascending: false })
        .limit(100);

    if (error) throw error;

    return data.map((row: any) => ({
        id: row.id,
        videoId: row.video_id,
        channelId: row.channel_id,
        videoTitle: row.videos?.title_template || 'Video đã xóa',
        channelName: row.channels?.name || 'Kênh đã xóa',
        status: row.status,
        progress: 0,
        scheduledTime: new Date(row.scheduled_time).toLocaleString('vi-VN'),
        retries: row.retries || 0,
        errorMessage: row.error_log,
        accessToken: row.channels?.access_token, // Just to check status
        refreshToken: row.channels?.refresh_token
    }));
}

export const fetchJobs = async (daysLimit: number = 3, channelId: string | null = null): Promise<Job[]> => {
  const now = new Date();
  
  // Start Date: Now - daysLimit
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysLimit);
  const isoStartDate = startDate.toISOString();

  // End Date: Now + daysLimit (Chỉ lấy job trong khoảng cửa sổ thời gian này, tránh load job quá xa trong tương lai)
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + daysLimit);
  const isoEndDate = endDate.toISOString();

  let query = supabaseInstance
    .from('upload_jobs')
    .select(`
      id, status, scheduled_time, retries, error_log, created_at,
      videos (title_template, desc_template, tags),
      channels (name, access_token, refresh_token, token_expires_at, client_id, client_secret, default_title, default_description, default_tags)
    `)
    .gte('scheduled_time', isoStartDate)
    .lte('scheduled_time', isoEndDate) // Filter Upper Bound
    .order('scheduled_time', { ascending: true });

  if (channelId) {
      query = query.eq('channel_id', channelId);
  }

  const { data, error } = await query;
  
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

// --- SCHEDULE TEMPLATES ---
export const saveScheduleTemplate = async (template: Partial<ScheduleTemplate>) => {
    const { error } = await supabaseInstance.from('schedule_templates').insert({
        name: template.name,
        cycle_days: template.cycleDays,
        time_slots: template.timeSlots,
        created_at: new Date().toISOString()
    });
    if (error) throw error;
}

export const fetchScheduleTemplates = async (): Promise<ScheduleTemplate[]> => {
    const { data, error } = await supabaseInstance.from('schedule_templates').select('*').order('created_at', { ascending: false });
    if (error) return [];
    
    return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        cycleDays: row.cycle_days,
        timeSlots: row.time_slots,
        createdAt: row.created_at
    }));
}

export const deleteScheduleTemplate = async (id: string) => {
    const { error } = await supabaseInstance.from('schedule_templates').delete().eq('id', id);
    if (error) throw error;
}

// --- DASHBOARD STATS ---
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
    // 1. Total Channels
    const { count: totalChannels } = await supabaseInstance.from('channels').select('*', { count: 'exact', head: true });

    // 2. Uploads Today
    const today = new Date().toISOString().split('T')[0];
    const { count: uploadsToday } = await supabaseInstance
        .from('upload_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'COMPLETED')
        .gte('scheduled_time', today);

    // 3. Queued Jobs
    const { count: queuedJobs } = await supabaseInstance
        .from('upload_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'QUEUED');
        
    // 4. Failed Jobs
    const { count: failedJobs } = await supabaseInstance
        .from('upload_jobs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['FAILED', 'QUOTA_LIMIT']);
    
    // 5. Recent Activity (Last 7 days completed jobs)
    // Supabase group by query is tricky in JS client, so we do simple aggregation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const { data: recentJobs } = await supabaseInstance
        .from('upload_jobs')
        .select('scheduled_time')
        .eq('status', 'COMPLETED')
        .gte('scheduled_time', sevenDaysAgo.toISOString());
    
    const activityMap: Record<string, number> = {};
    // Init last 7 days with 0
    for(let i=0; i<7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        activityMap[d.toISOString().split('T')[0]] = 0;
    }
    
    if (recentJobs) {
        recentJobs.forEach((job:any) => {
            const dateStr = new Date(job.scheduled_time).toISOString().split('T')[0];
            if (activityMap[dateStr] !== undefined) activityMap[dateStr]++;
        });
    }
    
    const recentActivity = Object.entries(activityMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a,b) => a.date.localeCompare(b.date)); // Sort asc for chart

    return {
        totalChannels: totalChannels || 0,
        totalUploadsToday: uploadsToday || 0,
        queuedJobs: queuedJobs || 0,
        failedJobs: failedJobs || 0,
        recentActivity
    };
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
drop policy if exists "Enable all" on public.global_settings;
create policy "Enable all" on public.global_settings for all using (true) with check (true);

-- 3. Table: Proxies
create table if not exists public.proxies (
  id uuid primary key default uuid_generate_v4(),
  ip text not null,
  port int not null,
  username text,
  password text,
  protocol text default 'http',
  status text default 'UNKNOWN',
  last_checked timestamptz,
  location text,
  created_at timestamptz default now()
);
alter table public.proxies enable row level security;
drop policy if exists "Enable all" on public.proxies;
create policy "Enable all" on public.proxies for all using (true) with check (true);

-- 4. Table: Channels
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
  default_tags text[],
  default_folder_path text,
  -- NEW: Schedule Template Binding
  current_template_id uuid,
  -- NEW: Proxy Binding
  proxy_id uuid references public.proxies(id) on delete set null
);

alter table public.channels add column if not exists refresh_token text;
alter table public.channels add column if not exists client_id text;
alter table public.channels add column if not exists client_secret text;
alter table public.channels add column if not exists default_title text;
alter table public.channels add column if not exists default_description text;
alter table public.channels add column if not exists default_tags text[];
alter table public.channels add column if not exists default_folder_path text;
alter table public.channels add column if not exists current_template_id uuid;
alter table public.channels add column if not exists proxy_id uuid references public.proxies(id) on delete set null;

alter table public.channels enable row level security;
drop policy if exists "Enable all" on public.channels;
create policy "Enable all" on public.channels for all using (true) with check (true);

-- 5. Table: Videos
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
  created_at timestamptz default now(),
  channel_id uuid references public.channels(id) on delete set null,
  -- Analytics & Tracking
  youtube_video_id text,
  ab_test_config jsonb
);

alter table public.videos add column if not exists channel_id uuid references public.channels(id) on delete set null;
alter table public.videos add column if not exists youtube_video_id text;
alter table public.videos add column if not exists ab_test_config jsonb;

alter table public.videos enable row level security;
drop policy if exists "Enable all" on public.videos;
create policy "Enable all" on public.videos for all using (true) with check (true);

-- 6. Table: Jobs
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
drop policy if exists "Enable all" on public.upload_jobs;
create policy "Enable all" on public.upload_jobs for all using (true) with check (true);

-- 7. Table: Schedule Templates
create table if not exists public.schedule_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cycle_days int,
  time_slots jsonb,
  created_at timestamptz default now()
);
alter table public.schedule_templates enable row level security;
drop policy if exists "Enable all" on public.schedule_templates;
create policy "Enable all" on public.schedule_templates for all using (true) with check (true);
`;
};
