import React, { useState, useEffect } from 'react';
import { Channel, ChannelStatus } from '../types';
import { RefreshCw, Trash2, Youtube, ExternalLink, Plus, Search, Loader2, Lock, Unlock, LogIn } from 'lucide-react';
import { fetchChannels, addChannel, deleteChannel, updateChannelCredentials, fetchSystemSettings } from '../services/supabaseService';
import { getChannelInfo, getGoogleAuthUrl, YouTubeChannelInfo } from '../services/youtubeService';

const ChannelManager: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Auth state (chỉ dùng để force render, giờ logic chính dựa vào channels.accessToken)
  const [authTrigger, setAuthTrigger] = useState(0);

  // Form state
  const [channelIdInput, setChannelIdInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  
  // Real Info State
  const [isChecking, setIsChecking] = useState(false);
  const [foundChannel, setFoundChannel] = useState<YouTubeChannelInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadChannels = async () => {
    setIsLoading(true);
    const data = await fetchChannels();
    setChannels(data);
    setIsLoading(false);
  };

  useEffect(() => {
    // 1. Load data ban đầu
    loadChannels();

    // 2. KIỂM TRA REDIRECT CALLBACK & SAVE TO DB
    const handleAuthCallback = async () => {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const expiresIn = params.get('expires_in') ? parseInt(params.get('expires_in')!) : 3599;
            const stateChannelId = params.get('state');

            if (accessToken && stateChannelId) {
                try {
                    // LƯU TOKEN VÀO DB SUPABASE
                    setIsLoading(true);
                    await updateChannelCredentials(stateChannelId, accessToken, expiresIn);
                    
                    // Xóa hash để URL sạch đẹp
                    window.history.replaceState(null, '', window.location.pathname);
                    
                    alert("Kết nối thành công! Token đã được lưu vào Database.");
                    
                    // Reload lại để UI cập nhật từ DB
                    await loadChannels();
                } catch (e) {
                    alert("Lỗi khi lưu Token vào Database: " + e);
                } finally {
                    setIsLoading(false);
                }
            }
        }
    };

    handleAuthCallback();
  }, []);

  const handleCheckChannel = async () => {
    if (!channelIdInput) return;
    setIsChecking(true);
    setErrorMsg('');
    setFoundChannel(null);

    // THAY ĐỔI: Ưu tiên lấy từ DB, fallback về localStorage
    let apiKey = '';
    try {
        const dbSettings = await fetchSystemSettings();
        apiKey = dbSettings.youtubeApiKey;
    } catch (e) {
        console.warn("Không load được key từ DB", e);
    }

    // Nếu DB chưa có (hoặc lỗi), thử lấy ở localStorage
    if (!apiKey) {
         const settings = localStorage.getItem('tubeflow_settings');
         apiKey = settings ? JSON.parse(settings).youtubeApiKey : '';
    }

    if (!apiKey) {
      setErrorMsg("Chưa có YouTube API Key trong Database. Vui lòng vào Cài đặt để thêm và LƯU.");
      setIsChecking(false);
      return;
    }

    try {
      const info = await getChannelInfo(channelIdInput, apiKey);
      if (info) {
        setFoundChannel(info);
      } else {
        setErrorMsg("Không tìm thấy kênh với ID này.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi gọi YouTube API.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveChannel = async () => {
    if (!foundChannel) return;
    try {
      setIsLoading(true);
      await addChannel({
        youtube_id: foundChannel.id,
        name: foundChannel.title,
        avatarUrl: foundChannel.thumbnailUrl,
        subscriberCount: foundChannel.subscriberCount,
        tags: tagsInput.split(',').map(t => t.trim()).filter(t => t),
        status: ChannelStatus.ACTIVE,
      } as any);
      setShowAddModal(false);
      setChannelIdInput('');
      setTagsInput('');
      setFoundChannel(null);
      loadChannels();
    } catch (error) {
      alert("Lỗi lưu kênh vào Database: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa kênh này khỏi hệ thống?")) {
      await deleteChannel(id);
      loadChannels();
    }
  };

  // Xử lý nút cấp quyền Upload (REDIRECT MODE ONLY)
  const handleAuthorize = async (channelId: string) => {
    // THAY ĐỔI: Lấy Client ID từ DB
    let clientId = '';
    try {
        const dbSettings = await fetchSystemSettings();
        clientId = dbSettings.googleClientId;
    } catch (e) { console.warn(e); }

    if (!clientId) {
        const settings = localStorage.getItem('tubeflow_settings');
        clientId = settings ? JSON.parse(settings).googleClientId : '';
    }

    if (!clientId) {
      alert("Vui lòng nhập Google OAuth Client ID trong Cài đặt và LƯU lại trước!");
      return;
    }

    // FIX: Xử lý URL chuẩn, bỏ dấu '/' ở cuối nếu có để khớp với Google Console
    let currentUrl = window.location.origin + window.location.pathname;
    if (currentUrl.endsWith('/')) {
        currentUrl = currentUrl.slice(0, -1);
    }

    const authUrl = getGoogleAuthUrl(clientId, currentUrl, channelId);
    window.location.href = authUrl;
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý Kênh</h2>
          <p className="text-gray-400 text-sm mt-1">Kết nối và đồng bộ dữ liệu thực từ YouTube</p>
        </div>
        <div className="flex gap-2">
            <button onClick={loadChannels} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition">
                 <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
            onClick={() => setShowAddModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition"
            >
            <Plus className="w-5 h-5" />
            Thêm Kênh
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map(channel => {
          // Kiểm tra xem token còn hạn không
          const now = Date.now();
          const hasValidToken = channel.accessToken && channel.tokenExpiresAt && channel.tokenExpiresAt > now;
          
          return (
            <div key={channel.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden relative group hover:border-gray-500 transition">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img src={channel.avatarUrl} alt={channel.name} className="w-12 h-12 rounded-full border-2 border-gray-600 object-cover" />
                    <div>
                      <h3 className="font-semibold text-white truncate max-w-[140px]" title={channel.name}>{channel.name}</h3>
                      <p className="text-xs text-gray-400">{channel.subscriberCount.toLocaleString()} Subs</p>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                    ${channel.status === ChannelStatus.ACTIVE ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>
                    {channel.status}
                  </div>
                </div>

                {/* Authorization Status */}
                <div className="mt-4 p-3 bg-gray-900/50 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-gray-400">Trạng thái Upload:</span>
                  {hasValidToken ? (
                     <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
                            <Unlock className="w-3 h-3" />
                            Đã kết nối
                        </div>
                        <span className="text-[10px] text-gray-500">
                             Hết hạn: {Math.floor((channel.tokenExpiresAt! - now) / 60000)} phút
                        </span>
                     </div>
                  ) : (
                    <button 
                      onClick={() => handleAuthorize(channel.id)}
                      className="flex items-center gap-1 text-white hover:text-blue-200 text-xs font-medium bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition shadow-lg shadow-blue-900/20"
                    >
                      <LogIn className="w-3 h-3" />
                      Kết nối (1h)
                    </button>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {channel.tags.map(tag => (
                    <span key={tag} className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded">#{tag}</span>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800/50 border-t border-gray-700 p-3 flex justify-between items-center">
                <span className="text-xs text-gray-500">Sync: {channel.lastSync}</span>
                <div className="flex gap-2">
                  <a href={`https://youtube.com/channel/${channel.youtubeId}`} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Mở YouTube">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button onClick={() => handleDelete(channel.id)} className="p-1.5 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400" title="Xóa Kênh">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Youtube className="w-6 h-6 text-red-500" />
              Kết nối Kênh YouTube
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Channel ID</label>
                <div className="flex gap-2">
                  <input 
                    value={channelIdInput}
                    onChange={e => setChannelIdInput(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-red-500 outline-none"
                    placeholder="UC..."
                  />
                  <button onClick={handleCheckChannel} disabled={isChecking || !channelIdInput} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded transition disabled:opacity-50">
                    {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  </button>
                </div>
                {errorMsg && <p className="text-red-400 text-xs mt-1">{errorMsg}</p>}
              </div>

              {foundChannel && (
                <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg flex items-center gap-3">
                  <img src={foundChannel.thumbnailUrl} className="w-12 h-12 rounded-full" alt="Avatar" />
                  <div>
                    <h4 className="font-bold text-white text-sm">{foundChannel.title}</h4>
                    <p className="text-xs text-gray-400">{foundChannel.subscriberCount.toLocaleString()} người đăng ký</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-300 mb-1">Tags phân loại</label>
                <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white outline-none" placeholder="music, vlog..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => {setShowAddModal(false); setFoundChannel(null);}} className="px-4 py-2 text-gray-400 hover:text-white">Hủy</button>
              <button onClick={handleSaveChannel} disabled={!foundChannel} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:opacity-50 disabled:bg-gray-700">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelManager;