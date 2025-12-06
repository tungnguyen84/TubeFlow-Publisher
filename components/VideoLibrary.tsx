
import React, { useState, useEffect, useRef } from 'react';
import { VideoItem, VideoStatus, VideoMetadata, Channel } from '../types';
import { FileVideo, Sparkles, Calendar, MoreVertical, Edit3, X, Save, Upload, RefreshCw, Link as LinkIcon, Filter, Search } from 'lucide-react';
import { generateVideoMetadata } from '../services/geminiService';
import { fetchVideos, saveVideo, updateVideoMetadata, fetchChannels } from '../services/supabaseService';

const VideoLibrary: React.FC = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filters
  const [filterChannelId, setFilterChannelId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFolder, setFilterFolder] = useState('');
  const [limit, setLimit] = useState<number>(10);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState<VideoMetadata>({
    title: '', description: '', tags: [], visibility: 'private'
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [v, c] = await Promise.all([
          fetchVideos({ 
            channelId: filterChannelId, 
            status: filterStatus, 
            folder: filterFolder,
            limit: limit
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
  }, [filterChannelId, filterStatus, limit]); // Reload when select filters change. Folder search manual trigger

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    setIsLoading(true);
    const files = Array.from(e.target.files) as File[];
    
    for (const file of files) {
      const videoEntry: Partial<VideoItem> = {
        filename: file.name,
        filePath: `C:\\Videos\\${file.name}`, 
        resolution: '1080p',
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
  };

  const openEditModal = (video: VideoItem) => {
    setEditingVideo(video);
    setEditForm({ ...video.metadata });
  };

  const saveEdit = async () => {
    if (!editingVideo) return;
    await updateVideoMetadata(editingVideo.id, editForm);
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
      alert("Lỗi khi gọi Gemini API.");
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-white">Thư viện Video</h2>
           <p className="text-gray-400 text-sm mt-1">{videos.length} videos được tìm thấy</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
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
                <th className="p-4 font-medium">Tên File & Đường Dẫn</th>
                <th className="p-4 font-medium">Kênh Sở Hữu</th>
                <th className="p-4 font-medium">Metadata (Tiêu đề/Tag)</th>
                <th className="p-4 font-medium">Trạng thái</th>
                <th className="p-4 font-medium text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-sm">
              {videos.map(video => (
                <tr key={video.id} className="hover:bg-gray-750 transition group">
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
                          <span className="text-gray-600 text-xs italic">-- Tự do --</span>
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
              <h3 className="text-xl font-bold text-white">Chỉnh sửa Metadata</h3>
              <button onClick={() => setEditingVideo(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
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
