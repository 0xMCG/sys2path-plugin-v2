// 上传UI组件
import React, { useState } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { uploadDataSources, type UploadProgress } from '../../services/upload-service';

interface UploadButtonProps {
  selectedIds: string[];
  onUploadStart?: (ids: string[]) => void;
  onUploadProgress?: (id: string, progress: number) => void;
  onUploadComplete?: (ids: string[], success: boolean) => void;
}

export const UploadButton: React.FC<UploadButtonProps> = ({
  selectedIds,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleUpload = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one data source to upload');
      return;
    }

    setIsUploading(true);
    setProgress(null);
    setResult(null);
    
    onUploadStart?.(selectedIds);

    try {
      const uploadResult = await uploadDataSources(
        selectedIds, 
        (progress) => {
          setProgress(progress);
        },
        (id, itemProgress) => {
          onUploadProgress?.(id, itemProgress);
        }
      );

      setResult({
        success: uploadResult.success,
        message: uploadResult.message,
      });

      onUploadComplete?.(selectedIds, uploadResult.success);
    } catch (error) {
      console.error('[UPLOAD] Upload error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setIsUploading(false);
      // 清除结果消息（3秒后）
      setTimeout(() => {
        setResult(null);
        setProgress(null);
      }, 3000);
    }
  };

  if (result) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        {result.success ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-green-600">{result.message}</span>
          </>
        ) : (
          <>
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600">{result.message}</span>
          </>
        )}
      </div>
    );
  }

  if (isUploading && progress) {
    const percentage = progress.total > 0 
      ? Math.round((progress.completed / progress.total) * 100) 
      : 0;

    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        <div className="flex-1 min-w-[120px]">
          <div className="text-xs text-gray-600 mb-1">
            {progress.current ? (
              <span className="truncate">{progress.current}</span>
            ) : (
              <span>Uploading...</span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {progress.completed} / {progress.total}
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleUpload}
      disabled={selectedIds.length === 0 || isUploading}
      className="flex items-center justify-center w-8 h-8 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={selectedIds.length > 0 
        ? `Upload ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''}`
        : 'Upload to Server'}
    >
      <Upload className="w-4 h-4" />
    </button>
  );
};

