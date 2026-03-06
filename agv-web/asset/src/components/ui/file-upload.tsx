import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

export interface FileUploadProps {
  label: string;
  onFileSelect: (file: File | null) => void;
  selectedFile?: File | null;
  accept?: string;
  className?: string;
  placeholder?: string;
}

const FileUpload = React.forwardRef<HTMLInputElement, FileUploadProps>(
  ({ label, onFileSelect, selectedFile, accept, className, placeholder }, ref) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null;
      onFileSelect(file);
    };

    const handleRemoveFile = () => {
      onFileSelect(null);
      // Reset the input value
      if (ref && typeof ref === 'object' && ref.current) {
        ref.current.value = '';
      }
    };

    return (
      <div className={cn("space-y-3", className)}>
        <label className="text-sm font-medium text-white">{label}</label>
        <div className="relative">
          <input
            ref={ref}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
            id={`file-upload-${label.replace(/\s+/g, '-').toLowerCase()}`}
          />
          <div className="flex w-full rounded-md border border-white bg-transparent px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <div className="flex flex-col gap-3 justify-between w-full">
              <span className="text-white/70 truncate">
                {selectedFile ? selectedFile.name : placeholder || "No file selected"}
              </span>
              <div className="flex items-center gap-2">
                {selectedFile && (
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Remove
                  </button>
                )}
                <label
                  htmlFor={`file-upload-${label.replace(/\s+/g, '-').toLowerCase()}`}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-white text-black rounded text-sm font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Add file
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

FileUpload.displayName = "FileUpload";

export { FileUpload };
