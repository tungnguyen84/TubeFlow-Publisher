
import React, { useState, useEffect } from 'react';
import { VideoItem, Channel, ScheduleTemplate, TimeSlot } from '../types';
import { Calendar as CalendarIcon, Clock, Check, Plus, RefreshCw, Lock, Trash2, PlayCircle, Zap, Layers, Calculator, Save, Sparkles, Globe } from 'lucide-react';
import { fetchVideos, fetchChannels, createJob, fetchScheduleTemplates, saveScheduleTemplate, deleteScheduleTemplate, updateChannelTemplate } from '../services/supabaseService';
import { getBestUploadTimes } from '../services/geminiService';

const Scheduler: React.FC = () => {
  const [mode, setMode] = useState<'MANUAL' | 'AUTO_SHORTS'>('MANUAL');
  
  // COMMON DATA
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // MANUAL MODE STATE
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [manualDate, setManualDate] = useState<string>('');
  const [manualTime, setManualTime] = useState<string>('12:00');
  const [manualSuccessMsg, setManualSuccessMsg] = useState('');

  // AUTO SHORTS MODE STATE
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  
  // Template Form
  const [tempName, setTempName] = useState('');
  const [tempCycle, setTempCycle] = useState(1); // 1 day
  const [tempSlots, setTempSlots] = useState<TimeSlot[]>([{ time: '09:00', count: 1 }]);
  
  // AI Suggestion State
  const [aiCountry, setAiCountry] = useState('Vietnam');
  const [aiNiche, setAiNiche] = useState('Entertainment');
  const [isSuggesting, setIsSuggesting] = useState(false);
  
  // Selection for Auto
  const [autoSelectedChannels, setAutoSelectedChannels] = useState<string[]>([]);
  const [autoStartDate, setAutoStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const [v, c, t] = await Promise.all([fetchVideos(), fetchChannels(), fetchScheduleTemplates()]);
    setVideos(v);
    setChannels(c);
    setTemplates(t);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- MANUAL MODE HANDLERS ---
  const currentVideo = videos.find(v => v.id === selectedVideo);

  useEffect(() => {
      if (mode === 'MANUAL' && currentVideo && currentVideo.channelId) {
          setSelectedChannels([currentVideo.channelId]);
      }
  }, [selectedVideo, mode]);

  const handleManualToggleChannel = (id: string) => {
    if (currentVideo?.channelId && currentVideo.channelId !== id) {
        alert(`Video này thuộc về kênh "${currentVideo.channelName}". Không thể chọn kênh khác.`);
        return;
    }
    if (currentVideo?.channelId && currentVideo.channelId === id) return;

    if (selectedChannels.includes(id)) {
      setSelectedChannels(selectedChannels.filter(c => c !== id));
    } else {
      setSelectedChannels([...selectedChannels, id]);
    }
  };

  const handleManualSchedule = async () => {
    if (!selectedVideo || selectedChannels.length === 0 || !manualDate) {
      alert("Vui lòng chọn Video, Kênh và Ngày giờ.");
      return;
    }
    try {
      const scheduledDateTime = new Date(`${manualDate}T${manualTime}`).toISOString();
      for (const channelId of selectedChannels) {
        await createJob({
           videoId: selectedVideo,
           channelId: channelId,
           scheduledTime: scheduledDateTime
        });
      }
      setManualSuccessMsg(`Đã tạo lịch thủ công thành công!`);
      setTimeout(() => {
          setManualSuccessMsg('');
          setSelectedVideo('');
          setSelectedChannels([]);
      }, 3000);
    } catch (error) {
       alert("Lỗi tạo job: " + error);
    }
  };

  // --- AUTO SHORTS HANDLERS ---
  const handleAddSlot = () => setTempSlots([...tempSlots, { time: '12:00', count: 1 }]);
  
  const handleRemoveSlot = (index: number) => {
      const newSlots = [...tempSlots];
      newSlots.splice(index, 1);
      setTempSlots(newSlots);
  };

  const handleSlotChange = (index: number, field: keyof TimeSlot, value: any) => {
      const newSlots = [...tempSlots];
      // @ts-ignore
      newSlots[index][field] = value;
      setTempSlots(newSlots);
  };

  const handleSaveTemplate = async () => {
      if (!tempName) return alert("Nhập tên lịch!");
      if (tempSlots.length === 0) return alert("Thêm ít nhất 1 khung giờ!");
      
      try {
          await saveScheduleTemplate({
              name: tempName,
              cycleDays: tempCycle,
              timeSlots: tempSlots
          });
          const t = await fetchScheduleTemplates();
          setTemplates(t);
          setTempName('');
          alert("Đã lưu Template!");
      } catch (e: any) {
          alert("Lỗi lưu template: " + e.message);
      }
  };

  const handleDeleteTemplate = async (id: string) => {
      if (confirm("Xóa lịch mẫu này?")) {
          await deleteScheduleTemplate(id);
          const t = await fetchScheduleTemplates();
          setTemplates(t);
          if (currentTemplateId === id) setCurrentTemplateId(null);
      }
  };

  const loadTemplateToForm = (t: ScheduleTemplate) => {
      setCurrentTemplateId(t.id);
      setTempName(t.name);
      setTempCycle(t.cycleDays);
      setTempSlots(t.timeSlots);
      
      // Highlight channels using this template
      const linkedChannels = channels.filter(c => c.currentTemplateId === t.id).map(c => c.id);
      setAutoSelectedChannels(linkedChannels);
  };

  const handleAutoToggleChannel = (id: string) => {
      if (autoSelectedChannels.includes(id)) {
          setAutoSelectedChannels(autoSelectedChannels.filter(c => c !== id));
      } else {
          setAutoSelectedChannels([...autoSelectedChannels, id]);
      }
  };
  
  // --- AI SUGGEST ---
  const handleAiSuggest = async () => {
      setIsSuggesting(true);
      try {
          const result = await getBestUploadTimes(aiCountry, aiNiche);
          if (result && result.timeSlots) {
              const newSlots = result.timeSlots.map(time => ({ time, count: 1 }));
              setTempSlots(newSlots);
              alert(`AI đã gợi ý ${newSlots.length} khung giờ vàng tại ${aiCountry}!`);
          } else {
              alert("AI chưa tìm thấy gợi ý phù hợp. Hãy thử lại.");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsSuggesting(false);
      }
  };

  // --- LOGIC TÍNH TOÁN & GENERATE ---
  const getDraftVideosForChannel = (channelId: string) => {
      return videos
        .filter(v => v.channelId === channelId && v.status === 'DRAFT')
        .sort((a, b) => a.filename.localeCompare(b.filename)); // A-Z
  };

  const calculateEndDate = (channelId: string) => {
      const drafts = getDraftVideosForChannel(channelId);
      const totalVideos = drafts.length;
      if (totalVideos === 0) return "Hết video";

      const videosPerCycle = tempSlots.reduce((sum, slot) => sum + Number(slot.count), 0);
      if (videosPerCycle === 0) return "Lỗi config";

      // Số chu kỳ cần = ceil(total / perCycle)
      const cyclesNeeded = Math.ceil(totalVideos / videosPerCycle);
      const daysNeeded = cyclesNeeded * tempCycle;
      
      const endDate = new Date(autoStartDate);
      endDate.setDate(endDate.getDate() + daysNeeded);
      return endDate.toLocaleDateString('vi-VN');
  };

  const handleGenerateSchedule = async () => {
      if (autoSelectedChannels.length === 0) return alert("Chọn ít nhất 1 kênh!");
      if (tempSlots.length === 0) return alert("Chưa cấu hình khung giờ!");
      
      setIsGenerating(true);
      try {
          let totalJobs = 0;

          // Duyệt qua từng kênh được chọn
          for (const channelId of autoSelectedChannels) {
              // 1. Cập nhật binding template cho kênh
              if (currentTemplateId) {
                 await updateChannelTemplate(channelId, currentTemplateId);
              }

              // 2. Tạo jobs
              const channelVideos = getDraftVideosForChannel(channelId);
              if (channelVideos.length === 0) continue;

              let videoIndex = 0;
              let currentDate = new Date(autoStartDate); // Bắt đầu từ ngày chọn

              // Loop cho đến khi hết video
              while (videoIndex < channelVideos.length) {
                  // Trong 1 ngày (active day của cycle), duyệt qua các slot
                  for (const slot of tempSlots) {
                      const count = Number(slot.count);
                      for (let k = 0; k < count; k++) {
                          if (videoIndex >= channelVideos.length) break;

                          const video = channelVideos[videoIndex];
                          const scheduleTime = new Date(currentDate);
                          const [hour, minute] = slot.time.split(':').map(Number);
                          scheduleTime.setHours(hour, minute, 0, 0);

                          await createJob({
                              videoId: video.id,
                              channelId: channelId,
                              scheduledTime: scheduleTime.toISOString()
                          });
                          
                          videoIndex++;
                          totalJobs++;
                      }
                  }
                  // Nhảy cóc theo cycle
                  currentDate.setDate(currentDate.getDate() + tempCycle);
              }
          }

          alert(`Đã tạo thành công ${totalJobs} jobs! Kênh đã được liên kết với lịch.`);
          loadData(); 
          setAutoSelectedChannels([]);

      } catch (e: any) {
          alert("Lỗi generate: " + e.message);
      } finally {
          setIsGenerating(false);
      }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* HEADER & TABS */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
           <CalendarIcon className="w-6 h-6 text-blue-500" />
           Lập Lịch Đăng Bài
        </h2>
        <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
            <button 
                onClick={() => setMode('MANUAL')}
                className={`px-4 py-2 rounded text-sm font-medium transition ${mode === 'MANUAL' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
                Video Dài / Thủ Công
            </button>
            <button 
                onClick={() => setMode('AUTO_SHORTS')}
                className={`px-4 py-2 rounded text-sm font-medium transition flex items-center gap-2 ${mode === 'AUTO_SHORTS' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
                <Zap className="w-4 h-4" />
                Auto Shorts
            </button>
        </div>
      </div>

      {/* --- CONTENT: MANUAL MODE --- */}
      {mode === 'MANUAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                {/* 1. Video Selector */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-medium text-white mb-4">1. Chọn Video Nguồn</h3>
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
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-500">{vid.duration}</p>
                                {vid.channelName && (
                                    <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 rounded border border-blue-800">
                                        {vid.channelName}
                                    </span>
                                )}
                            </div>
                        </div>
                        </div>
                        {selectedVideo === vid.id && <Check className="w-5 h-5 text-blue-500 shrink-0" />}
                    </div>
                    ))}
                </div>
                </div>

                {/* 2. Channel Selector */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-medium text-white mb-4">2. Chọn Kênh Đích</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {channels.map(ch => {
                        const isLocked = currentVideo?.channelId && currentVideo.channelId !== ch.id;
                        return (
                            <label 
                                key={ch.id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition
                                ${isLocked ? 'opacity-40 cursor-not-allowed bg-gray-900 border-gray-800' : 'cursor-pointer'}
                                ${selectedChannels.includes(ch.id!) && !isLocked
                                    ? 'bg-green-900/20 border-green-600' 
                                    : (!isLocked ? 'bg-gray-900 border-gray-700 hover:bg-gray-800' : '')}`}
                            >
                                <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={selectedChannels.includes(ch.id!)}
                                    onChange={() => handleManualToggleChannel(ch.id!)}
                                    disabled={!!isLocked}
                                />
                                <img src={ch.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                                <span className="text-white font-medium">{ch.name}</span>
                                </div>
                                
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center
                                ${selectedChannels.includes(ch.id!) ? 'bg-green-500 border-transparent' : 'border-gray-600'}`}>
                                {selectedChannels.includes(ch.id!) && <Check className="w-3 h-3 text-white" />}
                                {isLocked && <Lock className="w-3 h-3 text-gray-500" />}
                                </div>
                            </label>
                        );
                    })}
                </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 sticky top-6">
                <h3 className="text-lg font-medium text-white mb-6">3. Cấu Hình Thời Gian</h3>
                <div className="space-y-4">
                    <div>
                    <label className="block text-sm text-gray-400 mb-2">Ngày đăng</label>
                    <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                    <label className="block text-sm text-gray-400 mb-2">Giờ đăng</label>
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-500" />
                        <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    </div>
                    <div className="pt-4 border-t border-gray-700">
                    <button 
                        onClick={handleManualSchedule}
                        disabled={!selectedVideo || selectedChannels.length === 0 || !manualDate}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Tạo Lịch Đăng
                    </button>
                    {manualSuccessMsg && <div className="mt-4 p-3 bg-green-900/30 border border-green-800 rounded text-green-400 text-sm text-center">{manualSuccessMsg}</div>}
                    </div>
                </div>
                </div>
            </div>
        </div>
      )}

      {/* --- CONTENT: AUTO SHORTS MODE --- */}
      {mode === 'AUTO_SHORTS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
              {/* COL 1: Template Management (3 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                  <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Layers className="w-5 h-5 text-purple-500" />
                          1. Cấu hình Lịch Mẫu
                      </h3>
                      
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs text-gray-400 uppercase font-bold">Tên Lịch</label>
                              <input 
                                value={tempName} 
                                onChange={e => setTempName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white mt-1" 
                                placeholder="VD: Lịch Short Dày Đặc" 
                              />
                          </div>

                          <div>
                              <label className="text-xs text-gray-400 uppercase font-bold">Chu Kỳ Đăng</label>
                              <select 
                                value={tempCycle} 
                                onChange={e => setTempCycle(Number(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white mt-1"
                              >
                                  <option value={1}>Hàng ngày (1 ngày/lần)</option>
                                  <option value={2}>Cách 1 ngày (2 ngày/lần)</option>
                                  <option value={3}>Cách 2 ngày (3 ngày/lần)</option>
                                  <option value={4}>Cách 3 ngày (4 ngày/lần)</option>
                                  <option value={5}>Cách 4 ngày (5 ngày/lần)</option>
                                  <option value={7}>Mỗi tuần 1 lần (7 ngày)</option>
                                  <option value={30}>Mỗi tháng 1 lần (30 ngày)</option>
                              </select>
                          </div>

                          {/* AI SUGGESTION BOX */}
                          <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded p-3 space-y-2">
                              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase">
                                  <Sparkles className="w-3 h-3" /> AI Gợi Ý Giờ Vàng
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  <select value={aiCountry} onChange={e => setAiCountry(e.target.value)} className="bg-gray-900 border border-gray-600 rounded text-xs p-1 text-white">
                                      <option value="Vietnam">Vietnam</option>
                                      <option value="United States">USA</option>
                                      <option value="Japan">Japan</option>
                                      <option value="South Korea">Korea</option>
                                      <option value="Global">Global</option>
                                  </select>
                                  <input value={aiNiche} onChange={e => setAiNiche(e.target.value)} placeholder="Topic..." className="bg-gray-900 border border-gray-600 rounded text-xs p-1 text-white" />
                              </div>
                              <button 
                                onClick={handleAiSuggest} 
                                disabled={isSuggesting}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1"
                              >
                                  {isSuggesting ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Globe className="w-3 h-3"/>}
                                  {isSuggesting ? 'Analyzing...' : 'Phân tích Data'}
                              </button>
                          </div>

                          <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-xs text-gray-400 uppercase font-bold">Khung Giờ & Số Lượng</label>
                                <button onClick={handleAddSlot} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-white flex items-center gap-1">
                                    <Plus className="w-3 h-3"/> Thêm
                                </button>
                              </div>
                              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                  {tempSlots.map((slot, idx) => (
                                      <div key={idx} className="flex gap-2 items-center">
                                          <input 
                                            type="time" 
                                            value={slot.time} 
                                            onChange={e => handleSlotChange(idx, 'time', e.target.value)}
                                            className="bg-gray-900 border border-gray-600 rounded p-1 text-white text-sm" 
                                          />
                                          <div className="flex items-center gap-1 bg-gray-900 border border-gray-600 rounded px-2 py-1">
                                              <span className="text-gray-400 text-xs">SL:</span>
                                              <input 
                                                type="number" 
                                                min="1" 
                                                value={slot.count} 
                                                onChange={e => handleSlotChange(idx, 'count', e.target.value)}
                                                className="w-10 bg-transparent text-white text-sm text-center outline-none" 
                                              />
                                          </div>
                                          <button onClick={() => handleRemoveSlot(idx)} className="text-red-400 hover:text-red-300">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          </div>

                          <button onClick={handleSaveTemplate} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-bold flex items-center justify-center gap-2">
                              <Save className="w-4 h-4" /> Lưu Lịch Mẫu
                          </button>
                      </div>
                  </div>

                  {/* List Saved Templates */}
                  <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 p-5 overflow-y-auto">
                       <h4 className="text-sm font-bold text-gray-400 mb-3">Lịch Mẫu Đã Lưu</h4>
                       <div className="space-y-2">
                           {templates.map(t => (
                               <div key={t.id} className={`group flex justify-between items-center bg-gray-900 p-3 rounded border hover:border-purple-500 cursor-pointer ${currentTemplateId === t.id ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-700'}`} onClick={() => loadTemplateToForm(t)}>
                                   <div>
                                       <p className="font-bold text-white text-sm">{t.name}</p>
                                       <p className="text-xs text-gray-500">Chu kỳ: {t.cycleDays} ngày • {t.timeSlots.length} khung giờ</p>
                                   </div>
                                   <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="text-gray-600 hover:text-red-400 p-1">
                                       <Trash2 className="w-4 h-4" />
                                   </button>
                               </div>
                           ))}
                           {templates.length === 0 && <p className="text-xs text-gray-600 text-center py-4">Chưa có mẫu nào</p>}
                       </div>
                  </div>
              </div>

              {/* COL 2: Channel Selection (4 cols) */}
              <div className="lg:col-span-4 bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500" />
                      2. Chọn Kênh Áp Dụng
                  </h3>
                  <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                      {channels.map(ch => {
                          const draftCount = getDraftVideosForChannel(ch.id).length;
                          const selected = autoSelectedChannels.includes(ch.id);
                          // Check if this channel is bound to current selected template
                          const isBoundToCurrentTemplate = currentTemplateId && ch.currentTemplateId === currentTemplateId;

                          return (
                              <div 
                                key={ch.id} 
                                onClick={() => handleAutoToggleChannel(ch.id)}
                                className={`flex items-center justify-between p-3 rounded border cursor-pointer transition relative
                                ${selected ? 'bg-green-900/20 border-green-500' : 'bg-gray-900 border-gray-700 hover:bg-gray-800'}`}
                              >
                                  <div className="flex items-center gap-3">
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? 'bg-green-500 border-transparent' : 'border-gray-500'}`}>
                                          {selected && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold text-white flex items-center gap-2">
                                              {ch.name}
                                              {isBoundToCurrentTemplate && <span className="text-[10px] bg-purple-900 text-purple-300 px-1 rounded">Linked</span>}
                                          </p>
                                          <p className="text-xs text-gray-400">{draftCount} video sẵn sàng (DRAFT)</p>
                                      </div>
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              </div>

              {/* COL 3: Preview & Generate (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                  <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 flex-1">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Calculator className="w-5 h-5 text-blue-400" />
                          3. Dự Tính & Kích Hoạt
                      </h3>
                      
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs text-gray-400 uppercase font-bold">Ngày Bắt Đầu</label>
                              <input 
                                type="date" 
                                value={autoStartDate} 
                                onChange={e => setAutoStartDate(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white mt-1" 
                              />
                          </div>
                          
                          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-3">
                              <h4 className="text-sm font-bold text-gray-300 border-b border-gray-700 pb-2">Thông tin dự kiến</h4>
                              {autoSelectedChannels.length === 0 ? (
                                  <p className="text-xs text-gray-500 italic">Chưa chọn kênh nào...</p>
                              ) : (
                                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                      {autoSelectedChannels.map(cid => {
                                          const c = channels.find(x => x.id === cid);
                                          const endDate = calculateEndDate(cid);
                                          return (
                                              <div key={cid} className="flex justify-between text-xs">
                                                  <span className="text-gray-400">{c?.name}:</span>
                                                  <span className={`font-mono ${endDate === 'Hết video' ? 'text-red-400' : 'text-green-400'}`}>
                                                      {endDate === 'Hết video' ? '0 Video' : `Hết ngày: ${endDate}`}
                                                  </span>
                                              </div>
                                          )
                                      })}
                                  </div>
                              )}
                          </div>
                          
                          <div className="text-xs text-gray-500 italic border-l-2 border-gray-600 pl-2">
                              Hệ thống sẽ tự động lấy video DRAFT của từng kênh (A-Z) và điền vào lịch theo cấu hình bên trái.
                          </div>

                          <button 
                              onClick={handleGenerateSchedule}
                              disabled={isGenerating || autoSelectedChannels.length === 0}
                              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg flex flex-col items-center justify-center gap-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              {isGenerating ? (
                                  <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin"/> Đang xử lý...</span>
                              ) : (
                                  <>
                                    <span className="flex items-center gap-2 text-lg"><PlayCircle className="w-5 h-5" /> KÍCH HOẠT LỊCH</span>
                                    <span className="text-xs font-normal opacity-80">Tự động tạo Job cho các kênh đã chọn</span>
                                  </>
                              )}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Scheduler;
