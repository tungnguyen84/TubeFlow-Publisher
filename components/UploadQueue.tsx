
import React, { useState, useEffect, useRef } from 'react';
import { Job, Channel } from '../types';
import { Play, Pause, XCircle, RotateCw, CheckCircle2, Clock, UploadCloud, RefreshCw, Upload, AlertTriangle, ShieldAlert, Filter } from 'lucide-react';
import { fetchJobs, deleteJob, updateJobStatus, updateChannelAccessTokenOnly, fetchSystemSettings, fetchChannels, updateVideoYoutubeId } from '../services/supabaseService';
import { uploadVideoToYouTube, refreshAccessToken } from '../services/youtubeService';

const UploadQueue: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Filters
  const [filterDays, setFilterDays] = useState(3);
  const [filterChannelId, setFilterChannelId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedJobRef = useRef<Job | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    // Fetch channels for filter
    const ch = await fetchChannels();
    setChannels(ch);
    
    // Fetch jobs with filters
    const jobData = await fetchJobs(filterDays, filterChannelId || null);
    setJobs(jobData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
        if (!uploadingJobId) {
            fetchJobs(filterDays, filterChannelId || null).then(setJobs);
        }
    }, 15000);
    return () => clearInterval(interval);
  }, [uploadingJobId, filterDays, filterChannelId]);

  const handleDelete = async (id: string) => {
    if (confirm('Xóa job này?')) {
        await deleteJob(id);
        loadData();
    }
  };

  const handleStartUpload = (job: Job) => {
      // Cho phép thử lại cả khi lỗi Quota
      if (job.status === 'COMPLETED') {
          alert("Video này đã upload thành công rồi.");
          return;
      }
      if (!job.refreshToken && (!job.accessToken || (job.tokenExpiresAt && job.tokenExpiresAt < Date.now()))) {
          alert("Kênh này chưa có Refresh Token và Access Token đã hết hạn. Vui lòng kết nối lại trong quản lý Kênh.");
          return;
      }

      selectedJobRef.current = job;
      if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const job = selectedJobRef.current;
      if (!file || !job) return;
      event.target.value = '';

      setUploadingJobId(job.id);
      setUploadProgress(5); 
      
      try {
          // STEP 1: KIỂM TRA & REFRESH TOKEN
          let activeToken = job.accessToken;
          const isExpired = !activeToken || (job.tokenExpiresAt && job.tokenExpiresAt < Date.now() + 60000); // Buffer 1 phút

          if (isExpired) {
              if (!job.refreshToken) throw new Error("Token hết hạn và không có Refresh Token.");
              
              setUploadProgress(10); // Refreshing...
              console.log("Token expired. Refreshing...");
              
              // Xác định Client ID/Secret (Kênh riêng hoặc System)
              let clientId = job.clientId;
              let clientSecret = job.clientSecret;
              
              if (!clientId || !clientSecret) {
                  const sys = await fetchSystemSettings();
                  if (!clientId) clientId = sys.googleClientId;
              }

              if (!clientId || !clientSecret) {
                  throw new Error("Thiếu Client ID/Secret để refresh token. Hãy cập nhật cấu hình Kênh.");
              }

              const newTokenData = await refreshAccessToken(job.refreshToken, clientId, clientSecret);
              activeToken = newTokenData.access_token;
              
              // Lưu token mới vào DB để dùng lần sau
              await updateChannelAccessTokenOnly(job.channelId, activeToken!, newTokenData.expires_in);
          }

          // STEP 2: PREPARE METADATA (MERGE DEFAULTS)
          const finalMetadata = {
              title: job.videoMetadata?.title || job.channelDefaultMetadata?.title || file.name,
              description: job.videoMetadata?.description || job.channelDefaultMetadata?.description || '',
              tags: (job.videoMetadata?.tags && job.videoMetadata.tags.length > 0) 
                    ? job.videoMetadata.tags 
                    : (job.channelDefaultMetadata?.tags || []),
              visibility: job.videoMetadata?.visibility || 'private'
          };
          
          await updateJobStatus(job.id, 'UPLOADING');
          setUploadProgress(30);

          // STEP 3: UPLOAD
          const result = await uploadVideoToYouTube(activeToken!, file, finalMetadata);
          
          // STEP 4: UPDATE DB (Status & YouTube ID)
          // result.id is the YouTube Video ID
          await updateVideoYoutubeId(job.videoId, result.id);
          
          setUploadProgress(100);
          await updateJobStatus(job.id, 'COMPLETED');
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'COMPLETED', progress: 100 } : j));
          
          alert(`Đã upload: ${finalMetadata.title} (ID: ${result.id})`);

      } catch (error: any) {
          console.error("Upload Error:", error);
          let status = 'FAILED';
          
          // XỬ LÝ LỖI QUOTA
          if (error.message === 'QUOTA_EXCEEDED') {
              status = 'QUOTA_LIMIT';
              alert("Kênh đã đạt giới hạn upload (Quota Limit) trong ngày. Job đã được đánh dấu LIMIT.");
          } else {
              alert("Upload thất bại: " + error.message);
          }
          
          await updateJobStatus(job.id, status, error.message);
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: status as any, errorMessage: error.message } : j));

      } finally {
          setUploadingJobId(null);
          setUploadProgress(0);
          selectedJobRef.current = null;
          loadData();
      }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UPLOADING': return 'text-blue-400 border-blue-900/50 bg-blue-900/20';
      case 'COMPLETED': return 'text-green-400 border-green-900/50 bg-green-900/20';
      case 'FAILED': return 'text-red-400 border-red-900/50 bg-red-900/20';
      case 'QUOTA_LIMIT': return 'text-orange-400 border-orange-900/50 bg-orange-900/20';
      case 'QUEUED': return 'text-yellow-400 border-yellow-900/50 bg-yellow-900/20';
      default: return 'text-gray-400 border-gray-800 bg-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <UploadCloud className="w-7 h-7" />
             Hàng Đợi Upload
           </h2>
           <p className="text-gray-400 text-sm mt-1">Upload với Auto-Refresh Token & Fallback Metadata</p>
        </div>
        
        <div className="flex items-center gap-3 bg-gray-800 p-2 rounded-lg border border-gray-700">
           <Filter className="w-4 h-4 text-gray-500" />
           <select 
             value={filterDays} 
             onChange={e => setFilterDays(Number(e.target.value))}
             className="bg-gray-900 text-white text-sm border-gray-600 rounded p-1 outline-none"
           >
              <option value={1}>1 ngày gần đây</option>
              <option value={3}>3 ngày gần đây</option>
              <option value={7}>7 ngày gần đây</option>
              <option value={30}>30 ngày gần đây</option>
           </select>

           <select 
             value={filterChannelId} 
             onChange={e => setFilterChannelId(e.target.value)}
             className="bg-gray-900 text-white text-sm border-gray-600 rounded p-1 outline-none max-w-[150px]"
           >
              <option value="">Tất cả kênh</option>
              {channels.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
              ))}
           </select>

           <button onClick={loadData} className="p-1.5 bg-gray-700 rounded hover:bg-gray-600 text-white">
             <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      <input type="file" ref={fileInputRef} accept="video/*" className="hidden" onChange={handleFileSelected} />

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Không có job nào trong {filterDays} ngày gần đây.</div>
        ) : (
            <div className="divide-y divide-gray-700">
            {jobs.map(job => (
                <div key={job.id} className="p-5 hover:bg-gray-750 transition flex items-center gap-4">
                    <div className="shrink-0">
                    {job.status === 'UPLOADING' && <RotateCw className="w-6 h-6 text-blue-500 animate-spin" />}
                    {job.status === 'QUEUED' && <Clock className="w-6 h-6 text-yellow-500" />}
                    {job.status === 'COMPLETED' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                    {job.status === 'QUOTA_LIMIT' && <ShieldAlert className="w-6 h-6 text-orange-500" />}
                    {job.status === 'FAILED' && <XCircle className="w-6 h-6 text-red-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="text-white font-medium truncate" title={job.videoTitle}>{job.videoTitle}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(job.status)}`}>
                        {job.status}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-2">
                        <span className="text-gray-300 bg-gray-700 px-1.5 rounded">{job.channelName}</span>
                        <span>• Lịch: {job.scheduledTime}</span>
                        {job.clientId && <span className="text-blue-400 border border-blue-900 px-1 rounded">Custom App</span>}
                    </div>
                    
                    {/* Progress Info */}
                    {(job.status === 'UPLOADING' || uploadingJobId === job.id) && (
                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: uploadingJobId === job.id ? `${uploadProgress}%` : '0%' }}></div>
                        </div>
                    )}

                    {/* Metadata Check */}
                    {!job.videoMetadata?.title && job.status === 'QUEUED' && (
                        <p className="text-[10px] text-gray-500 italic mt-1">
                            * Video thiếu metadata. Sẽ dùng mặc định của kênh khi upload.
                            Title: {job.channelDefaultMetadata?.title || 'None'}
                        </p>
                    )}

                    {job.errorMessage && <p className="text-xs text-red-400 mt-1">Lỗi: {job.errorMessage}</p>}
                    </div>

                    <div className="shrink-0 flex gap-2">
                    {job.status !== 'COMPLETED' && job.status !== 'UPLOADING' && (
                        <button 
                            onClick={() => handleStartUpload(job)}
                            disabled={uploadingJobId !== null}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs font-medium rounded transition"
                        >
                            <Upload className="w-3 h-3" />
                            {(job.status === 'FAILED' || job.status === 'QUOTA_LIMIT') ? 'Thử lại' : 'Upload'}
                        </button>
                    )}
                    
                    <button onClick={() => handleDelete(job.id)} className="p-2 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400">
                        <XCircle className="w-4 h-4" />
                    </button>
                    </div>
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default UploadQueue;
