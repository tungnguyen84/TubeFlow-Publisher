
// Service tương tác với YouTube Data API v3 & Google OAuth
import { VideoMetadata, YouTubeVideoStats, UnifiedComment, CompetitorVideo } from '../types';

declare global {
  interface Window {
    google: any;
  }
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  // Stats additions
  totalViews?: number;
  videoCount?: number;
}

// 1. Lấy thông tin kênh (Dùng API Key - Public)
// SUPPORT: Channel ID (UC...) OR Handle (@...)
export const getChannelInfo = async (input: string, apiKey: string): Promise<YouTubeChannelInfo | null> => {
  if (!apiKey) throw new Error("Vui lòng nhập YouTube API Key trong Settings trước.");

  // Auto-detect Handle
  const isHandle = input.trim().startsWith('@');
  const param = isHandle ? `forHandle=${encodeURIComponent(input.trim())}` : `id=${encodeURIComponent(input.trim())}`;

  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${param}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Lỗi kết nối YouTube API (Check Info)");
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
        return null;
    }

    const item = data.items[0];
    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      subscriberCount: parseInt(item.statistics.subscriberCount || '0', 10),
      totalViews: parseInt(item.statistics.viewCount || '0', 10),
      videoCount: parseInt(item.statistics.videoCount || '0', 10)
    };
  } catch (error) {
    console.error("YouTube API Error:", error);
    throw error;
  }
};

// NEW: Get Videos from Channel (via Uploads Playlist)
// Return list of videos with basic stats
// UPDATE: Fetch ALL videos using pagination
export const getChannelVideos = async (channelIdInput: string, accessToken: string | null, apiKey: string): Promise<YouTubeVideoStats[]> => {
    // 1. Get Uploads Playlist ID
    // Support Handle fallback if DB has wrong ID format
    const isHandle = channelIdInput.trim().startsWith('@');
    const param = isHandle ? `forHandle=${encodeURIComponent(channelIdInput.trim())}` : `id=${encodeURIComponent(channelIdInput.trim())}`;
    
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${param}&key=${apiKey}`;
    const chRes = await fetch(channelUrl);
    
    if(!chRes.ok) {
        const err = await chRes.json();
        throw new Error(`Lỗi lấy Playlist: ${err.error?.message || chRes.statusText}`);
    }
    
    const chData = await chRes.json();
    if (!chData.items || chData.items.length === 0) {
        throw new Error(`Không tìm thấy kênh trên YouTube. (ID/Handle đang kiểm tra: "${channelIdInput}"). Hãy vào Quản lý kênh để cập nhật lại ID chuẩn (UC...).`);
    }

    const uploadsPlaylistId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return [];

    // 2. Get Video IDs from Playlist (Pagination Loop)
    let videoIds: string[] = [];
    let nextPageToken: string | undefined = '';
    const MAX_VIDEOS_SAFETY_LIMIT = 2000; // Limit to prevent browser crash / excessive quota usage
    
    do {
        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${nextPageToken || ''}&key=${apiKey}`;
        const plRes = await fetch(playlistUrl);
        
        if (!plRes.ok) {
            // If error happens mid-stream (e.g. quota), break and return what we have
            if (videoIds.length > 0) break; 
            const err = await plRes.json();
            throw new Error(`Lỗi lấy danh sách Video: ${err.error?.message}`);
        }
        
        const plData = await plRes.json();
        if (!plData.items || plData.items.length === 0) break;

        const ids = plData.items.map((item: any) => item.contentDetails.videoId);
        videoIds = [...videoIds, ...ids];
        
        nextPageToken = plData.nextPageToken;

        // Safety Break
        if (videoIds.length >= MAX_VIDEOS_SAFETY_LIMIT) {
            console.warn(`Đã đạt giới hạn an toàn ${MAX_VIDEOS_SAFETY_LIMIT} video. Dừng fetch.`);
            break;
        }

    } while (nextPageToken);

    // 3. Get Stats for these videos
    return await getVideoStatistics(videoIds, accessToken, apiKey);
}

