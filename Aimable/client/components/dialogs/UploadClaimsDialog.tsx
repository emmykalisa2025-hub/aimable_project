import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, File, AlertCircle } from "lucide-react";

interface UploadClaimsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (file: File) => void;
}

export default function UploadClaimsDialog({
  open,
  onOpenChange,
  onSubmit,
}: UploadClaimsDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>("");

  const allowedFormats = [".xlsx", ".xls", ".csv"];
  const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300 MB

  const validateFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    const isValidFormat = allowedFormats.some((format) =>
      fileName.endsWith(format)
    );

    if (!isValidFormat) {
      setError("Please upload a valid Excel or CSV file (.xlsx, .xls, or .csv)");
      return false;
    }

    // if (file.size > 10 * 1024 * 1024) {
    //   setError("File size must be less than 10MB");
    //   return false;
    // }
    
   if (file.size > MAX_FILE_SIZE) {
      setError("File size must be 300MB or less.");
      return false;
    }

    setError("");
    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleSubmit = () => {
    if (selectedFile && validateFile(selectedFile)) {
      onSubmit(selectedFile);
      setSelectedFile(null);
      setError("");
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedFile(null);
      setError("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Medical Claims</DialogTitle>
          <DialogDescription>
            Upload an Excel file with the required claim details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400"
            }`}
          >
            <input
              type="file"
              id="file-input"
              accept=".xlsx,.xls,.csv"
              onChange={handleInputChange}
              className="hidden"
            />
            <label htmlFor="file-input" className="cursor-pointer block">
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-600">
                    Excel (.xlsx, .xls) or CSV files up to 300MB
                  </p>
                </div>
              </div>
            </label>
          </div>

          {/* Selected File Display */}
          {selectedFile && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <File className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-600">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* File Format Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-900 mb-2">
              Upload Medical Claims
            </p>
            <p className="text-xs text-blue-800 mb-2">
              Accepted format: <span className="font-semibold">.xlsx / .xls / .csv</span>
            </p>
            <p className="text-xs font-semibold text-blue-900 mb-1">
              Columns required:
            </p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Voucher ID</li>
              <li>• Beneficiary Number</li>
              <li>• Age</li>
              <li>• Sex</li>
              <li>• Consultation Cost</li>
              <li>• Laboratory Cost</li>
              <li>• Medical Imaging Cost</li>
              <li>• Procedures</li>
              <li>• Medicines</li>
              <li>• Total Amount</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={handleSubmit}
            disabled={!selectedFile || !!error}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Claims
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
