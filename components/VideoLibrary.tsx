
import React, { useState, useEffect, useRef } from 'react';
import { VideoItem, VideoStatus, VideoMetadata, Channel } from '../types';
import { FileVideo, Sparkles, Calendar, MoreVertical, Edit3, X, Save, Upload, RefreshCw, Link as LinkIcon, Filter, Search, Trash2, CheckSquare, AlertTriangle, Info, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { generateVideoMetadata } from '../services/geminiService';
import { fetchVideos, saveVideo, updateVideoMetadata, fetchChannels, deleteVideos } from '../services/supabaseService';

const VideoLibrary: React.FC = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filters & Sorting
  const [filterChannelId, setFilterChannelId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFolder, setFilterFolder] = useState('');
  const [limit, setLimit] = useState<number>(10);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Sorting State

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState<VideoMetadata>({
    title: '', description: '', tags: [], visibility: 'private'
  });
  const [editChannelId, setEditChannelId] = useState<string>('');

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

  const loadData = async () => {
    setIsLoading(true);
    // Clear selection on reload
    setSelectedIds([]);
    try {
      const [v, c] = await Promise.all([
          fetchVideos({ 
            channelId: filterChannelId, 
            status: filterStatus, 
            folder: filterFolder,
            limit: limit,
            sortBy: 'filename', // Sort by Name
            sortOrder: sortOrder // asc or desc
          }),
          fetchChannels()
      ]);
      setVideos(v);
      setChannels(c);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterChannelId, filterStatus, limit, sortOrder]); // Reload when select filters or sort change.

  // --- SELECTION LOGIC ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          // Select all currently visible videos
          setSelectedIds(videos.map(v => v.id));
      } else {
          setSelectedIds([]);
      }
  };

  const handleSelectRow = (id: string) => {
      if (selectedIds.includes(id)) {
          setSelectedIds(prev => prev.filter(x => x !== id));
      } else {
          setSelectedIds(prev => [...prev, id]);
      }
  };

  const handleDeleteSelected = async () => {
      if (selectedIds.length === 0) return;
      
      showConfirm(
          "Xác nhận xóa", 
          `Bạn có chắc muốn xóa ${selectedIds.length} video đã chọn khỏi hệ thống?`, 
          async () => {
              setIsDeleting(true);
              try {
                  await deleteVideos(selectedIds);
                  showAlert("Thành công", `Đã xóa thành công ${selectedIds.length} video!`);
                  await loadData();
              } catch (e: any) {
                  showAlert("Lỗi", "Lỗi xóa video: " + e.message);
              } finally {
                  setIsDeleting(false);
              }
          }
      );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    setIsLoading(true);
    const files = Array.from(e.target.files) as File[];
    
    // Use the selected filter channel as default, or undefined (null)
    const targetChannelId = filterChannelId || undefined;

    for (const file of files) {
      const videoEntry: Partial<VideoItem> = {
        filename: file.name,
        filePath: `C:\\Videos\\${file.name}`, 
        resolution: '1080p',
        status: VideoStatus.DRAFT,
        channelId: targetChannelId,
        metadata: {
          title: file.name.replace(/\.[^/.]+$/, ""),
          description: '',
          tags: [],
          visibility: 'private'
        }
      };
      await saveVideo(videoEntry);
    }
    
    await loadData();
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    if (!targetChannelId) {
        showAlert("Lưu ý", "Video đã được import! Lưu ý: Bạn chưa chọn Kênh trong bộ lọc, nên video chưa được gán cho kênh nào. Hãy sửa và gán kênh để lên lịch.");
    }
  };

  const openEditModal = (video: VideoItem) => {
    setEditingVideo(video);
    setEditForm({ ...video.metadata });
    setEditChannelId(video.channelId || '');
  };

  const saveEdit = async () => {
    if (!editingVideo) return;
    // Pass editChannelId to update
    await updateVideoMetadata(editingVideo.id, editForm, editChannelId || undefined);
    setEditingVideo(null);
    loadData();
  };

  const handleGenerateAI = async (video: VideoItem) => {
    setIsGenerating(video.id);
    try {
      const result = await generateVideoMetadata(video.filename, "General"); 
      if (result) {
        const newMeta = {
            title: result.titles[0],
            description: result.description,
            tags: result.tags,
            visibility: 'private'
        };
        await updateVideoMetadata(video.id, newMeta);
        loadData();
      }
    } catch (e) {
      console.error(e);
      showAlert("Lỗi", "Lỗi khi gọi Gemini API.");
    } finally {
      setIsGenerating(null);
    }
  };

  const toggleSort = () => {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  }

  return (
    <div className="space-y-6 relative">
      {/* --- CUSTOM MODAL --- */}
      {modal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
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

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-white">Thư viện Video</h2>
           <p className="text-gray-400 text-sm mt-1">{videos.length} videos được tìm thấy</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            {/* DELETE BUTTON */}
            {selectedIds.length > 0 && (
                <button 
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-lg shadow-red-900/20 mr-2"
                >
                    {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
                    Xóa ({selectedIds.length})
                </button>
            )}

            {/* Filters */}
            <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700">
                <Search className="w-4 h-4 text-gray-500 ml-2" />
                <input 
                  value={filterFolder}
                  onChange={e => setFilterFolder(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadData()}
                  placeholder="Tìm theo thư mục..."
                  className="bg-transparent text-sm text-white p-2 outline-none w-40"
                />
            </div>

            <button 
                onClick={toggleSort}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 transition"
                title="Sắp xếp theo Tên"
            >
                {sortOrder === 'asc' ? <ArrowDownAZ className="w-4 h-4 text-blue-400"/> : <ArrowUpZA className="w-4 h-4 text-blue-400"/>}
                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            </button>

            <select 
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="bg-gray-800 text-white text-sm border border-gray-700 rounded-lg p-2 outline-none"
            >
                <option value={10}>10 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
                <option value={500}>500 dòng</option>
                <option value={1000}>1000 dòng</option>
                <option value={-1}>Tất cả</option>
            </select>

            <select 
              value={filterChannelId}
              onChange={e => setFilterChannelId(e.target.value)}
              className="bg-gray-800 text-white text-sm border border-gray-700 rounded-lg p-2 outline-none"
            >
                <option value="">Tất cả kênh</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-gray-800 text-white text-sm border border-gray-700 rounded-lg p-2 outline-none"
            >
                <option value="">Tất cả trạng thái</option>
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PUBLISHED">Published</option>
            </select>

            <button onClick={loadData} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg border border-gray-700">
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
                title="Nếu đã chọn 'Tất cả kênh' ở bộ lọc, video sẽ không được gán kênh."
            >
                <Upload className="w-4 h-4" />
                Import
            </button>
            <input 
                type="file" 
                multiple 
                accept="video/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileSelect}
            />
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {videos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
             Không tìm thấy video nào phù hợp với bộ lọc.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 text-gray-400 text-sm border-b border-gray-700">
                <th className="p-4 w-10">
                    <input 
                        type="checkbox" 
                        onChange={handleSelectAll} 
                        checked={videos.length > 0 && selectedIds.length === videos.length}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                </th>
                <th className="p-4 font-medium flex items-center gap-2 cursor-pointer hover:text-white" onClick={toggleSort}>
                    Tên File & Đường Dẫn
                    {sortOrder === 'asc' ? <ArrowDownAZ className="w-3 h-3"/> : <ArrowUpZA className="w-3 h-3"/>}
                </th>
                <th className="p-4 font-medium">Kênh Sở Hữu</th>
                <th className="p-4 font-medium">Metadata (Tiêu đề/Tag)</th>
                <th className="p-4 font-medium">Trạng thái</th>
                <th className="p-4 font-medium text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-sm">
              {videos.map(video => (
                <tr key={video.id} className={`hover:bg-gray-750 transition group ${selectedIds.includes(video.id) ? 'bg-blue-900/10' : ''}`}>
                  <td className="p-4">
                     <input 
                        type="checkbox" 
                        checked={selectedIds.includes(video.id)}
                        onChange={() => handleSelectRow(video.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                     />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-gray-900 flex items-center justify-center text-gray-500">
                        <FileVideo className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-white max-w-[200px] truncate" title={video.filename}>{video.filename}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[150px]">{video.filePath}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                      {video.channelName ? (
                          <span className="inline-flex items-center gap-1 bg-blue-900/30 text-blue-400 px-2 py-1 rounded border border-blue-900/50 text-xs font-medium">
                              <LinkIcon className="w-3 h-3" />
                              {video.channelName}
                          </span>
                      ) : (
                          <span className="text-red-400 text-xs italic flex items-center gap-1">
                              <X className="w-3 h-3"/> Chưa gán
                          </span>
                      )}
                  </td>
                  <td className="p-4 max-w-xs">
                    {video.metadata.title ? (
                      <div>
                        <p className="text-white font-medium truncate" title={video.metadata.title}>{video.metadata.title}</p>
                        <div className="flex gap-1 mt-1 overflow-hidden">
                          {video.metadata.tags.slice(0, 3).map((t, i) => (
                            <span key={i} className="text-[10px] bg-gray-700 px-1.5 rounded text-gray-300">#{t}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleGenerateAI(video)}
                        disabled={isGenerating === video.id}
                        className="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-xs font-medium border border-purple-900/50 bg-purple-900/20 px-3 py-1.5 rounded transition"
                      >
                        {isGenerating === video.id ? (
                          <>Đang tạo...</>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            Tự động tạo AI
                          </>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${video.status === VideoStatus.PUBLISHED ? 'bg-green-100 text-green-800' : 
                        video.status === VideoStatus.SCHEDULED ? 'bg-blue-100 text-blue-800' :
                        video.status === VideoStatus.PROCESSING ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-700 text-gray-300'}`}>
                      {video.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button 
                          onClick={() => openEditModal(video)}
                          className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400"
                        >
                          <Edit3 className="w-4 h-4"/>
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Chỉnh sửa Video</h3>
              <button onClick={() => setEditingVideo(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Kênh Sở Hữu</label>
                <select 
                   value={editChannelId}
                   onChange={e => setEditChannelId(e.target.value)}
                   className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-600"
                >
                    <option value="">-- Chưa gán kênh (Orphan) --</option>
                    {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Gán video cho kênh để Lập lịch (Scheduler) nhận diện.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Tiêu đề Video</label>
                <input 
                  type="text" 
                  value={editForm.title} 
                  onChange={e => setEditForm({...editForm, title: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-600 outline-none"
                  placeholder="Tiêu đề hấp dẫn..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Mô tả</label>
                <textarea 
                  rows={5}
                  value={editForm.description}
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-600 outline-none"
                  placeholder="Nội dung mô tả..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Tags (cách nhau dấu phẩy)</label>
                <input 
                  type="text"
                  value={editForm.tags.join(', ')}
                  onChange={e => setEditForm({...editForm, tags: e.target.value.split(',').map(s => s.trim())})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              <div className="flex gap-4">
                 <div className="w-1/2">
                   <label className="block text-sm font-medium text-gray-400 mb-1">Chế độ hiển thị</label>
                   <select 
                     value={editForm.visibility}
                     onChange={e => setEditForm({...editForm, visibility: e.target.value as any})}
                     className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white outline-none"
                   >
                     <option value="public">Công khai (Public)</option>
                     <option value="private">Riêng tư (Private)</option>
                     <option value="unlisted">Không công khai (Unlisted)</option>
                   </select>
                 </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              <button 
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 text-gray-400 hover:text-white font-medium"
              >
                Hủy
              </button>
              <button 
                onClick={saveEdit}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoLibrary;
