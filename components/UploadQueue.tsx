
import React, { useState, useEffect, useRef } from 'react';
import { Job, Channel } from '../types';
import { Play, Pause, XCircle, RotateCw, CheckCircle2, Clock, UploadCloud, RefreshCw, Upload, AlertTriangle, ShieldAlert, Filter, Zap, FolderOpen, Trash2, Info, X, FileInput, HardDrive, FileCode, FileDown } from 'lucide-react';
import { fetchJobs, deleteJob, updateJobStatus, updateChannelAccessTokenOnly, fetchSystemSettings, fetchChannels, updateVideoYoutubeId, clearAllQueuedJobs } from '../services/supabaseService';
import { uploadVideoToYouTube, refreshAccessToken } from '../services/youtubeService';

interface UploadQueueProps {
    selectedGroupId?: string;
}

const UploadQueue: React.FC<UploadQueueProps> = ({ selectedGroupId }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Auto Upload State
  const [isAutoMode, setIsAutoMode] = useState(false);
  const sourceFilesRef = useRef<File[]>([]);
  const [loadedFilesCount, setLoadedFilesCount] = useState(0); // State for UI update
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterDays, setFilterDays] = useState(3);
  const [filterChannelId, setFilterChannelId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedJobRef = useRef<Job | null>(null);

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
    // Fetch channels for filter (Filtered by group if selected)
    const ch = await fetchChannels(selectedGroupId);
    setChannels(ch);
    
    // Fetch jobs with filters
    const jobData = await fetchJobs(filterDays, filterChannelId || null, filterStatus || null, selectedGroupId || null);
    setJobs(jobData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
        if (!uploadingJobId) {
            // Auto refresh
            fetchJobs(filterDays, filterChannelId || null, filterStatus || null, selectedGroupId || null).then(setJobs);
        }
    }, 15000);
    return () => clearInterval(interval);
  }, [uploadingJobId, filterDays, filterChannelId, filterStatus, selectedGroupId]);

  // --- AUTO UPLOAD LOGIC ---
  const toggleAutoMode = () => {
      if (isAutoMode) {
          setIsAutoMode(false);
          sourceFilesRef.current = [];
          setLoadedFilesCount(0);
      } else {
          // EXPLANATION OF BROWSER SANDBOX
          showAlert(
              "Yêu cầu cấp quyền đọc File",
              "Database đã có danh sách video, nhưng TRÌNH DUYỆT WEB không được phép tự ý đọc file từ ổ cứng của bạn vì lý do bảo mật.\n\n👉 Bạn cần chọn lại thư mục gốc (Nơi chứa tất cả video) để cấp quyền cho ứng dụng 'nắm giữ' file thực tế trong bộ nhớ tạm (RAM) để Upload."
          );
          setTimeout(() => folderInputRef.current?.click(), 2000); 
      }
  };

  const handleFolderSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
          const files = Array.from(event.target.files);
          sourceFilesRef.current = files;
          setLoadedFilesCount(files.length);
          setIsAutoMode(true);
      }
      event.target.value = '';
  };

  useEffect(() => {
      if (!isAutoMode) return;
      
      const checkDueJobs = async () => {
          if (uploadingJobId) return; // Busy

          const now = new Date();
          // Find first due job
          // Logic: Job phải là QUEUED và scheduledTime <= now
          // Sử dụng jobs từ state (đã được refresh mỗi 15s)
          
          // Sắp xếp jobs theo thời gian tăng dần để ưu tiên job cũ nhất
          // Sử dụng ISO string để sort chính xác
          const sortedJobs = [...jobs].sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
          
          const dueJob = sortedJobs.find(j => {
             const jobTime = new Date(j.scheduledTime);
             // Cho phép sai số nhỏ hoặc job quá khứ
             return j.status === 'QUEUED' && jobTime <= now;
          });

          if (dueJob) {
              console.log("Auto Mode: Found due job:", dueJob.videoTitle);
              
              // --- STRICT SMART MATCHING LOGIC ---
              const expectedFilename = dueJob.videoFilename;
              const fullDbFolderPath = dueJob.channelDefaultMetadata?.defaultFolderPath || ''; 
              
              if (!expectedFilename) return;

              // Lấy tên Folder cuối cùng từ đường dẫn DB.
              // VD: "C:\Users\Admin\Videos\KenhHaiHuoc" -> Lấy "KenhHaiHuoc"
              const folderName = fullDbFolderPath.replace(/\\/g, '/').split('/').filter(Boolean).pop();

              if (!folderName) {
                  console.warn("Auto Mode: Job missing folder config.", dueJob.id);
                  return;
              }

              // Normalized Search
              const file = sourceFilesRef.current.find(f => {
                  const browserPath = f.webkitRelativePath.replace(/\\/g, '/').toLowerCase();
                  const strictSuffix = `${folderName}/${expectedFilename}`.toLowerCase();
                  return browserPath.endsWith(strictSuffix);
              });

              if (file) {
                  console.log("Auto Mode: Found matching file:", file.webkitRelativePath);
                  await processUpload(dueJob, file);
              } else {
                  console.warn(`Auto Mode: File NOT FOUND for job ${dueJob.id}. \nLooking for suffix: [${folderName}/${expectedFilename}]`);
              }
          }
      };

      const timer = setInterval(checkDueJobs, 5000); // Check every 5s
      return () => clearInterval(timer);

  }, [isAutoMode, jobs, uploadingJobId]);

  // --- UPLOAD HANDLERS ---
  
  const processUpload = async (job: Job, file: File) => {
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
          
          // Notify (Toast) - In auto mode just log
          console.log(`Đã upload thành công: ${finalMetadata.title} (ID: ${result.id})`);

      } catch (error: any) {
          console.error("Upload Error:", error);
          let status = 'FAILED';
          let errorMessage = error.message || JSON.stringify(error);
          
          // XỬ LÝ LỖI QUOTA
          if (errorMessage.includes('exceeded the number of videos') || errorMessage.includes('QUOTA') || errorMessage.includes('quota')) {
              status = 'QUOTA_LIMIT';
              if (errorMessage.includes('exceeded the number of videos')) {
                  errorMessage = "Lỗi quá giới hạn upload trong ngày";
              }
              if (!isAutoMode) showAlert("QUOTA LIMIT", "Kênh đã đạt giới hạn upload (Quota Limit) trong ngày. Job đã được đánh dấu LIMIT.");
          } else {
              if (!isAutoMode) showAlert("Upload Thất Bại", errorMessage);
          }
          
          await updateJobStatus(job.id, status, errorMessage);
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: status as any, errorMessage: errorMessage } : j));

      } finally {
          setUploadingJobId(null);
          setUploadProgress(0);
          loadData();
      }
  }


  const handleDelete = (id: string) => {
    showConfirm("Xác nhận xóa", "Bạn có chắc muốn xóa job này không?", async () => {
        await deleteJob(id);
        loadData();
    });
  };

  const handleDownloadCleanupScript = async () => {
      setIsLoading(true);
      
      try {
          // 1. Fetch COMPLETED jobs only (regardless of current view status filter, but respecting date/channel/group)
          // We want to clean up things that are actually done.
          const completedJobs = await fetchJobs(
              filterDays || 30, // Default to 30 days lookback if filter is not set strictly
              filterChannelId || null, 
              'COMPLETED', 
              selectedGroupId || null
          );

          if (completedJobs.length === 0) {
              showAlert("Thông báo", "Không tìm thấy video nào đã hoàn thành (COMPLETED) trong khoảng thời gian này để tạo script.");
              setIsLoading(false);
              return;
          }

          // 2. Generate Batch Script Content
          // chcp 65001 to support UTF-8 (Vietnamese characters)
          let scriptContent = '@echo off\r\n';
          scriptContent += 'chcp 65001 >nul\r\n';
          scriptContent += 'echo ========================================================\r\n';
          scriptContent += 'echo   TUBEFLOW - SCRIPT XOA FILE VIDEO DA UPLOAD (COMPLETED) \r\n';
          scriptContent += 'echo ========================================================\r\n';
          scriptContent += `echo Found: ${completedJobs.length} completed jobs.\r\n`;
          scriptContent += 'echo Luu y: Script nay se xoa file vinh vien tren o cung.\r\n';
          scriptContent += 'pause\r\n\r\n';

          let count = 0;
          completedJobs.forEach(job => {
              // Construct path: use database filePath if available, else try to construct from metadata
              // Note: Database filePath is preferred as it was saved during import.
              let pathToDelete = job.videoFilePath;
              
              if (!pathToDelete && job.channelDefaultMetadata?.defaultFolderPath && job.videoFilename) {
                   // Fallback logic
                   const folder = job.channelDefaultMetadata.defaultFolderPath.endsWith('\\') || job.channelDefaultMetadata.defaultFolderPath.endsWith('/')
                       ? job.channelDefaultMetadata.defaultFolderPath
                       : job.channelDefaultMetadata.defaultFolderPath + '\\';
                   pathToDelete = folder + job.videoFilename;
              }

              if (pathToDelete) {
                  // Wrap path in quotes to handle spaces
                  scriptContent += `del "${pathToDelete}"\r\n`;
                  count++;
              }
          });

          if (count === 0) {
              scriptContent += 'echo Khong tim thay duong dan file hop le trong Database.\r\n';
          }

          scriptContent += '\r\necho.\r\necho ========================================================\r\n';
          scriptContent += 'echo   DA HOAN THANH!\r\n';
          scriptContent += 'echo ========================================================\r\n';
          scriptContent += 'pause\r\n';

          // 3. Trigger Download
          const blob = new Blob([scriptContent], { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cleanup_completed_videos_${new Date().toISOString().slice(0,10)}.bat`;
          document.body.appendChild(a);
          a.click();
          
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          showAlert("Thành công", `Đã tạo script xóa cho ${count} video!\nFile .bat đã được tải xuống máy.`);

      } catch (e: any) {
          showAlert("Lỗi", "Không thể tạo script: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  // Manual Trigger
  const handleStartUpload = (job: Job) => {
      if (job.status === 'COMPLETED') {
          showAlert("Thông báo", "Video này đã upload thành công rồi.");
          return;
      }
      if (!job.refreshToken && (!job.accessToken || (job.tokenExpiresAt && job.tokenExpiresAt < Date.now()))) {
          showAlert("Lỗi Auth", "Kênh này chưa có Refresh Token và Access Token đã hết hạn. Vui lòng kết nối lại trong quản lý Kênh.");
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
      
      selectedJobRef.current = null;
      await processUpload(job, file);
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
  
  const isJobDue = (time: string) => new Date(time) <= new Date();

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
                          {modal.type === 'CONFIRM' ? 'Hủy Bỏ' : 'Đã Hiểu'}
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
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <UploadCloud className="w-7 h-7" />
             Hàng Đợi Upload
           </h2>
           <p className="text-gray-400 text-sm mt-1">Quản lý và Tự động hóa tiến trình đẩy video</p>
        </div>
        
        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-3">
             <button 
                 onClick={handleDownloadCleanupScript}
                 className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-600 hover:bg-gray-700 text-green-400 rounded-lg text-sm transition font-medium shadow-lg"
                 title="Tải file .bat để xóa file video đã hoàn thành trên ổ cứng"
             >
                 <FileDown className="w-4 h-4" /> Tải Script Xóa File (Đã xong)
             </button>

             <button 
                onClick={toggleAutoMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold border transition
                ${isAutoMode 
                    ? 'bg-yellow-500 text-black border-yellow-400 animate-pulse' 
                    : 'bg-gray-800 text-gray-300 border-gray-600 hover:text-white'}`}
             >
                 {isAutoMode ? <Zap className="w-5 h-5 fill-black" /> : <Zap className="w-5 h-5" />}
                 {isAutoMode ? 'ĐANG TỰ ĐỘNG CHẠY...' : '⚡ Bật Auto Upload'}
             </button>
             {/* Hidden Input for Folder Select */}
             <input 
                 type="file" 
                 ref={folderInputRef} 
                 className="hidden" 
                 // @ts-ignore
                 webkitdirectory="" 
                 directory="" 
                 onChange={handleFolderSelected} 
             />
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-800 p-2 rounded-lg border border-gray-700 w-fit">
           <Filter className="w-4 h-4 text-gray-500 ml-2" />
           
           {/* Date Filter */}
           <select 
             value={filterDays} 
             onChange={e => setFilterDays(Number(e.target.value))}
             className="bg-gray-900 text-white text-sm border-gray-600 rounded p-1 outline-none"
           >
              <option value={0}>Hôm nay</option>
              <option value={1}>1 ngày gần đây</option>
              <option value={3}>3 ngày gần đây</option>
              <option value={7}>7 ngày gần đây</option>
              <option value={30}>30 ngày gần đây</option>
           </select>

           {/* Channel Filter */}
           <select 
             value={filterChannelId} 
             onChange={e => setFilterChannelId(e.target.value)}
             className="bg-gray-900 text-white text-sm border-gray-600 rounded p-1 outline-none max-w-[150px]"
           >
              <option value="">-- Tất cả kênh --</option>
              {channels.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
              ))}
           </select>

           {/* Status Filter */}
           <select 
             value={filterStatus} 
             onChange={e => setFilterStatus(e.target.value)}
             className="bg-gray-900 text-white text-sm border-gray-600 rounded p-1 outline-none max-w-[150px]"
           >
              <option value="">-- Tất cả Status --</option>
              <option value="QUEUED">QUEUED (Đang chờ)</option>
              <option value="FAILED">FAILED (Lỗi)</option>
              <option value="COMPLETED">COMPLETED (Xong)</option>
              <option value="QUOTA_LIMIT">QUOTA_LIMIT</option>
           </select>

           <button onClick={loadData} className="p-1.5 bg-gray-700 rounded hover:bg-gray-600 text-white">
             <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
           </button>
      </div>

      {isAutoMode && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 p-4 rounded-lg flex flex-col md:flex-row items-center md:items-start gap-4">
              <div className="p-3 bg-yellow-900/50 rounded-full">
                <FolderOpen className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="flex-1">
                  <h4 className="text-yellow-400 font-bold flex items-center gap-2">
                     Chế độ Auto-Upload đang bật!
                     <span className="animate-pulse w-2 h-2 rounded-full bg-red-500"></span>
                  </h4>
                  <p className="text-xs text-yellow-200/70 mb-2">
                      {selectedGroupId ? "Đang chạy giới hạn trong Profile đã chọn." : "Đang chạy cho TẤT CẢ các kênh (Cẩn thận nhầm Profile/Proxy)."}
                  </p>
                  <div className="flex gap-6 mt-2 text-sm">
                      <div className="flex flex-col">
                          <span className="text-gray-400 text-xs">Job trong hàng đợi (DB)</span>
                          <span className="text-white font-mono font-bold text-lg">{jobs.filter(j => j.status === 'QUEUED').length}</span>
                      </div>
                      <div className="w-px bg-yellow-800/50"></div>
                      <div className="flex flex-col">
                          <span className="text-gray-400 text-xs">File thực tế trong bộ nhớ (RAM)</span>
                          <span className={`font-mono font-bold text-lg flex items-center gap-2 ${loadedFilesCount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {loadedFilesCount}
                              {loadedFilesCount === 0 && <span className="text-[10px] text-red-500 bg-red-900/30 px-1 rounded">(Chưa nạp folder)</span>}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <input type="file" ref={fileInputRef} accept="video/*" className="hidden" onChange={handleFileSelected} />

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
                Không tìm thấy job nào. (Kiểm tra bộ lọc hoặc Profile)
            </div>
        ) : (
            <div className="divide-y divide-gray-700">
            {jobs.map(job => {
                const isDue = job.status === 'QUEUED' && isJobDue(job.scheduledTime);
                const expectedFolder = job.channelDefaultMetadata?.defaultFolderPath;
                
                return (
                <div key={job.id} className={`p-5 hover:bg-gray-750 transition flex items-center gap-4 ${isDue ? 'bg-blue-900/10' : ''}`}>
                    <div className="shrink-0">
                    {job.status === 'UPLOADING' && <RotateCw className="w-6 h-6 text-blue-500 animate-spin" />}
                    {job.status === 'QUEUED' && <Clock className={`w-6 h-6 ${isDue ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`} />}
                    {job.status === 'COMPLETED' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                    {job.status === 'QUOTA_LIMIT' && <ShieldAlert className="w-6 h-6 text-orange-500" />}
                    {job.status === 'FAILED' && <XCircle className="w-6 h-6 text-red-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                             <h3 className="text-white font-medium truncate" title={job.videoTitle}>{job.videoTitle}</h3>
                             {isDue && <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">DUE NOW</span>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(job.status)}`}>
                        {job.status}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-2">
                        <span className="text-gray-300 bg-gray-700 px-1.5 rounded">{job.channelName}</span>
                        {/* Format ISO to Locale String on the fly */}
                        <span>• Lịch: {new Date(job.scheduledTime).toLocaleString('vi-VN')}</span>
                        
                        {/* PATH INFO */}
                        {job.status === 'QUEUED' && (
                             <span className="flex items-center gap-1 text-gray-500 truncate max-w-[300px]" title={`${expectedFolder ? expectedFolder + '/' : ''}${job.videoFilename}`}>
                                 • Path: <span className="text-yellow-600">.../{expectedFolder ? expectedFolder.split(/[\/\\]/).pop() + '/' : ''}</span>{job.videoFilename}
                             </span>
                        )}
                        
                        {job.clientId && <span className="text-blue-400 border border-blue-900 px-1 rounded">Custom App</span>}
                    </div>
                    
                    {/* Progress Info */}
                    {(job.status === 'UPLOADING' || uploadingJobId === job.id) && (
                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: uploadingJobId === job.id ? `${uploadProgress}%` : '0%' }}></div>
                        </div>
                    )}

                    {job.errorMessage && <p className="text-xs text-red-400 mt-1">Lỗi: {job.errorMessage}</p>}
                    </div>

                    <div className="shrink-0 flex gap-2">
                    {job.status !== 'COMPLETED' && job.status !== 'UPLOADING' && (
                        <button 
                            onClick={() => handleStartUpload(job)}
                            disabled={uploadingJobId !== null || isAutoMode}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
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
            )})}
            </div>
        )}
      </div>
    </div>
  );
};

export default UploadQueue;
