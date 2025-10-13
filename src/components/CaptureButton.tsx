import React from 'react';
import { Image, FileText, Globe } from 'lucide-react';

interface CaptureButtonProps {
  onCapture: (type: 'text' | 'image' | 'page') => void;
  disabled?: boolean;
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({ onCapture, disabled = false }) => {
  return (
    <div className="capture-buttons">
      <button
        className="btn-capture btn-primary"
        onClick={() => onCapture('text')}
        disabled={disabled}
        title="Capture selected text"
      >
        <FileText size={16} />
        <span>Capture Text</span>
      </button>

      <button
        className="btn-capture btn-secondary"
        onClick={() => onCapture('image')}
        disabled={disabled}
        title="Capture image"
      >
        <Image size={16} />
        <span>Capture Image</span>
      </button>

      <button
        className="btn-capture btn-secondary"
        onClick={() => onCapture('page')}
        disabled={disabled}
        title="Capture entire page"
      >
        <Globe size={16} />
        <span>Capture Page</span>
      </button>

    </div>
  );
};
