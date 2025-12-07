
import React, { useState, useEffect, useRef } from 'react';
import { Channel, ChannelStatus, VideoItem, VideoStatus, ProxyItem } from '../types';
import { RefreshCw, Trash2, Youtube, ExternalLink, Plus, Search, Loader2, Lock, Unlock, LogIn, Settings as SettingsIcon, Save, Edit, UploadCloud, FolderOpen, FileSearch, Network } from 'lucide-react';
import { fetchChannels, addChannel, deleteChannel, updateChannelCredentials, fetchSystemSettings, updateChannelConfig, saveVideo, createJob, syncVideosForChannel, fetchProxies } from '../services/supabaseService';
import { getChannelInfo, getGoogleAuthUrl, exchangeCodeForToken, YouTubeChannelInfo } from '../services/youtubeService';

const ChannelManager: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // State for Edit Mode
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // Form State
  const [channelIdInput, setChannelIdInput] = useState('');
  
  // Custom Settings for Channel
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');
  const [selectedProxyId, setSelectedProxyId] = useState(''); 
  
  // Default Metadata
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultDescription, setDefaultDescription] = useState('');
  const [defaultTags, setDefaultTags] = useState('');
  const [defaultFolderPath, setDefaultFolderPath] = useState(''); 

  // Info Check
  const [isChecking, setIsChecking] = useState(false);
  const [foundChannel, setFoundChannel] = useState<YouTubeChannelInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanStatus, setScanStatus] = useState('');

  // UI Blocking State
  const [isScanning, setIsScanning] = useState(false);

  // Upload Handling
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null); // For Folder Scan
  const targetChannelIdRef = useRef<string | null>(null);

  const loadChannels = async () => {
    setIsLoading(true);
    const [cData, pData] = await Promise.all([fetchChannels(), fetchProxies()]);
    setChannels(cData);
    setProxies(pData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadChannels();
    const handleAuthCallback = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const stateChannelId = urlParams.get('state');
        if (code && stateChannelId) {
            try {
                setIsLoading(true);
                const currentChannels = await fetchChannels();
                const targetChannel = currentChannels.find(c => c.id === stateChannelId);
                const systemSettings = await fetchSystemSettings();
                const clientIdToUse = targetChannel?.clientId || systemSettings.googleClientId;
                const clientSecretToUse = targetChannel?.clientSecret || ''; 
                if (!clientSecretToUse && targetChannel?.clientId) {
                    alert("Cảnh báo: Không tìm thấy Client Secret.");
                }
                let redirectUri = window.location.origin + window.location.pathname;
                if (redirectUri.endsWith('/')) redirectUri = redirectUri.slice(0, -1);
                const tokenData = await exchangeCodeForToken(code, clientIdToUse!, clientSecretToUse!, redirectUri);
                await updateChannelCredentials(stateChannelId, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);
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
      else setErrorMsg("Không tìm thấy kênh này. Hãy thử nhập Channel ID (UC...) hoặc Handle (@...).");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsChecking(false);
    }
  };

  const handleOpenEdit = (channel: Channel) => {
      setEditingChannel(channel);
      setCustomClientId(channel.clientId || '');
      setCustomClientSecret(channel.clientSecret || '');
      setDefaultTitle(channel.defaultTitle || '');
      setDefaultDescription(channel.defaultDescription || '');
      setDefaultTags(channel.defaultTags?.join(', ') || '');
      setDefaultFolderPath(channel.defaultFolderPath || '');
      setSelectedProxyId(channel.proxyId || ''); // Load Proxy
      setScanStatus('');
      
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
    if (!foundChannel && !editingChannel) return; 
    setIsLoading(true);
    try {
      const configData = {
        clientId: customClientId,
        clientSecret: customClientSecret,
        defaultTitle: defaultTitle,
        defaultDescription: defaultDescription,
        defaultTags: defaultTags.split(',').map(t => t.trim()).filter(t => t),
        defaultFolderPath: defaultFolderPath,
        proxyId: selectedProxyId || null // Save Proxy
      };

      if (editingChannel) {
          await updateChannelConfig(editingChannel.id, configData as any);
          alert("Đã cập nhật cấu hình kênh thành công!");
      } else {
          if (!foundChannel) return;
          // IMPORTANT: Pass foundChannel.id as youtubeId
          await addChannel({
            youtubeId: foundChannel.id, 
            name: foundChannel.title,
            avatarUrl: foundChannel.thumbnailUrl,
            subscriberCount: foundChannel.subscriberCount,
            tags: [],
            ...configData as any
          } as any);
      }
      setShowAddModal(false);
      resetForm();
      loadChannels();
    } catch (error: any) {
      alert("Lỗi lưu kênh: " + error.message);
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
      setDefaultFolderPath('');
      setSelectedProxyId('');
      setScanStatus('');
      setEditingChannel(null);
      setIsScanning(false);
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

  // --- FOLDER SCAN LOGIC ---
  const triggerFolderScan = () => {
    if (!editingChannel) {
        alert("Vui lòng 'Lưu Kênh' mới trước khi thực hiện Scan File để hệ thống khởi tạo Database.");
        return;
    }

    if (directoryInputRef.current) {
        directoryInputRef.current.click();
    }
  };

  const handleFolderScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0 || !editingChannel) return;
      
      const files = Array.from(e.target.files) as File[];
      // Filter video files only
      const videoFiles = files.filter(f => f.type.startsWith('video/'));
      
      if (videoFiles.length === 0) {
          alert("Không tìm thấy file video nào trong thư mục đã chọn.");
          return;
      }

      setIsScanning(true); // BLOCK UI START
      setScanStatus(`Đang đọc ${videoFiles.length} file... Vui lòng đợi.`);

      try {
          // Lưu folder path tượng trưng từ input text (người dùng nhập để nhớ)
          // Kết hợp với danh sách file thực tế quét được.
          const currentPath = defaultFolderPath || 'ImportedFolder';
          
          const fileList = videoFiles.map(f => ({ name: f.name }));
          
          // Giả lập delay để người dùng thấy overlay (nếu máy nhanh quá)
          // await new Promise(r => setTimeout(r, 1000));

          await syncVideosForChannel(editingChannel.id, currentPath, fileList);
          
          setScanStatus(`✅ Đã đồng bộ ${videoFiles.length} video cho kênh "${editingChannel.name}"!`);
          
          // Tự động điền đường dẫn nếu chưa có
          // @ts-ignore
          if (!defaultFolderPath && videoFiles[0].webkitRelativePath) {
              // @ts-ignore
              const parts = videoFiles[0].webkitRelativePath.split('/');
              if (parts.length > 1) {
                   setDefaultFolderPath(parts[0]);
              }
          }
      } catch (err: any) {
          setScanStatus("Lỗi sync: " + err.message);
          alert("Lỗi quá trình scan: " + err.message);
      } finally {
          setIsScanning(false); // BLOCK UI END
          e.target.value = ''; // Reset input
      }
  };

  // --- UPLOAD LOGIC ---
  const handleUploadClick = (channel: Channel) => {
    targetChannelIdRef.current = channel.id;
    if(fileInputRef.current) fileInputRef.current.click();
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !targetChannelIdRef.current) return;

      const file = files[0];
      const channelId = targetChannelIdRef.current;
      
      const ch = channels.find(c => c.id === channelId);
      const folderPath = ch?.defaultFolderPath || 'Upload từ Web';

      try {
          const videoId = await saveVideo({
              filename: file.name,
              filePath: folderPath, 
              resolution: 'Unknown',
              status: VideoStatus.DRAFT,
              channelId: channelId, // Bind to channel
              metadata: {
                  title: file.name.replace(/\.[^/.]+$/, ""),
                  description: '',
                  tags: [],
                  visibility: 'private'
              }
          });

          await createJob({
              videoId: videoId,
              channelId: channelId,
              scheduledTime: new Date().toISOString()
          });

          alert(`Đã thêm video "${file.name}" vào hàng đợi của kênh ${ch?.name}!`);
          e.target.value = '';
          targetChannelIdRef.current = null;

      } catch (error: any) {
          alert("Lỗi thêm video: " + error.message);
      }
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý Kênh</h2>
          <p className="text-gray-400 text-sm mt-1">Quản lý OAuth, Folder và Proxy</p>
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

      {/* Hidden File Input for Direct Upload */}
      <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} />
      
      {/* Hidden Directory Input for Scanning */}
      <input 
          type="file" 
          ref={directoryInputRef} 
          className="hidden" 
          // @ts-ignore
          webkitdirectory="" 
          directory="" 
          onChange={handleFolderScan} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map(channel => {
          const hasRefreshToken = !!channel.refreshToken;
          return (
            <div key={channel.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden group flex flex-col">
              <div className="p-5 flex-1">
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
                                <Unlock className="w-3 h-3" /> Ready
                            </span>
                        ) : (
                            <span className="text-red-400 font-medium flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Disconnected
                            </span>
                        )}
                    </div>
                    {channel.proxyIP && (
                         <div className="flex justify-between items-center text-xs border-t border-gray-800 pt-2 mt-1">
                             <span className="text-gray-400">Proxy:</span>
                             <span className="text-blue-300 font-mono truncate max-w-[120px]" title={channel.proxyIP}>
                                 {channel.proxyIP}
                             </span>
                         </div>
                    )}
                    {channel.clientId && (
                        <div className="text-[10px] text-blue-400 italic mt-1">
                            * Dùng Client ID riêng
                        </div>
                    )}
                    {!hasRefreshToken && (
                        <button 
                          onClick={() => handleAuthorize(channel)}
                          className="mt-1 w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded transition"
                        >
                            Kết nối
                        </button>
                    )}
                </div>

                {/* Folder & Defaults Info */}
                <div className="mt-3 text-[10px] text-gray-500 space-y-1">
                    <p className="truncate flex items-center gap-1" title={channel.defaultFolderPath}>
                        <FolderOpen className="w-3 h-3" /> 
                        Folder: <span className="text-gray-300">{channel.defaultFolderPath || '(Chưa set)'}</span>
                    </p>
                    <p className="truncate">Title: <span className="text-gray-300">{channel.defaultTitle || '(None)'}</span></p>
                </div>
              </div>
              
              {/* Actions Footer */}
              <div className="bg-gray-800/50 border-t border-gray-700 p-2 flex justify-between items-center">
                 <button 
                    onClick={() => handleUploadClick(channel)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-700/50 hover:bg-green-600 text-green-100 text-xs rounded transition"
                    title="Chọn Video để Upload lên kênh này"
                 >
                    <UploadCloud className="w-4 h-4" /> Upload
                 </button>

                 <div className="flex gap-1">
                    <button onClick={() => handleOpenEdit(channel)} className="p-2 hover:bg-blue-900/30 rounded text-blue-400" title="Cấu hình / Sửa">
                        <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(channel.id)} className="p-2 hover:bg-red-900/30 rounded text-red-400" title="Xóa kênh">
                        <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL THÊM / SỬA KÊNH */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl shadow-2xl my-8 relative overflow-hidden">
            
            {/* OVERLAY BLOCKING UI */}
            {isScanning && (
                <div className="absolute inset-0 z-[60] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
                    <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Đang đồng bộ dữ liệu...</h3>
                    <p className="text-gray-400 mb-4 text-sm max-w-sm">{scanStatus}</p>
                    <div className="px-4 py-2 bg-yellow-900/20 border border-yellow-800 rounded text-yellow-500 text-xs">
                        ⚠️ Vui lòng KHÔNG tắt trình duyệt hoặc đóng cửa sổ này.
                    </div>
                </div>
            )}

            <div className="p-6 border-b border-gray-700">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Youtube className="w-6 h-6 text-red-500" />
                    {editingChannel ? `Cấu hình Kênh: ${editingChannel.name}` : 'Thêm Kênh Mới'}
                </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Step 1: Check ID */}
              {!editingChannel && (
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <label className="block text-sm text-blue-400 font-bold mb-2">1. Tìm Kênh YouTube</label>
                    <div className="flex gap-2">
                    <input 
                        value={channelIdInput}
                        onChange={e => setChannelIdInput(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white outline-none"
                        placeholder="Nhập Channel ID (UC...) hoặc Handle (@tenkenh)"
                    />
                    <button onClick={handleCheckChannel} disabled={isChecking} className="bg-gray-700 text-white px-3 rounded">
                        {isChecking ? <Loader2 className="animate-spin" /> : <Search />}
                    </button>
                    </div>
                    {errorMsg && <p className="text-red-400 text-xs mt-2">{errorMsg}</p>}
                </div>
              )}

              {foundChannel && (
                  <div className="flex items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                      <img src={foundChannel.thumbnailUrl} className="w-12 h-12 rounded-full" />
                      <div>
                          <h4 className="font-bold text-white">{foundChannel.title}</h4>
                          <p className="text-xs text-gray-400">{foundChannel.subscriberCount.toLocaleString()} subs</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">ID: {foundChannel.id}</p>
                      </div>
                  </div>
              )}

              {/* Step 2: Auth Config */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <label className="block text-sm text-yellow-500 font-bold mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> 2. Cấu hình Bảo mật & Mạng
                </label>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400">Client ID (OAuth)</label>
                        <input value={customClientId} onChange={e => setCustomClientId(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Client Secret</label>
                        <input type="password" value={customClientSecret} onChange={e => setCustomClientSecret(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs mt-1" />
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1"><Network className="w-3 h-3"/> Gán Proxy (Upload IP)</label>
                        <select 
                            value={selectedProxyId} 
                            onChange={e => setSelectedProxyId(e.target.value)} 
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs mt-1"
                        >
                            <option value="">-- Không sử dụng Proxy --</option>
                            {proxies.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.location} - {p.ip}:{p.port} ({p.protocol})
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-gray-500 mt-1">Cần có backend/desktop worker để proxy hoạt động hiệu quả khi upload.</p>
                    </div>
                </div>
              </div>

              {/* Step 3: Default Metadata & Folder */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                 <label className="block text-sm text-purple-400 font-bold mb-2 flex items-center gap-2">
                    <SettingsIcon className="w-4 h-4" /> 3. Mặc Định & Thư Mục
                 </label>
                 
                 <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-400">Thư mục Video (Gợi nhớ)</label>
                        <div className="flex gap-2">
                             <input value={defaultFolderPath} onChange={e => setDefaultFolderPath(e.target.value)} className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1" placeholder="VD: C:\Videos\Channel1" />
                             <button 
                                onClick={triggerFolderScan} 
                                className="mt-1 bg-blue-700 hover:bg-blue-600 text-white px-3 rounded text-xs flex items-center gap-1 whitespace-nowrap"
                                title={!editingChannel ? "Lưu kênh trước khi Scan" : "Quét các file video trong thư mục này và sync vào Database"}
                            >
                                <FileSearch className="w-3 h-3" />
                                Scan File
                            </button>
                        </div>
                        {scanStatus && <p className="text-xs text-green-400 mt-1">{scanStatus}</p>}
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Tiêu đề mặc định</label>
                        <input value={defaultTitle} onChange={e => setDefaultTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Mô tả mặc định</label>
                        <textarea rows={2} value={defaultDescription} onChange={e => setDefaultDescription(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Tags mặc định (cách nhau dấu phẩy)</label>
                        <input value={defaultTags} onChange={e => setDefaultTags(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1" placeholder="tag1, tag2, tag3" />
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
