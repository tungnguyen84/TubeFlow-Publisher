
import React, { useState, useEffect } from 'react';
import { Channel, ChannelStatus } from '../types';
import { RefreshCw, Trash2, Youtube, ExternalLink, Plus, Search, Loader2, Lock, Unlock, LogIn, Settings as SettingsIcon, Save, Edit } from 'lucide-react';
import { fetchChannels, addChannel, deleteChannel, updateChannelCredentials, fetchSystemSettings, updateChannelConfig } from '../services/supabaseService';
import { getChannelInfo, getGoogleAuthUrl, exchangeCodeForToken, YouTubeChannelInfo } from '../services/youtubeService';

const ChannelManager: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // State for Edit Mode
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // Form State
  const [channelIdInput, setChannelIdInput] = useState('');
  
  // Custom Settings for Channel
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');
  
  // Default Metadata
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultDescription, setDefaultDescription] = useState('');
  const [defaultTags, setDefaultTags] = useState('');

  // Info Check
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
    loadChannels();

    // HANDLE AUTH CODE CALLBACK
    const handleAuthCallback = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const stateChannelId = urlParams.get('state');

        if (code && stateChannelId) {
            try {
                setIsLoading(true);
                // 1. Tìm channel trong danh sách (hoặc fetch lại từ DB để lấy Client Secret)
                const currentChannels = await fetchChannels();
                const targetChannel = currentChannels.find(c => c.id === stateChannelId);
                const systemSettings = await fetchSystemSettings();

                // Xác định credentials để exchange code
                const clientIdToUse = targetChannel?.clientId || systemSettings.googleClientId;
                const clientSecretToUse = targetChannel?.clientSecret || ''; 
                
                if (!clientSecretToUse && targetChannel?.clientId) {
                    alert("Cảnh báo: Không tìm thấy Client Secret. Hãy chắc chắn bạn đã nhập Client Secret cho kênh này (hoặc cấu hình hệ thống).");
                }

                let redirectUri = window.location.origin + window.location.pathname;
                if (redirectUri.endsWith('/')) redirectUri = redirectUri.slice(0, -1);

                // 2. Exchange Code -> Tokens
                const tokenData = await exchangeCodeForToken(code, clientIdToUse!, clientSecretToUse!, redirectUri);
                
                // 3. Update DB
                await updateChannelCredentials(stateChannelId, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);

                // 4. Clean URL
                window.history.replaceState(null, '', window.location.pathname);
                alert("Kết nối thành công! Refresh Token đã được lưu.");
                loadChannels();

            } catch (e: any) {
                alert("Lỗi kết nối OAuth: " + e.message);
            } finally {
                setIsLoading(false);
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

    let apiKey = '';
    const dbSettings = await fetchSystemSettings();
    apiKey = dbSettings.youtubeApiKey;

    if (!apiKey) {
      setErrorMsg("Chưa có YouTube API Key. Vào Settings kiểm tra.");
      setIsChecking(false);
      return;
    }

    try {
      const info = await getChannelInfo(channelIdInput, apiKey);
      if (info) setFoundChannel(info);
      else setErrorMsg("Không tìm thấy ID kênh.");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsChecking(false);
    }
  };

  const handleOpenEdit = (channel: Channel) => {
      setEditingChannel(channel);
      // Pre-fill form
      setCustomClientId(channel.clientId || '');
      setCustomClientSecret(channel.clientSecret || '');
      setDefaultTitle(channel.defaultTitle || '');
      setDefaultDescription(channel.defaultDescription || '');
      setDefaultTags(channel.defaultTags?.join(', ') || '');
      
      // Fake foundChannel info for visual
      setFoundChannel({
          id: channel.youtubeId,
          title: channel.name,
          description: '',
          thumbnailUrl: channel.avatarUrl,
          subscriberCount: channel.subscriberCount
      });
      
      setShowAddModal(true);
  };

  const handleOpenAdd = () => {
      resetForm();
      setEditingChannel(null);
      setShowAddModal(true);
  }

  const handleSaveChannel = async () => {
    if (!foundChannel && !editingChannel) return; // Must have channel info
    
    setIsLoading(true);
    try {
      const configData = {
        clientId: customClientId,
        clientSecret: customClientSecret,
        defaultTitle: defaultTitle,
        defaultDescription: defaultDescription,
        defaultTags: defaultTags.split(',').map(t => t.trim()).filter(t => t)
      };

      if (editingChannel) {
          // UPDATE MODE
          await updateChannelConfig(editingChannel.id, configData);
          alert("Đã cập nhật cấu hình kênh thành công!");
      } else {
          // ADD MODE
          if (!foundChannel) return;
          await addChannel({
            youtube_id: foundChannel.id,
            name: foundChannel.title,
            avatarUrl: foundChannel.thumbnailUrl,
            subscriberCount: foundChannel.subscriberCount,
            tags: [],
            ...configData
          } as any);
      }

      setShowAddModal(false);
      resetForm();
      loadChannels();
    } catch (error) {
      alert("Lỗi lưu kênh: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
      setChannelIdInput('');
      setFoundChannel(null);
      setCustomClientId('');
      setCustomClientSecret('');
      setDefaultTitle('');
      setDefaultDescription('');
      setDefaultTags('');
      setEditingChannel(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Xóa kênh?")) {
      await deleteChannel(id);
      loadChannels();
    }
  };

  const handleAuthorize = async (channel: Channel) => {
    let clientId = channel.clientId;
    if (!clientId) {
        const db = await fetchSystemSettings();
        clientId = db.googleClientId;
    }

    if (!clientId) {
      alert("Thiếu Client ID. Hãy bấm nút Edit để cấu hình App riêng hoặc vào Settings hệ thống.");
      return;
    }

    if (channel.clientId && !channel.clientSecret) {
        alert("Bạn đang dùng Client ID riêng nhưng thiếu Client Secret. Vui lòng bấm Edit để bổ sung.");
        return;
    }

    let redirectUri = window.location.origin + window.location.pathname;
    if (redirectUri.endsWith('/')) redirectUri = redirectUri.slice(0, -1);

    const authUrl = getGoogleAuthUrl(clientId, redirectUri, channel.id);
    window.location.href = authUrl;
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý Kênh</h2>
          <p className="text-gray-400 text-sm mt-1">Quản lý OAuth và Metadata mặc định</p>
        </div>
        <div className="flex gap-2">
            <button onClick={loadChannels} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg">
                 <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleOpenAdd} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
                <Plus className="w-5 h-5" /> Thêm Kênh
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map(channel => {
          const hasRefreshToken = !!channel.refreshToken;
          const now = Date.now();
          const tokenValid = channel.accessToken && channel.tokenExpiresAt && channel.tokenExpiresAt > now;
          
          return (
            <div key={channel.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden group">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                    <img src={channel.avatarUrl} className="w-12 h-12 rounded-full border border-gray-600" />
                    <div className="min-w-0">
                      <h3 className="font-bold text-white truncate" title={channel.name}>{channel.name}</h3>
                      <p className="text-xs text-gray-500">{channel.subscriberCount.toLocaleString()} subs</p>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex flex-col gap-2 bg-gray-900/50 p-3 rounded-lg">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Trạng thái:</span>
                        {hasRefreshToken ? (
                            <span className="text-green-400 font-medium flex items-center gap-1">
                                <Unlock className="w-3 h-3" /> Auto-Refresh Active
                            </span>
                        ) : (
                            <span className="text-red-400 font-medium flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Cần kết nối lại
                            </span>
                        )}
                    </div>
                    {channel.clientId && (
                        <div className="text-[10px] text-blue-400 italic">
                            * Dùng Client ID riêng
                        </div>
                    )}
                    {!hasRefreshToken && (
                        <button 
                          onClick={() => handleAuthorize(channel)}
                          className="mt-1 w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded transition"
                        >
                            Kết nối (Cấp quyền Offline)
                        </button>
                    )}
                </div>

                {/* Defaults Preview */}
                <div className="mt-3 text-[10px] text-gray-500 space-y-1">
                    <p className="truncate">Default Title: <span className="text-gray-300">{channel.defaultTitle || '(Trống)'}</span></p>
                    <p className="truncate">Default Tags: <span className="text-gray-300">{channel.defaultTags?.join(', ') || '(Trống)'}</span></p>
                </div>
              </div>
              <div className="bg-gray-800/50 border-t border-gray-700 p-2 flex justify-end gap-2">
                 <button onClick={() => handleOpenEdit(channel)} className="p-2 hover:bg-blue-900/30 rounded text-blue-400" title="Cấu hình / Sửa">
                    <Edit className="w-4 h-4" />
                 </button>
                 <button onClick={() => handleDelete(channel.id)} className="p-2 hover:bg-red-900/30 rounded text-red-400" title="Xóa kênh">
                    <Trash2 className="w-4 h-4" />
                 </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL THÊM / SỬA KÊNH */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl shadow-2xl my-8">
            <div className="p-6 border-b border-gray-700">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Youtube className="w-6 h-6 text-red-500" />
                    {editingChannel ? `Cấu hình Kênh: ${editingChannel.name}` : 'Thêm Kênh Mới'}
                </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Step 1: Check ID (Chỉ hiện khi Thêm mới) */}
              {!editingChannel && (
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <label className="block text-sm text-blue-400 font-bold mb-2">1. Tìm Kênh YouTube</label>
                    <div className="flex gap-2">
                    <input 
                        value={channelIdInput}
                        onChange={e => setChannelIdInput(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white outline-none"
                        placeholder="Nhập Channel ID (VD: UC...)"
                    />
                    <button onClick={handleCheckChannel} disabled={isChecking} className="bg-gray-700 text-white px-3 rounded">
                        {isChecking ? <Loader2 className="animate-spin" /> : <Search />}
                    </button>
                    </div>
                    {errorMsg && <p className="text-red-400 text-xs mt-2">{errorMsg}</p>}
                </div>
              )}

              {/* Info Kênh (Chỉ hiện visual) */}
              {foundChannel && (
                  <div className="flex items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                      <img src={foundChannel.thumbnailUrl} className="w-12 h-12 rounded-full" />
                      <div>
                          <h4 className="font-bold text-white">{foundChannel.title}</h4>
                          <p className="text-xs text-gray-400">{foundChannel.subscriberCount.toLocaleString()} subs</p>
                      </div>
                      {editingChannel && <div className="ml-auto text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">ID: {editingChannel.youtubeId}</div>}
                  </div>
              )}

              {/* Step 2: Auth Config */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <label className="block text-sm text-yellow-500 font-bold mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> 2. Cấu hình OAuth Riêng
                </label>
                <p className="text-[10px] text-gray-400 mb-3">Điền Client ID & Secret nếu bạn muốn dùng App riêng cho kênh này.</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400">Client ID</label>
                        <input value={customClientId} onChange={e => setCustomClientId(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Client Secret</label>
                        <input type="password" value={customClientSecret} onChange={e => setCustomClientSecret(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs mt-1" />
                    </div>
                </div>
              </div>

              {/* Step 3: Default Metadata */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                 <label className="block text-sm text-purple-400 font-bold mb-2 flex items-center gap-2">
                    <SettingsIcon className="w-4 h-4" /> 3. Metadata Mặc Định
                 </label>
                 <p className="text-[10px] text-gray-400 mb-3">Sẽ tự động điền nếu video upload bị thiếu thông tin.</p>
                 
                 <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-400">Tiêu đề mặc định</label>
                        <input value={defaultTitle} onChange={e => setDefaultTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1" placeholder="VD: Video mới từ..." />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Mô tả mặc định</label>
                        <textarea rows={3} value={defaultDescription} onChange={e => setDefaultDescription(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1" placeholder="Subscribe để ủng hộ kênh..." />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Tags mặc định (cách nhau dấu phẩy)</label>
                        <input value={defaultTags} onChange={e => setDefaultTags(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1" placeholder="vlog, music, funny..." />
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Hủy</button>
              <button 
                  onClick={handleSaveChannel} 
                  disabled={!foundChannel && !editingChannel} 
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold disabled:opacity-50 flex items-center gap-2"
              >
                  <Save className="w-4 h-4" />
                  {editingChannel ? 'Cập Nhật' : 'Lưu Kênh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelManager;
