
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Job, VideoItem, Channel, AppSettings, ScheduleTemplate, DashboardStats, LinkAsset, ChannelGroup, ProxyItem } from '../types';

// FIX CỨNG KẾT NỐI
const SUPABASE_URL = "https://yirtnjaxbtenoqbyfkxe.supabase.co";
const SUPABASE_KEY = "sb_publishable_IoqoydoYYvPowv00SZL5pg_FWoFjV9L";

const supabaseInstance: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export const getSupabase = (): SupabaseClient => {
  return supabaseInstance;
};

// --- GROUPS MANAGEMENT ---
export const fetchChannelGroups = async (): Promise<ChannelGroup[]> => {
    try {
        const { data, error } = await supabaseInstance.from('channel_groups').select('*').order('created_at', { ascending: true });
        if (error) return [];
        return data as ChannelGroup[];
    } catch {
        return [];
    }
}

export const saveChannelGroup = async (group: Partial<ChannelGroup>) => {
    const { error } = await supabaseInstance.from('channel_groups').insert({
        name: group.name,
        description: group.description
    });
    if (error) throw new Error(error.message);
}

export const updateChannelGroup = async (id: string, name: string) => {
    const { error } = await supabaseInstance.from('channel_groups').update({ name }).eq('id', id);
    if (error) throw new Error(error.message);
}

