
import React, { useState, useEffect } from 'react';
import { Channel, YouTubeVideoStats } from '../types';
import { Eye, ThumbsUp, MessageSquare, TrendingUp, RefreshCw, Play, BarChart2, CalendarClock, ChevronRight, Video, Users } from 'lucide-react';
import { fetchChannels, fetchSystemSettings, updateChannelStats } from '../services/supabaseService';
import { getChannelInfo, getChannelVideos } from '../services/youtubeService';

const Analytics: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelVideos, setChannelVideos] = useState<YouTubeVideoStats[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null); // Channel ID being synced
  const [apiKey, setApiKey] = useState('');

  const loadChannels = async () => {
      setIsLoading(true);
      try {
          const [chData, settings] = await Promise.all([
              fetchChannels(),
              fetchSystemSettings()
          ]);
          setChannels(chData);
          setApiKey(settings.youtubeApiKey);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      loadChannels();
  }, []);

  const handleSyncChannel = async (channel: Channel) => {
      if (!apiKey) return alert("Thiếu YouTube API Key trong Settings!");
      
      setIsSyncing(channel.id);
      try {
          // 1. Fetch updated Channel Info (Subs, Views, Video Count)
          const info = await getChannelInfo(channel.youtubeId, apiKey);
          
          if (info) {
              let finalTotalViews = 0;

              // --- FORCE CALCULATION FROM VIDEOS (USER REQUEST) ---
              // Luôn tính tổng view từ danh sách video thay vì dùng số liệu thống kê chung của kênh (có thể bị delay hoặc sai lệch)
              try {
                   const vids = await getChannelVideos(channel.youtubeId, channel.accessToken || null, apiKey);
                   const calculatedViews = vids.reduce((sum, v) => sum + v.viewCount, 0);
                   finalTotalViews = calculatedViews;
                   console.log(`Calculated total views from videos: ${calculatedViews}`);
                   
                   // Nếu video list trả về rỗng (lỗi hoặc ko có video public) mà info.totalViews > 0 thì fallback
                   if (vids.length === 0 && (info.totalViews || 0) > 0) {
                       finalTotalViews = info.totalViews || 0;
                   }
              } catch (err) {
                   console.warn("Could not calculate views from videos, falling back to channel stats:", err);
                   finalTotalViews = info.totalViews || 0;
              }

              // Save to Database
              await updateChannelStats(channel.id, {
                  subscriberCount: info.subscriberCount,
                  totalViews: finalTotalViews,
                  videoCount: info.videoCount
              });
              
              const newSyncTime = new Date().toISOString();

              // Update local state (CHANNELS LIST)
              setChannels(prev => prev.map(c => c.id === channel.id ? { 
                  ...c, 
                  subscriberCount: info.subscriberCount,
                  totalViews: finalTotalViews,
                  videoCount: info.videoCount,
                  lastStatsSync: newSyncTime
              } : c));

              // Update local state (SELECTED CHANNEL DETAIL)
              if (selectedChannel?.id === channel.id) {
                  setSelectedChannel(prev => prev ? ({
                      ...prev,
                      subscriberCount: info.subscriberCount,
                      totalViews: finalTotalViews,
                      videoCount: info.videoCount,
                      lastStatsSync: newSyncTime,
                      avatarUrl: info.thumbnailUrl || prev.avatarUrl,
                      name: info.title || prev.name
                  }) : null);
              }
              
              alert(`Cập nhật thành công!\n- Subs: ${info.subscriberCount?.toLocaleString()}\n- Views (Cộng dồn video): ${finalTotalViews?.toLocaleString()}\n- Videos: ${info.videoCount?.toLocaleString()}`);
          } else {
              alert("Không lấy được thông tin kênh. Có thể ID kênh sai hoặc kênh đã bị xóa/ẩn.");
          }
      } catch (e: any) {
          console.error(e);
          alert("Lỗi Sync (Có thể do Quota/Mạng/Sai ID): " + e.message);
      } finally {
          setIsSyncing(null);
      }
  };

  const handleSelectChannel = async (channel: Channel) => {
      setSelectedChannel(channel);
      setChannelVideos([]); // Clear old list
      setIsLoading(true);
      try {
           if (!apiKey) throw new Error("Chưa cấu hình API Key trong Settings! Vui lòng vào cài đặt.");
           
           // Fetch Video List from YouTube
           const vids = await getChannelVideos(channel.youtubeId, channel.accessToken || null, apiKey);
           setChannelVideos(vids);

           // --- CHECK & FIX LOCAL VIEW COUNT ---
           // Nếu lúc load video thấy tổng view thực tế > 0 mà channel.totalViews sai lệch -> Update DB luôn
           if (vids.length > 0) {
               const realTotalViews = vids.reduce((sum, v) => sum + v.viewCount, 0);
               // Logic: Nếu số view hiển thị (channel.totalViews) khác với tổng view thực tế (realTotalViews) thì cập nhật
               if (channel.totalViews !== realTotalViews) {
                   console.log(`Fixing views mismatch based on loaded video list: ${channel.totalViews} -> ${realTotalViews}`);
                   await updateChannelStats(channel.id, { totalViews: realTotalViews });
                   
                   // Update UI immediately
                   setSelectedChannel(prev => prev ? ({ ...prev, totalViews: realTotalViews }) : null);
                   setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, totalViews: realTotalViews } : c));
               }
           }

      } catch (e: any) {
          console.error(e);
          alert("Lỗi tải danh sách video: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const checkSyncNeeded = (lastSync?: string) => {
      if (!lastSync) return true;
      const last = new Date(lastSync).getTime();
      const now = Date.now();
      const hoursDiff = (now - last) / (1000 * 60 * 60);
      return hoursDiff >= 24;
  };

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <BarChart2 className="w-6 h-6 text-purple-500" />
             Analytics & Channel Stats
           </h2>
           <p className="text-gray-400 text-sm mt-1">Cập nhật số liệu kênh & danh sách video (24h/lần)</p>
        </div>
        <button onClick={loadChannels} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg border border-gray-700">
             <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* LEFT: CHANNEL LIST */}
          <div className="lg:col-span-4 bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                  <h3 className="font-bold text-white">Danh sách Kênh</h3>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                  {channels.map(ch => {
                      const needsSync = checkSyncNeeded(ch.lastStatsSync);
                      return (
                        <div 
                            key={ch.id} 
                            onClick={() => handleSelectChannel(ch)}
                            className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-3 relative overflow-hidden
                            ${selectedChannel?.id === ch.id ? 'bg-purple-900/20 border-purple-500' : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}
                        >
                            <img src={ch.avatarUrl} className="w-10 h-10 rounded-full border border-gray-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <h4 className="text-white font-bold truncate">{ch.name}</h4>
                                <div className="flex gap-3 text-xs text-gray-400">
                                    <span className="flex items-center gap-1"><Users className="w-3 h-3"/> {ch.subscriberCount?.toLocaleString() || 0}</span>
                                    <span className="flex items-center gap-1"><Eye className="w-3 h-3"/> {ch.totalViews?.toLocaleString() || 0}</span>
                                </div>
                            </div>
                            
                            {/* Status Indicator */}
                            <div className="flex flex-col items-end gap-1">
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                                {needsSync && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleSyncChannel(ch); }}
                                        disabled={isSyncing === ch.id}
                                        className="text-[10px] bg-yellow-900/50 text-yellow-500 border border-yellow-800 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-yellow-900"
                                        title="Dữ liệu cũ > 24h. Bấm để cập nhật."
                                    >
                                        <RefreshCw className={`w-3 h-3 ${isSyncing === ch.id ? 'animate-spin' : ''}`} />
                                        Update
                                    </button>
                                )}
                            </div>
                        </div>
                      )
                  })}
              </div>
          </div>

          {/* RIGHT: CHANNEL DETAIL & VIDEOS */}
          <div className="lg:col-span-8 bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden">
              {selectedChannel ? (
                  <>
                      {/* Header Detail */}
                      <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800 shrink-0">
                          <div className="flex justify-between items-start">
                              <div className="flex items-center gap-4">
                                  <img src={selectedChannel.avatarUrl} className="w-16 h-16 rounded-full border-2 border-purple-500 shadow-lg" />
                                  <div>
                                      <h2 className="text-2xl font-bold text-white">{selectedChannel.name}</h2>
                                      <p className="text-gray-400 text-sm">Last Sync: {selectedChannel.lastStatsSync ? new Date(selectedChannel.lastStatsSync).toLocaleString('vi-VN') : 'Chưa cập nhật'}</p>
                                  </div>
                              </div>
                              <button 
                                  onClick={() => handleSyncChannel(selectedChannel)}
                                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
                                  disabled={isSyncing === selectedChannel.id}
                              >
                                  <RefreshCw className={`w-4 h-4 ${isSyncing === selectedChannel.id ? 'animate-spin' : ''}`} />
                                  Sync Data Now
                              </button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 mt-6">
                              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                  <div className="flex items-center gap-2 text-gray-400 mb-1 text-xs font-bold uppercase">
                                      <Users className="w-4 h-4 text-red-500" /> Subscribers
                                  </div>
                                  <span className="text-2xl font-bold text-white">{selectedChannel.subscriberCount?.toLocaleString() || 0}</span>
                              </div>
                              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                  <div className="flex items-center gap-2 text-gray-400 mb-1 text-xs font-bold uppercase">
                                      <Eye className="w-4 h-4 text-blue-500" /> Total Views
                                  </div>
                                  <span className="text-2xl font-bold text-white">{selectedChannel.totalViews?.toLocaleString() || 0}</span>
                              </div>
                              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                  <div className="flex items-center gap-2 text-gray-400 mb-1 text-xs font-bold uppercase">
                                      <Video className="w-4 h-4 text-green-500" /> Total Videos
                                  </div>
                                  <span className="text-2xl font-bold text-white">{selectedChannel.videoCount?.toLocaleString() || 0}</span>
                              </div>
                          </div>
                      </div>

                      {/* Video List Table */}
                      <div className="flex-1 overflow-y-auto p-0 bg-gray-900">
                          {isLoading && channelVideos.length === 0 ? (
                              <div className="flex items-center justify-center h-40 text-gray-400">
                                  <RefreshCw className="w-6 h-6 animate-spin mr-2"/> Đang tải danh sách video...
                              </div>
                          ) : (
                             <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-950 text-gray-400 text-xs uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 border-b border-gray-800">Video</th>
                                        <th className="p-4 border-b border-gray-800">Views</th>
                                        <th className="p-4 border-b border-gray-800">Likes</th>
                                        <th className="p-4 border-b border-gray-800">Comments</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 text-sm">
                                    {channelVideos.length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-gray-500">
                                            Không tìm thấy video nào. <br/>
                                            (Có thể do lỗi API Quota hoặc Kênh chưa có video public)
                                        </td></tr>
                                    ) : (
                                        channelVideos.map(vid => (
                                            <tr key={vid.id} className="hover:bg-gray-800">
                                                <td className="p-4">
                                                    <div className="flex gap-3">
                                                        <img src={vid.thumbnailUrl} className="w-16 h-9 object-cover rounded bg-gray-800" />
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-white truncate max-w-[300px]" title={vid.title}>{vid.title}</p>
                                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                                <CalendarClock className="w-3 h-3"/>
                                                                {new Date(vid.publishedAt).toLocaleDateString('vi-VN')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-mono text-white">
                                                    <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-gray-500"/> {vid.viewCount.toLocaleString()}</span>
                                                </td>
                                                <td className="p-4 font-mono text-white">
                                                    <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3 text-gray-500"/> {vid.likeCount.toLocaleString()}</span>
                                                </td>
                                                <td className="p-4 font-mono text-white">
                                                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-gray-500"/> {vid.commentCount.toLocaleString()}</span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                             </table>
                          )}
                      </div>
                  </>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                      <BarChart2 className="w-16 h-16 mb-4 text-gray-700" />
                      <p>Chọn một kênh bên trái để xem chi tiết</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default Analytics;
