
import React, { useState, useEffect, useRef } from 'react';
import { Channel, ChannelStatus, VideoItem, VideoStatus, ChannelGroup } from '../types';
import { RefreshCw, Trash2, Youtube, ExternalLink, Plus, Search, Loader2, Lock, Unlock, LogIn, Settings as SettingsIcon, Save, Edit, UploadCloud, FolderOpen, FileSearch, Network, Layers, Filter, Check, X, AlertTriangle, Info } from 'lucide-react';
import { fetchChannels, addChannel, deleteChannel, updateChannelCredentials, fetchSystemSettings, updateChannelConfig, saveVideo, createJob, syncVideosForChannel, fetchChannelGroups, saveChannelGroup, deleteChannelGroup, updateChannelGroup } from '../services/supabaseService';
import { getChannelInfo, getGoogleAuthUrl, exchangeCodeForToken, YouTubeChannelInfo } from '../services/youtubeService';

interface ChannelManagerProps {
    selectedGroupId?: string;
}

const ChannelManager: React.FC<ChannelManagerProps> = ({ selectedGroupId }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<ChannelGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  
  // State for Edit Mode
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // Form State (Channel)
  const [channelIdInput, setChannelIdInput] = useState('');
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');
  const [modalSelectedGroupId, setModalSelectedGroupId] = useState(''); 
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultDescription, setDefaultDescription] = useState(''); 
  const [defaultTags, setDefaultTags] = useState(''); 
  const [defaultFolderPath, setDefaultFolderPath] = useState(''); 

  // Form State (Group)
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  // Info Check
  const [isChecking, setIsChecking] = useState(false);
  const [foundChannel, setFoundChannel] = useState<YouTubeChannelInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanStatus, setScanStatus] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Upload Handling
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null); 
  const targetChannelIdRef = useRef<string | null>(null);

  // --- CUSTOM MODAL STATE ---
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'CONFIRM' | 'ALERT' | 'INFO';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'INFO', title: '', message: '' });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModal({ isOpen: true, type: 'CONFIRM', title, message, onConfirm });
  };

  const showAlert = (title: string, message: string) => {
    setModal({ isOpen: true, type: 'ALERT', title, message });
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  const loadAllData = async () => {
    setIsLoading(true);
    // Load channels filtered by Global Profile if set
    const [cData, gData] = await Promise.all([
        fetchChannels(selectedGroupId), 
        fetchChannelGroups()
    ]);
    setChannels(cData);
    setGroups(gData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAllData();
    // OAuth Callback Handler
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
                
                const clientIdToUse = targetChannel?.clientId?.trim() || systemSettings.googleClientId?.trim();
                const clientSecretToUse = targetChannel?.clientSecret?.trim() || ''; 
                
                if (!clientIdToUse) throw new Error("Missing Client ID.");
                if (targetChannel?.clientId && !clientSecretToUse) {
                    throw new Error("Custom App requires Client Secret.");
                }

                let redirectUri = window.location.origin + window.location.pathname;
                if (redirectUri.endsWith('/')) redirectUri = redirectUri.slice(0, -1);
                
                const tokenData = await exchangeCodeForToken(code, clientIdToUse!, clientSecretToUse!, redirectUri);
                
                await updateChannelCredentials(stateChannelId, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);
                window.history.replaceState(null, '', window.location.pathname);
                showAlert("Thành công", "Kết nối thành công! Refresh Token đã được lưu.");
                loadAllData();
            } catch (e: any) {
                showAlert("Lỗi kết nối OAuth", e.message);
            } finally {
                setIsLoading(false);
            }
        }
    };
    handleAuthCallback();
  }, [selectedGroupId]);

  const handleCheckChannel = async () => {
    if (!channelIdInput) return;
    setIsChecking(true);
    setErrorMsg('');
    setFoundChannel(null);
    const dbSettings = await fetchSystemSettings();
    if (!dbSettings.youtubeApiKey) {
      setErrorMsg("Chưa có YouTube API Key.");
      setIsChecking(false);
      return;
    }
    try {
      const info = await getChannelInfo(channelIdInput, dbSettings.youtubeApiKey);
      if (info) setFoundChannel(info);
      else setErrorMsg("Không tìm thấy kênh.");
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
      setModalSelectedGroupId(channel.groupId || ''); // Load Group
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
      // Auto select current global group if active
      if (selectedGroupId) setModalSelectedGroupId(selectedGroupId);
      setShowAddModal(true);
  }

  const handleSaveChannel = async () => {
    if (!foundChannel && !editingChannel) return; 
    setIsLoading(true);
    try {
      const configData = {
        clientId: customClientId.trim(),
        clientSecret: customClientSecret.trim(),
        defaultTitle: defaultTitle,
        defaultDescription: defaultDescription,
        defaultTags: defaultTags.split(',').map(t => t.trim()).filter(t => t),
        defaultFolderPath: defaultFolderPath,
        groupId: modalSelectedGroupId || null
      };

      if (editingChannel) {
          await updateChannelConfig(editingChannel.id, configData as any);
          showAlert("Thành công", "Đã cập nhật cấu hình kênh thành công!");
      } else {
          if (!foundChannel) return;
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
      loadAllData();
    } catch (error: any) {
      showAlert("Lỗi lưu kênh", error.message);
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
      setModalSelectedGroupId('');
      setScanStatus('');
      setEditingChannel(null);
      setIsScanning(false);
  };

  const handleDelete = async (id: string) => {
    showConfirm("Xác nhận xóa kênh", "Bạn có chắc muốn xóa kênh này khỏi hệ thống?", async () => {
        await deleteChannel(id);
        loadAllData();
    });
  };

  const handleAuthorize = async (channel: Channel) => {
    let clientId = channel.clientId?.trim();
    if (!clientId) {
        const db = await fetchSystemSettings();
        clientId = db.googleClientId?.trim();
    }
    if (!clientId) return showAlert("Cấu hình thiếu", "Thiếu Client ID.");
    if (channel.clientId && !channel.clientSecret) return showAlert("Cấu hình thiếu", "Thiếu Custom Client Secret.");

    let redirectUri = window.location.origin + window.location.pathname;
    if (redirectUri.endsWith('/')) redirectUri = redirectUri.slice(0, -1);
    
    const authUrl = getGoogleAuthUrl(clientId, redirectUri, channel.id);
    window.location.href = authUrl;
  };

  // --- GROUP MANAGEMENT ---
  const handleSaveGroup = async () => {
      if(!newGroupName) return;
      try {
          await saveChannelGroup({ name: newGroupName });
          setNewGroupName('');
          loadAllData();
      } catch (e: any) {
          showAlert("Lỗi tạo nhóm", e.message + "\n(Vui lòng kiểm tra lại bảng 'channel_groups' trong DB)");
      }
  }

  const handleUpdateGroup = async (id: string) => {
      if (!editingGroupName.trim()) return;
      try {
          await updateChannelGroup(id, editingGroupName);
          setEditingGroupId(null);
          loadAllData();
      } catch (e: any) {
          showAlert("Lỗi cập nhật", e.message);
      }
  }
  
  const handleDeleteGroup = async (id: string) => {
      showConfirm("Xác nhận xóa nhóm", "Bạn có chắc muốn xóa nhóm này? Các kênh trong nhóm sẽ trở về trạng thái chưa phân nhóm.", async () => {
          await deleteChannelGroup(id);
          loadAllData();
      });
  }

  // --- FOLDER SCAN & UPLOAD (Minified) ---
  const triggerFolderScan = () => {
    if (!editingChannel) return showAlert("Cảnh báo", "Lưu kênh trước khi scan.");
    directoryInputRef.current?.click();
  };

  const handleFolderScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !editingChannel) return;
      // Fixed: explicitly typed f as any to avoid unknown type error from Array.from on FileList
      const videoFiles = Array.from(e.target.files).filter((f: any) => f.type.startsWith('video/'));
      if (videoFiles.length === 0) return showAlert("Thông báo", "Không có video nào trong thư mục này.");
      
      setIsScanning(true);
      setScanStatus(`Reading ${videoFiles.length} files...`);
      try {
          await syncVideosForChannel(editingChannel.id, defaultFolderPath || 'ImportedFolder', videoFiles.map((f: any) => ({ name: f.name })));
          setScanStatus(`✅ Synced ${videoFiles.length} videos!`);
           // @ts-ignore
          if (!defaultFolderPath && videoFiles[0].webkitRelativePath) {
               // @ts-ignore
               setDefaultFolderPath(videoFiles[0].webkitRelativePath.split('/')[0]);
          }
      } catch (err: any) { setScanStatus("Error: " + err.message); }
      finally { setIsScanning(false); }
  };

  return (
    <div className="space-y-6 relative">
      {/* --- CUSTOM MODAL OVERLAY --- */}
      {modal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md shadow-2xl scale-100 transform transition-all">
                  <div className="p-6">
                      <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-full shrink-0 ${modal.type === 'CONFIRM' ? 'bg-red-900/30 text-red-500' : 'bg-blue-900/30 text-blue-500'}`}>
                              {modal.type === 'CONFIRM' ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                          </div>
                          <div>
                              <h3 className="text-xl font-bold text-white mb-2">{modal.title}</h3>
                              <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{modal.message}</p>
                          </div>
                      </div>
                  </div>
                  <div className="bg-gray-800/50 p-4 border-t border-gray-700 flex justify-end gap-3 rounded-b-2xl">
                      <button 
                          onClick={closeModal} 
                          className="px-4 py-2 text-gray-400 hover:text-white font-medium hover:bg-gray-800 rounded transition"
                      >
                          {modal.type === 'CONFIRM' ? 'Hủy Bỏ' : 'Đóng'}
                      </button>
                      {modal.type === 'CONFIRM' && (
                          <button 
                              onClick={() => {
                                  if (modal.onConfirm) modal.onConfirm();
                                  closeModal();
                              }}
                              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold shadow-lg shadow-red-900/20 transition flex items-center gap-2"
                          >
                              <Trash2 className="w-4 h-4" /> Xác Nhận Xóa
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý Kênh</h2>
          <p className="text-gray-400 text-sm mt-1">Quản lý OAuth, Folder và Nhóm (Profile)</p>
        </div>
        
        <div className="flex items-center gap-2">
            <button onClick={() => setShowGroupModal(true)} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg border border-gray-700" title="Quản lý Nhóm">
                <Layers className="w-5 h-5"/>
            </button>

            <button onClick={loadAllData} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg border border-gray-700">
                 <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleOpenAdd} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
                <Plus className="w-5 h-5" /> Thêm Kênh
            </button>
        </div>
      </div>

      {/* Hidden Inputs */}
      <input type="file" ref={fileInputRef} className="hidden" accept="video/*" />
      <input type="file" ref={directoryInputRef} className="hidden" 
          // @ts-ignore
          webkitdirectory="" directory="" onChange={handleFolderScan} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-500 bg-gray-900/50 rounded-lg border border-dashed border-gray-700">
                <Youtube className="w-12 h-12 mx-auto mb-2 opacity-30"/>
                <p>Chưa có kênh nào trong Profile này.</p>
            </div>
        ) : channels.map(channel => {
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
                    {channel.groupName && (
                        <div className="flex justify-between items-center text-xs border-t border-gray-800 pt-2 mt-1">
                             <span className="text-gray-400">Nhóm:</span>
                             <span className="text-purple-300 font-bold bg-purple-900/30 px-1 rounded">{channel.groupName}</span>
                        </div>
                    )}
                </div>

                <div className="mt-3 text-[10px] text-gray-500 space-y-1">
                    <p className="truncate flex items-center gap-1" title={channel.defaultFolderPath}>
                        <FolderOpen className="w-3 h-3" /> 
                        Folder: <span className="text-gray-300">{channel.defaultFolderPath || '(Chưa set)'}</span>
                    </p>
                </div>
              </div>
              
              <div className="bg-gray-800/50 border-t border-gray-700 p-2 flex justify-between items-center">
                 <button onClick={() => handleAuthorize(channel)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-700/50 hover:bg-blue-600 text-blue-100 text-xs rounded transition">
                    <RefreshCw className="w-4 h-4" /> Kết Nối Lại
                 </button>

                 <div className="flex gap-1">
                    <button onClick={() => handleOpenEdit(channel)} className="p-2 hover:bg-blue-900/30 rounded text-blue-400"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(channel.id)} className="p-2 hover:bg-red-900/30 rounded text-red-400"><Trash2 className="w-4 h-4" /></button>
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
            {isScanning && (
                <div className="absolute inset-0 z-[60] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
                    <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Syncing Data...</h3>
                    <p className="text-gray-400 mb-4 text-sm max-w-sm">{scanStatus}</p>
                </div>
            )}

            <div className="p-6 border-b border-gray-700">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Youtube className="w-6 h-6 text-red-500" />
                    {editingChannel ? `Cấu hình: ${editingChannel.name}` : 'Thêm Kênh Mới'}
                </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {!editingChannel && (
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <label className="block text-sm text-blue-400 font-bold mb-2">1. Tìm Kênh YouTube</label>
                    <div className="flex gap-2">
                    <input 
                        value={channelIdInput} onChange={e => setChannelIdInput(e.target.value)}
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
                      </div>
                  </div>
              )}

              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <label className="block text-sm text-yellow-500 font-bold mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> 2. Cấu hình Bảo mật & Mạng
                </label>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400">Client ID</label>
                        <input value={customClientId} onChange={e => setCustomClientId(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Client Secret</label>
                        <input type="password" value={customClientSecret} onChange={e => setCustomClientSecret(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs mt-1" />
                    </div>
                    <div>
                         <label className="text-xs text-gray-400 flex items-center gap-1"><Layers className="w-3 h-3"/> Gán Nhóm (Profile)</label>
                         <select 
                            value={modalSelectedGroupId} onChange={e => setModalSelectedGroupId(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs mt-1"
                        >
                            <option value="">-- Chưa phân nhóm --</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
              </div>

              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                 <label className="block text-sm text-purple-400 font-bold mb-2 flex items-center gap-2">
                    <SettingsIcon className="w-4 h-4" /> 3. Mặc Định & Thư Mục
                 </label>
                 <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-400">Thư mục Video</label>
                        <div className="flex gap-2">
                             <input value={defaultFolderPath} onChange={e => setDefaultFolderPath(e.target.value)} className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1" placeholder="VD: C:\Videos\Channel1" />
                             <button onClick={triggerFolderScan} className="mt-1 bg-blue-700 hover:bg-blue-600 text-white px-3 rounded text-xs flex items-center gap-1 whitespace-nowrap">
                                <FileSearch className="w-3 h-3" /> Scan File
                            </button>
                        </div>
                    </div>
                    {/* Simplified Metadata inputs for brevity */}
                    <div>
                        <label className="text-xs text-gray-400">Tiêu đề mặc định</label>
                        <input value={defaultTitle} onChange={e => setDefaultTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Mô tả mặc định</label>
                        <textarea 
                            value={defaultDescription} 
                            onChange={e => setDefaultDescription(e.target.value)} 
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1"
                            rows={3} 
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Tags mặc định (cách nhau dấu phẩy)</label>
                        <input 
                            value={defaultTags} 
                            onChange={e => setDefaultTags(e.target.value)} 
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1"
                            placeholder="tag1, tag2, tag3" 
                        />
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Hủy</button>
              <button onClick={handleSaveChannel} disabled={!foundChannel && !editingChannel} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold disabled:opacity-50">Lưu Kênh</button>
            </div>
          </div>
        </div>
      )}

      {/* GROUP MANAGER MODAL */}
      {showGroupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6 space-y-4">
                  <h3 className="text-xl font-bold text-white mb-4">Quản Lý Nhóm Kênh</h3>
                  
                  <div className="flex gap-2">
                      <input 
                        value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                        placeholder="Tên nhóm mới (VD: Profile 1)"
                        className="flex-1 bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm"
                      />
                      <button onClick={handleSaveGroup} className="bg-green-600 text-white px-3 rounded font-bold">Thêm</button>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {groups.map(g => (
                          <div key={g.id} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                              {editingGroupId === g.id ? (
                                  <div className="flex flex-1 gap-2">
                                      <input 
                                          value={editingGroupName}
                                          onChange={(e) => setEditingGroupName(e.target.value)}
                                          className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                                          autoFocus
                                      />
                                      <button onClick={() => handleUpdateGroup(g.id)} className="text-green-400 hover:text-green-300"><Check className="w-4 h-4"/></button>
                                      <button onClick={() => setEditingGroupId(null)} className="text-gray-400 hover:text-gray-300"><X className="w-4 h-4"/></button>
                                  </div>
                              ) : (
                                  <>
                                      <span className="text-white text-sm flex-1">{g.name}</span>
                                      <div className="flex gap-1">
                                          <button onClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); }} className="text-blue-400 hover:bg-blue-900/30 p-1.5 rounded">
                                              <Edit className="w-4 h-4"/> 
                                          </button>
                                          <button onClick={() => handleDeleteGroup(g.id)} className="text-red-400 hover:bg-red-900/30 p-1.5 rounded">
                                              <Trash2 className="w-4 h-4"/>
                                          </button>
                                      </div>
                                  </>
                              )}
                          </div>
                      ))}
                      {groups.length === 0 && <p className="text-gray-500 text-center text-sm py-2">Chưa có nhóm nào.</p>}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-700">
                      <button onClick={() => setShowGroupModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Đóng</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ChannelManager;