export const deleteChannelGroup = async (id: string) => {
    // Note: Channels in this group will have group_id set to null (if foreign key is set to SET NULL) or we handle logic
    const { error } = await supabaseInstance.from('channel_groups').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

// --- CHANNELS ---
export const fetchChannels = async (groupId?: string): Promise<Channel[]> => {
  // Use !inner join if groupId is provided to filter channels strictly
  let query = supabaseInstance.from('channels').select(`
    *,
    channel_groups (name)
  `).order('created_at', { ascending: false });

  if (groupId) {
      query = query.eq('group_id', groupId);
  }
  
  let { data, error } = await query;
  
  if (error) {
    console.error("Lỗi lấy channels:", error.message || error);
    return [];
  }
  
  return (data || []).map((row: any) => {
    let groupName = undefined;
    if (row.channel_groups) {
        const g = Array.isArray(row.channel_groups) ? row.channel_groups[0] : row.channel_groups;
        if (g) groupName = g.name;
    }

    return {
        id: row.id,
        name: row.name,
        avatarUrl: row.avatar_url || 'https://ui-avatars.com/api/?name=' + row.name,
        subscriberCount: row.subscriber_count,
        groupId: row.group_id,
        groupName: groupName,
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
        currentTemplateId: row.current_template_id
    };
  });
};

export const addChannel = async (channel: Partial<Channel>) => {
  if (!channel.youtubeId) {
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
    group_id: channel.groupId // Save Group
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
    if (config.groupId !== undefined) updateData.group_id = config.groupId;

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

export const updateChannelStats = async (id: string, stats: { subscriberCount?: number, totalViews?: number, videoCount?: number }) => {
    const updateData: any = {
        last_stats_sync: new Date().toISOString()
    };
    if (stats.subscriberCount !== undefined) updateData.subscriber_count = stats.subscriberCount;
    if (stats.totalViews !== undefined) updateData.total_views = stats.totalViews;
    if (stats.videoCount !== undefined) updateData.video_count = stats.videoCount;

    const { error } = await supabaseInstance.from('channels').update(updateData).eq('id', id);
    if (error) {
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
export const fetchDraftCounts = async (): Promise<Record<string, number>> => {
    try {
        const { data, error } = await supabaseInstance.from('view_channel_draft_counts').select('*');
        if (!error && data) {
            const counts: Record<string, number> = {};
            data.forEach((row: any) => {
                counts[row.channel_id] = row.count;
            });
            return counts;
        }
    } catch (e) {}

    // Fallback: Nếu view chưa có, dùng query thường
    const counts: Record<string, number> = {};
    const { data } = await supabaseInstance.from('videos').select('channel_id').eq('status', 'DRAFT');
    if (data) {
        data.forEach((row: any) => {
            if (row.channel_id) counts[row.channel_id] = (counts[row.channel_id] || 0) + 1;
        });
    }
    return counts;
};

export const fetchVideos = async (
    filters: { channelId?: string, status?: string, folder?: string, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc', isOrphan?: boolean, groupId?: string } = {}
): Promise<VideoItem[]> => {
  // If groupId is present, we need to filter videos belonging to channels in that group
  // This requires a join on channels
  let query = supabaseInstance
    .from('videos')
    .select(`*, channels!inner(name, group_id)`);

  const sortCol = filters.sortBy || 'created_at';
  const sortAsc = filters.sortOrder === 'asc';
  query = query.order(sortCol, { ascending: sortAsc });

  if (filters.isOrphan) {
      query = query.is('channel_id', null);
  } else if (filters.channelId) {
      query = query.eq('channel_id', filters.channelId);
  }

  // GLOBAL FILTER: Filter by Group
  if (filters.groupId) {
      // Because of !inner, this will filter videos where channel's group_id matches
      query = query.eq('channels.group_id', filters.groupId);
  } else {
      // If no group filter, switch to left join to include orphans or all channels
      // Re-build query to be safe or just use standard select if no inner filter needed
      // Actually !inner is only needed for filtering. 
      if (!filters.groupId) {
          query = supabaseInstance.from('videos').select(`*, channels(name, group_id)`).order(sortCol, { ascending: sortAsc });
          if (filters.isOrphan) query = query.is('channel_id', null);
          else if (filters.channelId) query = query.eq('channel_id', filters.channelId);
      }
  }

  if (filters.status) {
      query = query.eq('status', filters.status);
  }
  if (filters.folder) {
      query = query.ilike('file_path', `%${filters.folder}%`);
  }
  
  if (filters.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  
  return mapVideoData(data || []);
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
                title_template: '', 
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
        scheduledTime: row.scheduled_time, 
        retries: row.retries || 0,
        errorMessage: row.error_log,
        accessToken: row.channels?.access_token, 
        refreshToken: row.channels?.refresh_token
    }));
}

export const fetchJobs = async (daysLimit: number = 3, channelId: string | null = null, status: string | null = null, groupId: string | null = null): Promise<Job[]> => {
  const now = new Date();
  let isoStartDate, isoEndDate;

  if (daysLimit === 0) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      isoStartDate = start.toISOString();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      isoEndDate = end.toISOString();
  } else {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysLimit);
      isoStartDate = startDate.toISOString();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + daysLimit);
      isoEndDate = endDate.toISOString();
  }

  // !!! CRITICAL: Use inner join on channels to filter by Group ID if provided
  let query = supabaseInstance
    .from('upload_jobs')
    .select(`
      id, video_id, channel_id, status, scheduled_time, retries, error_log, created_at,
      videos (filename, file_path, title_template, desc_template, tags),
      channels!inner (name, access_token, refresh_token, token_expires_at, client_id, client_secret, default_title, default_description, default_tags, default_folder_path, group_id)
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

  // GLOBAL FILTER
  if (groupId) {
      query = query.eq('channels.group_id', groupId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  
  return data.map((row: any) => ({
    id: row.id,
    videoId: row.video_id,
    channelId: row.channel_id,
    videoFilename: row.videos?.filename, 
    videoFilePath: row.videos?.file_path,
    videoTitle: row.videos?.title_template || 'Video đã xóa',
    channelName: row.channels?.name || 'Kênh đã xóa',
    status: row.status,
    progress: row.status === 'COMPLETED' ? 100 : 0,
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
        defaultFolderPath: row.channels?.default_folder_path 
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

export const clearAllQueuedJobs = async (channelId?: string, status?: string): Promise<number | null> => {
    let query = supabaseInstance.from('upload_jobs').delete({ count: 'exact' });
    
    if (channelId) {
        query = query.eq('channel_id', channelId);
    }

    if (status) {
        query = query.eq('status', status);
    }
    
    if (!channelId && !status) {
         query = query.not('id', 'is', null);
    }

    const { error, count } = await query;
    if (error) throw new Error(error.message || "Lỗi không xác định khi xóa Queue");
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
export const fetchDashboardStats = async (
    startDate?: string, 
    endDate?: string, 
    channelId?: string,
    groupId?: string
): Promise<DashboardStats> => {
    
    const start = new Date();
    const end = new Date();

    if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        start.setFullYear(y, m - 1, d);
        start.setHours(0, 0, 0, 0);
    } else {
        start.setHours(0, 0, 0, 0);
    }

    if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        end.setFullYear(y, m - 1, d);
        end.setHours(23, 59, 59, 999);
    } else {
        end.setHours(23, 59, 59, 999);
    }
    
    const isoStart = start.toISOString();
    const isoEnd = end.toISOString();

    const buildQuery = (statusFilter?: string | string[]) => {
        let q = supabaseInstance.from('upload_jobs')
            .select('channel_id, status, error_log, scheduled_time, channels!inner(name, group_id)')
            .gte('scheduled_time', isoStart)
            .lte('scheduled_time', isoEnd);
        
        if (channelId) {
            q = q.eq('channel_id', channelId);
        }
        
        if (groupId) {
            q = q.eq('channels.group_id', groupId);
        }
        
        if (statusFilter) {
            if (Array.isArray(statusFilter)) {
                q = q.in('status', statusFilter);
            } else {
                q = q.eq('status', statusFilter);
            }
        }
        return q;
    };

    const [
        { count: totalChannels }, 
        { data: completedJobs }, 
        { data: queuedJobs }, 
        { data: failedJobs } 
    ] = await Promise.all([
        (() => {
            let q = supabaseInstance.from('channels').select('*', { count: 'exact', head: true });
            if (groupId) q = q.eq('group_id', groupId);
            return q;
        })(),
        buildQuery('COMPLETED'),
        (() => {
            let q = supabaseInstance.from('upload_jobs').select('*', { count: 'exact', head: true }).eq('status', 'QUEUED');
            if (channelId) q = q.eq('channel_id', channelId);
            // We need manual join check for count with group filter
            if (groupId) {
                 q = supabaseInstance.from('upload_jobs')
                    .select('channels!inner(group_id)', { count: 'exact', head: true })
                    .eq('status', 'QUEUED')
                    .eq('channels.group_id', groupId);
            }
            return q;
        })(),
        buildQuery(['FAILED', 'QUOTA_LIMIT'])
    ]);

    const activeChannelIds = new Set<string>();
    completedJobs?.forEach((j: any) => activeChannelIds.add(j.channel_id));
    failedJobs?.forEach((j: any) => activeChannelIds.add(j.channel_id));

    const activityMap: Record<string, number> = {};
    const loopDate = new Date(start);
    let safeGuard = 0;
    while (loopDate <= end && safeGuard < 365) {
        activityMap[loopDate.toISOString().split('T')[0]] = 0;
        loopDate.setDate(loopDate.getDate() + 1);
        safeGuard++;
    }
    
    completedJobs?.forEach((job: any) => {
        const dateStr = new Date(job.scheduled_time).toISOString().split('T')[0];
        if (activityMap[dateStr] !== undefined) activityMap[dateStr]++;
    });
    
    const recentActivity = Object.entries(activityMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a,b) => a.date.localeCompare(b.date));

    const errorMap: Record<string, {count: number, details: string[]}> = {};
    
    failedJobs?.forEach((job: any) => {
        let type = "Unknown Error";
        let detail = job.error_log || "No details";

        if (job.status === 'QUOTA_LIMIT') {
            type = "Quota Limit Exceeded";
        } else {
            const lowerLog = detail.toLowerCase();
            if (lowerLog.includes("token")) type = "Authentication / Token Error";
            else if (lowerLog.includes("network") || lowerLog.includes("fetch")) type = "Network / Connection Error";
            else if (lowerLog.includes("processing")) type = "Video Processing Error";
            else if (lowerLog.includes("upload")) type = "Upload API Error";
            else type = "Other Errors";
        }

        if (!errorMap[type]) {
            errorMap[type] = { count: 0, details: [] };
        }
        errorMap[type].count++;
        if (errorMap[type].details.length < 5 && !errorMap[type].details.includes(detail)) {
            errorMap[type].details.push(detail);
        }
    });

    const errorBreakdown = Object.entries(errorMap).map(([type, data]) => ({
        type,
        count: data.count,
        details: data.details
    })).sort((a,b) => b.count - a.count);

    return {
        totalChannels: totalChannels || 0,
        uploadsInPeriod: completedJobs?.length || 0,
        queuedJobs: queuedJobs?.count || 0, 
        failedInPeriod: failedJobs?.length || 0,
        activeChannelsInPeriod: activeChannelIds.size,
        recentActivity,
        errorBreakdown
    };
}

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

// --- LINK MANAGER FUNCTIONS ---
export const fetchLinkAssets = async (): Promise<LinkAsset[]> => {
    try {
        const { data, error } = await supabaseInstance.from('link_assets').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data as LinkAsset[];
    } catch {
        return [];
    }
}

export const saveLinkAsset = async (link: {name: string, url: string, description?: string}) => {
    const { error } = await supabaseInstance.from('link_assets').insert(link);
    if(error) throw new Error(error.message);
}

export const deleteLinkAsset = async (id: string) => {
    await supabaseInstance.from('link_assets').delete().eq('id', id);
}

// --- PROXY MANAGEMENT ---
export const fetchProxies = async (): Promise<ProxyItem[]> => {
    try {
        const { data, error } = await supabaseInstance.from('proxies').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data as ProxyItem[];
    } catch {
        return [];
    }
}

export const saveProxy = async (proxy: Partial<ProxyItem>) => {
    const { error } = await supabaseInstance.from('proxies').insert({
        ip: proxy.ip,
        port: proxy.port,
        protocol: proxy.protocol,
        username: proxy.username,
        password: proxy.password,
        location: proxy.location,
        status: 'ACTIVE'
    });
    if (error) throw new Error(error.message);
}

export const deleteProxy = async (id: string) => {
    const { error } = await supabaseInstance.from('proxies').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

export const generateSchemaSQL = (): string => {
  return `
-- 10. Table: Channel Groups (NEW)
create table if not exists public.channel_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_at timestamptz default now()
);
alter table public.channel_groups enable row level security;
drop policy if exists "Enable all" on public.channel_groups;
create policy "Enable all" on public.channel_groups for all using (true) with check (true);

-- ADD COLUMN to channels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'group_id') THEN
        ALTER TABLE public.channels ADD COLUMN group_id uuid references public.channel_groups(id) on delete set null;
    END IF;
END $$;

-- 11. Table: Proxies (NEW)
create table if not exists public.proxies (
  id uuid primary key default uuid_generate_v4(),
  ip text not null,
  port int not null,
  protocol text not null,
  username text,
  password text,
  location text,
  status text default 'ACTIVE',
  created_at timestamptz default now()
);
alter table public.proxies enable row level security;
drop policy if exists "Enable all" on public.proxies;
create policy "Enable all" on public.proxies for all using (true) with check (true);
`;
};
