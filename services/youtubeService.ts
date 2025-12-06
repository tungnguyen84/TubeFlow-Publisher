
// Service tương tác với YouTube Data API v3 & Google OAuth
import { VideoMetadata } from '../types';

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

// 1. Lấy thông tin kênh (Dùng API Key - Public)
export const getChannelInfo = async (channelId: string, apiKey: string): Promise<YouTubeChannelInfo | null> => {
  if (!apiKey) throw new Error("Vui lòng nhập YouTube API Key trong Settings trước.");

  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Lỗi kết nối YouTube API");
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const item = data.items[0];
    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      subscriberCount: parseInt(item.statistics.subscriberCount || '0', 10)
    };
  } catch (error) {
    console.error("YouTube API Error:", error);
    throw error;
  }
};

// 2. Tạo URL OAuth (Code Flow - access_type=offline để lấy Refresh Token)
export const getGoogleAuthUrl = (clientId: string, redirectUri: string, stateChannelId: string) => {
    const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
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
    // Phát hiện lỗi Quota
    if (initResponse.status === 403 && err.error?.message?.includes('quota')) {
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
export const getVideoStatistics = async (videoIds: string[], accessToken: string): Promise<YouTubeVideoStats[]> => {
    if (videoIds.length === 0) return [];

    // YouTube API giới hạn 50 ID mỗi request
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
    }

    let allStats: YouTubeVideoStats[] = [];

    for (const chunk of chunks) {
        const ids = chunk.join(',');
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                 console.error("Lỗi lấy stats video:", await response.text());
                 continue; 
            }

            const data = await response.json();
            if (data.items) {
                const mapped = data.items.map((item: any) => ({
                    id: item.id,
                    title: item.snippet.title,
                    publishedAt: item.snippet.publishedAt,
                    thumbnailUrl: item.snippet.thumbnails.default?.url,
                    viewCount: parseInt(item.statistics.viewCount || '0'),
                    likeCount: parseInt(item.statistics.likeCount || '0'),
                    commentCount: parseInt(item.statistics.commentCount || '0')
                }));
                allStats = [...allStats, ...mapped];
            }
        } catch (e) {
            console.error("Fetch stats error:", e);
        }
    }
    
    return allStats;
}