// 2. Tạo URL OAuth (Code Flow - access_type=offline để lấy Refresh Token)
export const getGoogleAuthUrl = (clientId: string, redirectUri: string, stateChannelId: string) => {
    // UPDATED SCOPE: Added 'https://www.googleapis.com/auth/youtube' (Full Access)
    // This ensures we have permission for Comments, Captions, Community Posts, etc.
    const scope = 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl';
    
    // access_type=offline & prompt=consent là bắt buộc để lấy refresh_token
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${stateChannelId}&access_type=offline&prompt=consent&include_granted_scopes=true`;
};

// 3. Đổi Code lấy AccessToken + RefreshToken
export const exchangeCodeForToken = async (code: string, clientId: string, clientSecret: string, redirectUri: string) => {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error_description || "Lỗi đổi Code lấy Token");
    }

    return await response.json(); // trả về { access_token, refresh_token, expires_in, ... }
};

// 4. Refresh Access Token (Khi token hết hạn)
export const refreshAccessToken = async (refreshToken: string, clientId: string, clientSecret: string) => {
    const params = new URLSearchParams();
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    if (!response.ok) {
        throw new Error("Không thể refresh token (Có thể quyền đã bị thu hồi).");
    }

    return await response.json(); // trả về { access_token, expires_in, ... }
};


// 5. Upload Video (Dùng Access Token)
export const uploadVideoToYouTube = async (
  accessToken: string,
  file: File, 
  metadata: VideoMetadata
) => {
  const metadataContent = {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: "22",
    },
    status: {
      privacyStatus: metadata.visibility 
    }
  };

  // Step 1: Init Upload
  const initResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Length': file.size.toString(),
      'X-Upload-Content-Type': file.type
    },
    body: JSON.stringify(metadataContent)
  });

  if (!initResponse.ok) {
    const err = await initResponse.json();
    const errorMsg = err.error?.message || "";
    // Phát hiện lỗi Quota
    if (initResponse.status === 403 && (errorMsg.includes('quota') || errorMsg.includes('exceeded the number of videos'))) {
        throw new Error("QUOTA_EXCEEDED");
    }
    throw new Error(`Lỗi khởi tạo upload: ${err.error?.message || initResponse.statusText}`);
  }

  const uploadUrl = initResponse.headers.get('location');
  if (!uploadUrl) throw new Error("Không lấy được Upload URL từ YouTube.");

  // Step 2: Upload Binary
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type
    },
    body: file
  });

  if (!uploadResponse.ok) {
     const err = await uploadResponse.json();
     if (uploadResponse.status === 403) throw new Error("QUOTA_EXCEEDED");
     throw new Error(`Lỗi đẩy file: ${err.error?.message || uploadResponse.statusText}`);
  }

  return await uploadResponse.json(); 
};

// 6. Lấy thống kê video (Views, Likes, Comments) - Analytics
export const getVideoStatistics = async (videoIds: string[], accessToken: string | null, apiKey?: string): Promise<YouTubeVideoStats[]> => {
    if (videoIds.length === 0) return [];

    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
    }

    let allStats: YouTubeVideoStats[] = [];

    for (const chunk of chunks) {
        const ids = chunk.join(',');
        
        let success = false;
        
        // 1. Try with Access Token if available
        if (accessToken) {
             try {
                const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}`;
                const response = await fetch(url, { 
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (response.ok) {
                     const data = await response.json();
                     if (data.items) {
                        allStats = [...allStats, ...mapStats(data.items)];
                     }
                     success = true;
                }
             } catch(e) { console.error(e); }
        }

        // 2. Fallback to API Key if Token failed or not provided
        if (!success && apiKey) {
             try {
                const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}&key=${apiKey}`;
                const response = await fetch(url);
                if (response.ok) {
                     const data = await response.json();
                     if (data.items) {
                        allStats = [...allStats, ...mapStats(data.items)];
                     }
                } else {
                     const err = await response.json();
                     throw new Error(`Lỗi lấy Stats Video: ${err.error?.message || response.statusText}`);
                }
             } catch(e) { throw e; }
        }
    }
    
    return allStats;
}

const mapStats = (items: any[]): YouTubeVideoStats[] => {
    return items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.default?.url,
        viewCount: parseInt(item.statistics.viewCount || '0'),
        likeCount: parseInt(item.statistics.likeCount || '0'),
        commentCount: parseInt(item.statistics.commentCount || '0')
    }));
}

// --- NEW ADVANCED FEATURES API ---

// 7. Fetch Recent Comments (Unified)
export const fetchRecentComments = async (accessToken: string, channelId: string, maxResultsToScan: number = 500): Promise<UnifiedComment[]> => {
    // UPDATED: Scan up to 500 items (5 pages)
    
    if (!channelId) throw new Error("Missing Channel ID for comments fetch");
    
    let allItems: any[] = [];
    let nextPageToken: string | undefined = '';
    let fetchedCount = 0;
    
    // Loop to fetch multiple pages (YouTube max per page is 100)
    do {
        const fetchSize = Math.min(100, maxResultsToScan - fetchedCount);
        if (fetchSize <= 0) break;

        const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${channelId}&maxResults=100&order=time&textFormat=plainText&pageToken=${nextPageToken || ''}`;
        
        const response = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const err = await response.json();
            // If we already have some items, return them instead of failing completely (partial success)
            if (allItems.length > 0) break; 
            throw new Error(err.error?.message || `YouTube API Error ${response.status}`);
        }

        const data = await response.json();
        const items = data.items || [];
        allItems = [...allItems, ...items];
        fetchedCount += items.length;
        nextPageToken = data.nextPageToken;

        // Safety break
        if (fetchedCount >= maxResultsToScan) break;

    } while (nextPageToken);

    return allItems.map((item: any) => {
        const top = item.snippet.topLevelComment.snippet;
        const videoId = item.snippet.videoId;
        const totalReplyCount = item.snippet.totalReplyCount || 0;
        
        // Map replies if exist
        const replies = item.replies?.comments?.map((r: any) => ({
            id: r.id,
            authorDisplayName: r.snippet.authorDisplayName,
            authorProfileImageUrl: r.snippet.authorProfileImageUrl,
            authorChannelId: r.snippet.authorChannelId?.value, // IMPORTANT: To check if OWNER replied
            textDisplay: r.snippet.textDisplay,
            publishedAt: r.snippet.publishedAt
        })) || [];

        return {
            id: item.id,
            authorDisplayName: top.authorDisplayName,
            authorProfileImageUrl: top.authorProfileImageUrl,
            textDisplay: top.textDisplay,
            publishedAt: top.publishedAt,
            videoTitle: videoId ? `Video ID: ${videoId}` : 'Community/Channel',
            channelId: item.snippet.channelId, // This is the Channel ID of the VIDEO OWNER (You)
            channelName: '', 
            canReply: item.snippet.canReply,
            replies: replies.sort((a: any, b: any) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()),
            totalReplyCount: totalReplyCount 
        };
    });
}

// 8. Reply to Comment
export const replyToComment = async (accessToken: string, parentId: string, text: string) => {
    const payload = {
        snippet: {
            parentId: parentId,
            textOriginal: text
        }
    };
    
    const response = await fetch(`https://www.googleapis.com/youtube/v3/comments?part=snippet`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    if(!response.ok) throw new Error("Failed to reply");
    return await response.json();
}

// 9. Fetch Competitor Videos (Public)
export const fetchCompetitorVideos = async (channelId: string, apiKey: string): Promise<CompetitorVideo[]> => {
    // Reuse logic: Get Uploads Playlist -> Get Videos
    const videos = await getChannelVideos(channelId, null, apiKey);
    
    const now = new Date();
    return videos.map(v => {
        const pub = new Date(v.publishedAt);
        const diffTime = Math.abs(now.getTime() - pub.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        return {
            id: v.id,
            title: v.title,
            publishedAt: v.publishedAt,
            thumbnailUrl: v.thumbnailUrl,
            viewCount: v.viewCount,
            channelTitle: '', // Not needed for internal logic
            daysAgo: diffDays,
            velocity: diffDays > 0 ? Math.floor(v.viewCount / diffDays) : v.viewCount
        };
    });
}
