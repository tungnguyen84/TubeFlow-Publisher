import React, { useState, useEffect } from 'react';
import { VideoItem, Channel } from '../types';
import { Calendar as CalendarIcon, Clock, Check, Plus, RefreshCw } from 'lucide-react';
import { fetchVideos, fetchChannels, createJob } from '../services/supabaseService';

const Scheduler: React.FC = () => {
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('12:00');
  
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const [v, c] = await Promise.all([fetchVideos(), fetchChannels()]);
    setVideos(v);
    setChannels(c);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleChannel = (id: string) => {
    if (selectedChannels.includes(id)) {
      setSelectedChannels(selectedChannels.filter(c => c !== id));
    } else {
      setSelectedChannels([...selectedChannels, id]);
    }
  };

  const handleSchedule = async () => {
    if (!selectedVideo || selectedChannels.length === 0 || !date) {
      alert("Vui lòng chọn Video, ít nhất 1 Kênh, và Ngày giờ.");
      return;
    }

    try {
      const scheduledDateTime = new Date(`${date}T${time}`).toISOString();
      
      // Tạo job cho từng kênh được chọn
      for (const channelId of selectedChannels) {
        await createJob({
           videoId: selectedVideo,
           channelId: channelId,
           scheduledTime: scheduledDateTime
        });
      }

      setSuccessMsg(`Đã tạo lịch đăng cho ${selectedChannels.length} kênh thành công!`);
      
      setTimeout(() => {
        setSuccessMsg('');
        setSelectedVideo('');
        setSelectedChannels([]);
        setDate('');
      }, 3000);

    } catch (error) {
       alert("Lỗi tạo job: " + error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      {/* Left Col: Source Selection */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-500" />
            Lập Lịch Đăng Bài
            </h2>
            <button onClick={loadData} className="text-gray-400 hover:text-white">
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
        </div>

        {/* Video Selector */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-medium text-white mb-4">1. Chọn Video Nguồn</h3>
          {videos.length === 0 ? (
             <p className="text-gray-500 text-sm">Chưa có video. Vào thư viện để thêm.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
                {videos.map(vid => (
                <div 
                    key={vid.id}
                    onClick={() => setSelectedVideo(vid.id!)}
                    className={`p-4 rounded-lg border cursor-pointer transition flex items-center justify-between
                    ${selectedVideo === vid.id 
                        ? 'bg-blue-900/30 border-blue-500 ring-1 ring-blue-500' 
                        : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 shrink-0 bg-gray-800 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-500">VID</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">{vid.metadata.title || vid.filename}</p>
                        <p className="text-xs text-gray-500">{vid.duration}</p>
                    </div>
                    </div>
                    {selectedVideo === vid.id && <Check className="w-5 h-5 text-blue-500 shrink-0" />}
                </div>
                ))}
            </div>
          )}
        </div>

        {/* Channel Selector */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-medium text-white mb-4">2. Chọn Kênh Đích</h3>
          {channels.length === 0 ? (
             <p className="text-gray-500 text-sm">Chưa có kênh. Vào quản lý kênh để thêm.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {channels.map(ch => (
                <label 
                    key={ch.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition
                    ${selectedChannels.includes(ch.id!) 
                        ? 'bg-green-900/20 border-green-600' 
                        : 'bg-gray-900 border-gray-700 hover:bg-gray-800'}`}
                >
                    <div className="flex items-center gap-3">
                    <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={selectedChannels.includes(ch.id!)}
                        onChange={() => handleToggleChannel(ch.id!)}
                    />
                    <img src={ch.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                    <span className="text-white font-medium">{ch.name}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center
                    ${selectedChannels.includes(ch.id!) ? 'bg-green-500 border-transparent' : 'border-gray-600'}`}>
                    {selectedChannels.includes(ch.id!) && <Check className="w-3 h-3 text-white" />}
                    </div>
                </label>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Col: Time & Confirm */}
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 sticky top-6">
          <h3 className="text-lg font-medium text-white mb-6">3. Cấu Hình Thời Gian</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Ngày đăng</label>
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Giờ đăng</label>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                <input 
                  type="time" 
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
               <div className="flex justify-between text-sm mb-2">
                 <span className="text-gray-400">Video:</span>
                 <span className="text-white">{selectedVideo ? 'Đã chọn' : 'Chưa chọn'}</span>
               </div>
               <div className="flex justify-between text-sm mb-4">
                 <span className="text-gray-400">Kênh:</span>
                 <span className="text-white">{selectedChannels.length} kênh</span>
               </div>

               <button 
                 onClick={handleSchedule}
                 disabled={!selectedVideo || selectedChannels.length === 0 || !date}
                 className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold transition shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
               >
                 <Plus className="w-5 h-5" />
                 Tạo Lịch Đăng
               </button>

               {successMsg && (
                 <div className="mt-4 p-3 bg-green-900/30 border border-green-800 rounded text-green-400 text-sm text-center animate-pulse">
                   {successMsg}
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scheduler;