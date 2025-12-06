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

// 2. Xin quyền OAuth (Implicit Flow) - Chạy ở Client Side (Popup Mode)
export const requestGoogleAuth = (clientId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error("Google Script chưa load. Hãy refresh trang."));
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      callback: (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          resolve(tokenResponse.access_token);
        } else {
          reject(new Error("Không lấy được Token."));
        }
      },
      error_callback: (err: any) => {
          reject(err);
      }
    });

    client.requestAccessToken();
  });
};

// 2.1 Tạo URL OAuth (Implicit Flow) - Chạy ở Client Side (Redirect Mode - Fallback)
// Dùng khi Popup bị chặn bởi môi trường Cloud/Iframe
export const getGoogleAuthUrl = (clientId: string, redirectUri: string, stateChannelId: string) => {
    const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
    // Xây dựng URL chuẩn của Google OAuth 2.0
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&state=${stateChannelId}&include_granted_scopes=true`;
};

// 3. Upload Video (Dùng Access Token - Private)
export const uploadVideoToYouTube = async (
  accessToken: string,
  file: File, // Bắt buộc phải có File object thật từ <input type="file">
  metadata: VideoMetadata
) => {
  // Upload Resumable Protocol của Google
  const metadataContent = {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: "22", // People & Blogs default
    },
    status: {
      privacyStatus: metadata.visibility // public, private, unlisted
    }
  };

  // Step 1: Init Upload để lấy Upload URL
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
    throw new Error(`Lỗi khởi tạo upload: ${err.error?.message || initResponse.statusText}`);
  }

  const uploadUrl = initResponse.headers.get('location');
  if (!uploadUrl) throw new Error("Không lấy được Upload URL từ YouTube.");

  // Step 2: Upload Binary File
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type
    },
    body: file
  });

  if (!uploadResponse.ok) {
     throw new Error("Lỗi trong quá trình đẩy file lên YouTube.");
  }

  return await uploadResponse.json(); // Trả về thông tin video đã upload
};