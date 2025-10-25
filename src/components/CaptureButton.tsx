import React from 'react'
import { Globe } from 'lucide-react'

interface CaptureButtonProps {
  onCapture: () => void
  disabled?: boolean
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({
  onCapture,
  disabled = false,
}) => {
  return (
    <div className="capture-buttons">
      <button
        className="btn-capture btn-primary"
        onClick={onCapture}
        disabled={disabled}
        title="Capture entire page"
      >
        <Globe size={16} />
        <span>Capture Page</span>
      </button>
    </div>
  )
}
