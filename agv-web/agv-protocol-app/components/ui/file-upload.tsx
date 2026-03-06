import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Upload, X, File } from "lucide-react"

const fileUploadVariants = cva(
  "relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input rounded-lg cursor-pointer bg-background hover:bg-accent hover:text-accent-foreground transition-colors",
  {
    variants: {
      size: {
        default: "h-32",
        sm: "h-24",
        lg: "h-40",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface FileUploadProps extends Omit<React.ComponentProps<"input">, "size" | "type"> {
  size?: "default" | "sm" | "lg"
  onFilesChange?: (files: File[]) => void
  maxFiles?: number
  acceptedTypes?: string
  maxSize?: number // in MB
  uploadText?: string
  fileTypesText?: string
}

function FileUpload({ 
  className, 
  size,
  onFilesChange,
  maxFiles = 5,
  acceptedTypes = ".pdf,.png,.jpg,.jpeg,.svg",
  maxSize = 20,
  uploadText = "Click to upload or drag and drop",
  fileTypesText,
  ...props 
}: FileUploadProps) {
  const [files, setFiles] = React.useState<File[]>([])
  const [dragActive, setDragActive] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return

    const fileArray = Array.from(newFiles)
    const validFiles = fileArray.filter(file => {
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is ${maxSize}MB.`)
        return false
      }
      return true
    })

    const updatedFiles = [...files, ...validFiles].slice(0, maxFiles)
    setFiles(updatedFiles)
    onFilesChange?.(updatedFiles)
  }

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index)
    setFiles(updatedFiles)
    onFilesChange?.(updatedFiles)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          fileUploadVariants({ size }),
          dragActive && "border-primary bg-primary/5",
          className
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          {...props}
        />
        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          {uploadText}
        </p>
        <p className="text-xs text-muted-foreground">
          {fileTypesText || `${acceptedTypes} (max ${maxSize}MB each, up to ${maxFiles} files)`}
        </p>
      </div>
      
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-destructive hover:text-destructive/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { FileUpload, fileUploadVariants }
