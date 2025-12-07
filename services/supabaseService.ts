
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
    if (error) throw new Error(error.message);
};

export const deleteProxy = async (id: string) => {
    const { error } = await supabaseInstance.from('proxies').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

// --- CHANNELS ---
export const fetchChannels = async (): Promise<Channel[]> => {
  // 1. Try fetching with proxies join
  let { data, error } = await supabaseInstance.from('channels').select(`
    *,
    proxies (ip, port, protocol)
  `).order('created_at', { ascending: false });
  
  if (error) {
    console.warn("Lỗi lấy channels kèm proxy (thử lại basic):", error.message || error);
    const retry = await supabaseInstance.from('channels').select('*').order('created_at', { ascending: false });
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("Lỗi lấy channels (Fatal):", error.message || error);
    return [];
  }
  
  return (data || []).map((row: any) => {
    // Handle proxies (could be array or object depending on join)
    let proxyIP = undefined;
    if (row.proxies) {
        if (Array.isArray(row.proxies)) {
             if (row.proxies.length > 0) {
                 proxyIP = `${row.proxies[0].protocol}://${row.proxies[0].ip}:${row.proxies[0].port}`;
             }
        } else {
             proxyIP = `${row.proxies.protocol}://${row.proxies.ip}:${row.proxies.port}`;
        }
    }

    return {
        id: row.id,
        name: row.name,
        avatarUrl: row.avatar_url || 'https://ui-avatars.com/api/?name=' + row.name,
        subscriberCount: row.subscriber_count,
        groupId: row.group_id,
        status: row.status,
        lastSync: new Date(row.last_sync).toLocaleString('vi-VN'),
        tags: row.tags || [],
        youtubeId: row.youtube_id,
        
        // Stats Mapping
        totalViews: row.total_views || 0,
        videoCount: row.video_count || 0,
        lastStatsSync: row.last_stats_sync,

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
        proxyIP: proxyIP
    };
  });
};

export const addChannel = async (channel: Partial<Channel>) => {
  // CRITICAL FIX: Use channel.youtubeId explicitly.
  // If youtubeId is missing, throw error instead of using random string.
  if (!channel.youtubeId) {
      console.error("Missing YouTube ID in addChannel payload:", channel);
      throw new Error("Lỗi hệ thống: YouTube ID bị thiếu khi lưu kênh.");
  }

  const { error } = await supabaseInstance.from('channels').insert({
    youtube_id: channel.youtubeId, 
    name: channel.name,
    avatar_url: channel.avatarUrl,
    subscriber_count: channel.subscriberCount || 0,
    status: 'ACTIVE',
    tags: channel.tags || [],
    client_id: channel.clientId,
    client_secret: channel.clientSecret,
    default_title: channel.defaultTitle,
    default_description: channel.defaultDescription,
    default_tags: channel.defaultTags,
    default_folder_path: channel.defaultFolderPath,
    proxy_id: channel.proxyId
  });
  if (error) throw new Error(error.message);
};

export const updateChannelConfig = async (id: string, config: Partial<Channel>) => {
    const updateData: any = {};
    if (config.clientId !== undefined) updateData.client_id = config.clientId;
    if (config.clientSecret !== undefined) updateData.client_secret = config.clientSecret;
    if (config.defaultTitle !== undefined) updateData.default_title = config.defaultTitle;
    if (config.defaultDescription !== undefined) updateData.default_description = config.defaultDescription;
    if (config.defaultTags !== undefined) updateData.default_tags = config.defaultTags;
    if (config.defaultFolderPath !== undefined) updateData.default_folder_path = config.defaultFolderPath;
    if (config.proxyId !== undefined) updateData.proxy_id = config.proxyId;

    const { error } = await supabaseInstance.from('channels').update(updateData).eq('id', id);
    if (error) throw new Error(error.message);
};

export const updateChannelCredentials = async (id: string, accessToken: string, refreshToken: string, expiresInSeconds: number) => {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const updateData: any = {
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
        last_sync: new Date().toISOString(),
        status: 'ACTIVE'
    };
    if (refreshToken) updateData.refresh_token = refreshToken;
    const { error } = await supabaseInstance.from('channels').update(updateData).eq('id', id);
    if (error) throw new Error(error.message);
};

export const updateChannelAccessTokenOnly = async (id: string, accessToken: string, expiresInSeconds: number) => {
     const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
     const { error } = await supabaseInstance.from('channels').update({
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
    }).eq('id', id);
    if (error) console.error("Lỗi update token mới:", error.message || error);
}

// NEW: Update Channel Analytics Stats
export const updateChannelStats = async (id: string, stats: { subscriberCount?: number, totalViews?: number, videoCount?: number }) => {
    const updateData: any = {
        last_stats_sync: new Date().toISOString()
    };
    if (stats.subscriberCount !== undefined) updateData.subscriber_count = stats.subscriberCount;
    if (stats.totalViews !== undefined) updateData.total_views = stats.totalViews;
    if (stats.videoCount !== undefined) updateData.video_count = stats.videoCount;

    const { error } = await supabaseInstance.from('channels').update(updateData).eq('id', id);
    if (error) {
         // Specific hint for the missing column error
         if (error.message.includes("Could not find the 'last_stats_sync' column")) {
             throw new Error("Lỗi DB: Bảng 'channels' thiếu cột mới. Hãy vào Settings > Database, Copy SQL và chạy lại trong Supabase.");
         }
         throw new Error(error.message);
    }
}

export const updateChannelTemplate = async (channelId: string, templateId: string) => {
    await supabaseInstance.from('channels').update({ current_template_id: templateId }).eq('id', channelId);
}

export const deleteChannel = async (id: string) => {
  const { error } = await supabaseInstance.from('channels').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

// --- VIDEOS ---
// NEW: Fetch Count of Draft Videos per Channel (Optimized for large DB)
export const fetchDraftCounts = async (): Promise<Record<string, number>> => {
    // Strategy 1: Try fetching from a View (Best Performance)
    // CREATE VIEW view_channel_draft_counts AS SELECT channel_id, COUNT(*) as count FROM videos WHERE status = 'DRAFT' GROUP BY channel_id;
    try {
        const { data, error } = await supabaseInstance.from('view_channel_draft_counts').select('*');
        if (!error && data) {
            const counts: Record<string, number> = {};
            data.forEach((row: any) => {
                counts[row.channel_id] = row.count;
            });
            return counts;
        }
    } catch (e) {
        // Fallback if view doesn't exist
    }

    // Strategy 2: Client-side Aggregation with Pagination (Robust fallback)
    // This loops until all draft video UUIDs are fetched.
    const counts: Record<string, number> = {};
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabaseInstance
            .from('videos')
            .select('channel_id')
            .eq('status', 'DRAFT')
            .range(from, from + pageSize - 1);

        if (error) {
            console.error("Error fetching draft counts (chunked):", error.message || error);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }

        data.forEach((row: any) => {
            if (row.channel_id) {
                counts[row.channel_id] = (counts[row.channel_id] || 0) + 1;
            }
        });

        // If we got fewer rows than requested, we are done
        if (data.length < pageSize) {
            hasMore = false;
        } else {
            from += pageSize;
        }
    }

    return counts;
};

export const fetchVideos = async (
    filters: { channelId?: string, status?: string, folder?: string, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc', isOrphan?: boolean } = {}
): Promise<VideoItem[]> => {
  let query = supabaseInstance
    .from('videos')
    .select(`*, channels(name)`);

  // SORTING LOGIC
  const sortCol = filters.sortBy || 'created_at';
  const sortAsc = filters.sortOrder === 'asc';
  query = query.order(sortCol, { ascending: sortAsc });

  if (filters.isOrphan) {
      query = query.is('channel_id', null);
  } else if (filters.channelId) {
      query = query.eq('channel_id', filters.channelId);
  }

  if (filters.status) {
      query = query.eq('status', filters.status);
  }
  if (filters.folder) {
      query = query.ilike('file_path', `%${filters.folder}%`);
  }
  
  if (filters.limit && filters.limit > 1000) {
      let allData: any[] = [];
      const pageSize = 1000;
      let from = 0;
      let remaining = filters.limit;
      
      while (remaining > 0) {
          const fetchSize = Math.min(pageSize, remaining);
          const { data, error } = await query.range(from, from + fetchSize - 1);
          if (error) throw new Error(error.message);
          if (!data || data.length === 0) break;
          
          allData = [...allData, ...data];
          if (data.length < fetchSize) break; 
          
          from += fetchSize;
          remaining -= fetchSize;
      }
      return mapVideoData(allData);

  } else if (filters.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return mapVideoData(data);
  } else {
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return mapVideoData(data);
  }
};

const mapVideoData = (data: any[]): VideoItem[] => {
    return data.map((row: any) => ({
        id: row.id,
        filename: row.filename,
        filePath: row.file_path,
        duration: row.duration_seconds ? `${Math.floor(row.duration_seconds/60)}:${row.duration_seconds%60}` : 'Unknown',
        resolution: row.resolution || 'Unknown',
        status: row.status,
        channelId: row.channel_id,
        channelName: row.channels?.name,
        youtubeVideoId: row.youtube_video_id,
        targetChannelIds: [],
        metadata: {
        title: row.title_template || '',
        description: row.desc_template || '',
        tags: row.tags || [],
        visibility: 'private'
        }
    }));
}

export const saveVideo = async (video: Partial<VideoItem>): Promise<string> => {
  // Check existence properly: match Filename AND Channel (or both null/orphan)
  let query = supabaseInstance.from('videos').select('id').eq('filename', video.filename);
  
  if (video.channelId) {
      query = query.eq('channel_id', video.channelId);
  } else {
      query = query.is('channel_id', null);
  }
  
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing.id; 

  const { data, error } = await supabaseInstance.from('videos').insert({
    filename: video.filename,
    file_path: video.filePath,
    resolution: video.resolution,
    status: 'DRAFT',
    title_template: video.metadata?.title || video.filename,
    desc_template: video.metadata?.description,
    tags: video.metadata?.tags || [],
    channel_id: video.channelId || null
  }).select('id').single();

  if (error) throw new Error(error.message);
  return data.id;
};

export const deleteVideos = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const { error } = await supabaseInstance.from('videos').delete().in('id', ids);
    if (error) throw new Error(error.message);
}

// NEW: Bulk Update Videos (For Bulk Editor)
export const bulkUpdateVideos = async (ids: string[], updates: any) => {
    if (!ids || ids.length === 0) return;
    
    const { error } = await supabaseInstance
        .from('videos')
        .update(updates)
        .in('id', ids);
        
    if (error) throw new Error("Bulk update failed: " + error.message);
}

export const syncVideosForChannel = async (channelId: string, folderPath: string, files: {name: string}[]) => {
    const cleanFolderPath = folderPath.endsWith('\\') || folderPath.endsWith('/') ? folderPath : folderPath + '\\';
    for (const file of files) {
        const fullPath = cleanFolderPath + file.name;
        const fileNameNoExt = file.name.replace(/\.[^/.]+$/, "");
        const { data: existing } = await supabaseInstance
            .from('videos')
            .select('id')
            .eq('channel_id', channelId)
            .eq('filename', file.name)
            .maybeSingle();

        if (existing) {
            await supabaseInstance.from('videos').update({ file_path: fullPath }).eq('id', existing.id);
        } else {
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

export const updateVideoMetadata = async (id: string, metadata: any, channelId?: string) => {
  const updateData: any = {
    title_template: metadata.title,
    desc_template: metadata.description,
    tags: metadata.tags
  };
  if (channelId !== undefined) {
      updateData.channel_id = channelId;
  }

  const { error } = await supabaseInstance.from('videos').update(updateData).eq('id', id);
  if (error) throw new Error(error.message);
};

export const updateVideoYoutubeId = async (id: string, youtubeVideoId: string) => {
    const { error } = await supabaseInstance.from('videos').update({
        youtube_video_id: youtubeVideoId,
        status: 'PUBLISHED'
    }).eq('id', id);
    if (error) throw new Error(error.message);
}

// --- JOBS ---
export const createJob = async (job: Partial<Job>) => {
  const { error } = await supabaseInstance.from('upload_jobs').insert({
    video_id: job.videoId,
    channel_id: job.channelId,
    scheduled_time: job.scheduledTime,
    status: 'QUEUED'
  });
  if (error) throw new Error(error.message);
};

export const fetchErrorLogs = async (): Promise<Job[]> => {
    // FIX: ADD video_id, channel_id to select
    const { data, error } = await supabaseInstance
        .from('upload_jobs')
        .select(`
            id, video_id, channel_id, status, scheduled_time, retries, error_log, created_at,
            videos (title_template, desc_template, tags),
            channels (name, access_token, refresh_token)
        `)
        .in('status', ['FAILED', 'QUOTA_LIMIT'])
        .order('scheduled_time', { ascending: false })
        .limit(100);

    if (error) throw new Error(error.message);

    return data.map((row: any) => ({
        id: row.id,
        videoId: row.video_id,
        channelId: row.channel_id,
        videoTitle: row.videos?.title_template || 'Video đã xóa',
        channelName: row.channels?.name || 'Kênh đã xóa',
        status: row.status,
        progress: 0,
        // FIX: Return raw ISO string for correct logic comparison
        scheduledTime: row.scheduled_time, 
        retries: row.retries || 0,
        errorMessage: row.error_log,
        accessToken: row.channels?.access_token, 
        refreshToken: row.channels?.refresh_token
    }));
}

export const fetchJobs = async (daysLimit: number = 3, channelId: string | null = null, status: string | null = null): Promise<Job[]> => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysLimit);
  const isoStartDate = startDate.toISOString();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + daysLimit);
  const isoEndDate = endDate.toISOString();

  // FIX: ADD video_id, channel_id to select
  let query = supabaseInstance
    .from('upload_jobs')
    .select(`
      id, video_id, channel_id, status, scheduled_time, retries, error_log, created_at,
      videos (filename, title_template, desc_template, tags),
      channels (name, access_token, refresh_token, token_expires_at, client_id, client_secret, default_title, default_description, default_tags, default_folder_path)
    `)
    .gte('scheduled_time', isoStartDate)
    .lte('scheduled_time', isoEndDate)
    .order('scheduled_time', { ascending: true });

  if (channelId) {
      query = query.eq('channel_id', channelId);
  }

  if (status) {
      query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  
  return data.map((row: any) => ({
    id: row.id,
    videoId: row.video_id,
    channelId: row.channel_id,
    videoFilename: row.videos?.filename, // Map filename
    videoTitle: row.videos?.title_template || 'Video đã xóa',
    channelName: row.channels?.name || 'Kênh đã xóa',
    status: row.status,
    progress: row.status === 'COMPLETED' ? 100 : 0,
    // FIX: Return raw ISO string for correct logic comparison
    scheduledTime: row.scheduled_time, 
    retries: row.retries || 0,
    errorMessage: row.error_log,
    accessToken: row.channels?.access_token,
    refreshToken: row.channels?.refresh_token,
    tokenExpiresAt: row.channels?.token_expires_at ? new Date(row.channels?.token_expires_at).getTime() : 0,
    clientId: row.channels?.client_id,
    clientSecret: row.channels?.client_secret,
    videoMetadata: {
        title: row.videos?.title_template || '',
        description: row.videos?.desc_template || '',
        tags: row.videos?.tags || [],
        visibility: 'public'
    },
    channelDefaultMetadata: {
        title: row.channels?.default_title,
        description: row.channels?.default_description,
        tags: row.channels?.default_tags || [],
        defaultFolderPath: row.channels?.default_folder_path // NEW: Mapped
    }
  }));
};

export const updateJobStatus = async (id: string, status: string, errorLog: string = '') => {
    const { error } = await supabaseInstance.from('upload_jobs').update({
        status: status,
        error_log: errorLog
    }).eq('id', id);
    if (error) console.error("Update Job Error", error.message || error);
}

export const deleteJob = async (id: string) => {
    const { error } = await supabaseInstance.from('upload_jobs').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

// NEW: Clear queued jobs with STRICT logic & LOGGING
// Options:
// 1. channelId provided -> delete matching channel
// 2. status provided -> delete matching status
// 3. No options -> DELETE ALL (Truncate)
export const clearAllQueuedJobs = async (channelId?: string, status?: string): Promise<number | null> => {
    console.log("🔥 [Delete Operation] Starting...", { channelId, status });
    let query = supabaseInstance.from('upload_jobs').delete({ count: 'exact' });
    
    // Nếu cả channelId và status đều không có, nghĩa là "Xóa tất cả". 
    // Supabase yêu cầu ít nhất 1 filter để delete nếu không tắt chế độ safe mode.
    
    if (channelId) {
        console.log(" -> Filter by Channel:", channelId);
        query = query.eq('channel_id', channelId);
    }

    if (status) {
        console.log(" -> Filter by Status:", status);
        query = query.eq('status', status);
    }
    
    // Nếu không có filter (muốn xóa tất cả), dùng .not('id', 'is', null) để bypass safe mode
    if (!channelId && !status) {
         console.log(" -> No filters provided. DELETING ALL RECORDS in upload_jobs table.");
         query = query.not('id', 'is', null);
    }

    const { error, count } = await query;
    
    if (error) {
        console.error("❌ [Delete Error]:", error);
        throw new Error(error.message || "Lỗi không xác định khi xóa Queue");
    }
    
    console.log("✅ [Delete Success] Deleted count:", count);
    return count;
}

// --- SCHEDULE TEMPLATES ---
export const saveScheduleTemplate = async (template: Partial<ScheduleTemplate>) => {
    const { error } = await supabaseInstance.from('schedule_templates').insert({
        name: template.name,
        cycle_days: template.cycleDays,
        time_slots: template.timeSlots,
        created_at: new Date().toISOString()
    });
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
}

// --- DASHBOARD STATS ---
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
    const { count: totalChannels } = await supabaseInstance.from('channels').select('*', { count: 'exact', head: true });
    const today = new Date().toISOString().split('T')[0];
    const { count: uploadsToday } = await supabaseInstance
        .from('upload_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'COMPLETED')
        .gte('scheduled_time', today);
    const { count: queuedJobs } = await supabaseInstance
        .from('upload_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'QUEUED');
    const { count: failedJobs } = await supabaseInstance
        .from('upload_jobs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['FAILED', 'QUOTA_LIMIT']);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const { data: recentJobs } = await supabaseInstance
        .from('upload_jobs')
        .select('scheduled_time')
        .eq('status', 'COMPLETED')
        .gte('scheduled_time', sevenDaysAgo.toISOString());
    
    const activityMap: Record<string, number> = {};
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
        .sort((a,b) => a.date.localeCompare(b.date));

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
  if (error) throw new Error(error.message);
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
  access_token text, 
  refresh_token text,
  token_expires_at timestamptz,
  client_id text,
  client_secret text,
  default_title text,
  default_description text,
  default_tags text[],
  default_folder_path text,
  current_template_id uuid,
  proxy_id uuid references public.proxies(id) on delete set null,
  
  -- UPDATE ANALYTICS FIELDS (Added in recent update)
  total_views bigint default 0,
  video_count int default 0,
  last_stats_sync timestamptz
);
alter table public.channels enable row level security;
drop policy if exists "Enable all" on public.channels;
create policy "Enable all" on public.channels for all using (true) with check (true);

-- MIGRATION: ADD MISSING COLUMNS AUTOMATICALLY IF TABLE EXISTS
DO $$
BEGIN
    -- Check and add 'last_stats_sync'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'last_stats_sync') THEN
        ALTER TABLE public.channels ADD COLUMN last_stats_sync timestamptz;
    END IF;

    -- Check and add 'total_views'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'total_views') THEN
        ALTER TABLE public.channels ADD COLUMN total_views bigint default 0;
    END IF;

    -- Check and add 'video_count'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'video_count') THEN
        ALTER TABLE public.channels ADD COLUMN video_count int default 0;
    END IF;

    -- Check and add 'youtube_id' (Safety fix)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'youtube_id') THEN
        ALTER TABLE public.channels ADD COLUMN youtube_id text;
    END IF;
END $$;

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
  youtube_video_id text,
  ab_test_config jsonb
);
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

-- 8. View: Channel Draft Counts (Optimization)
create or replace view view_channel_draft_counts as
select channel_id, count(*) as count
from public.videos
where status = 'DRAFT'
group by channel_id;
`;
};
