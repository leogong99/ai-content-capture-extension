import React, { useState } from 'react'
import { X, AlertTriangle, Shield, Eye, Database } from 'lucide-react'

interface UserAgreementProps {
  isOpen: boolean
  onClose: () => void
  onAgree: () => void
  showAsModal?: boolean
  showAsTopPanel?: boolean
}

const UserAgreement: React.FC<UserAgreementProps> = ({
  isOpen,
  onClose,
  onAgree,
  showAsModal = true,
  showAsTopPanel = false,
}) => {
  const [hasRead, setHasRead] = useState(false)

  if (!isOpen) return null

  const handleAgree = () => {
    if (hasRead) {
      onAgree()
    }
  }

  const AgreementContent = () => (
    <div className="user-agreement-content">
      <div className="agreement-header">
        <div className="agreement-icon">
          <Shield size={24} />
        </div>
        <h2>User Agreement & Privacy Notice</h2>
        <p className="agreement-subtitle">
          Please read and agree to the following terms before using this
          extension.
        </p>
      </div>

      <div className="agreement-body">
        <div className="agreement-section">
          <h3>
            <Database size={16} />
            Data Collection & Storage
          </h3>
          <ul>
            <li>
              <strong>No Data Collection:</strong> This extension does not
              collect, store, or transmit any personal data from your browsing
              activity.
            </li>
            <li>
              <strong>Local Storage Only:</strong> All captured content is
              stored locally on your device using your browser's storage system.
            </li>
            <li>
              <strong>No Tracking:</strong> We do not track your browsing
              habits, visited websites, or any personal information.
            </li>
            <li>
              <strong>No Analytics:</strong> No usage analytics or telemetry
              data is collected.
            </li>
          </ul>
        </div>

        <div className="agreement-section">
          <h3>
            <Eye size={16} />
            OpenAI API Usage (Optional)
          </h3>
          <ul>
            <li>
              <strong>Optional Feature:</strong> AI processing is completely
              optional and only works if you provide your own OpenAI API key.
            </li>
            <li>
              <strong>Your API Key:</strong> Your OpenAI API key is stored
              locally and never shared with us or any third parties.
            </li>
            <li>
              <strong>Direct Communication:</strong> When using AI features,
              your captured content is sent directly to OpenAI's servers using
              your API key.
            </li>
            <li>
              <strong>OpenAI's Privacy:</strong> Any data sent to OpenAI is
              subject to their privacy policy and terms of service.
            </li>
            <li>
              <strong>No AI by Default:</strong> If you don't provide an API
              key, no data leaves your device.
            </li>
          </ul>
        </div>

        <div className="agreement-section">
          <h3>
            <AlertTriangle size={16} />
            Important Disclaimers
          </h3>
          <ul>
            <li>
              <strong>No Responsibility:</strong> We are not responsible for any
              data loss, privacy breaches, or security issues.
            </li>
            <li>
              <strong>Use at Your Own Risk:</strong> This extension is provided
              "as is" without any warranties.
            </li>
            <li>
              <strong>Sensitive Information:</strong> Do not use this extension
              to capture sensitive, confidential, or personal information.
            </li>
            <li>
              <strong>Local Responsibility:</strong> You are responsible for the
              security and privacy of your local data.
            </li>
            <li>
              <strong>API Costs:</strong> If you use OpenAI features, you are
              responsible for any API costs incurred.
            </li>
          </ul>
        </div>

        <div className="agreement-section">
          <h3>Your Consent</h3>
          <p>
            By clicking "I Agree" below, you acknowledge that you have read and
            understood this agreement, and you agree to use this extension in
            accordance with these terms.
          </p>
        </div>
      </div>

      <div className="agreement-footer">
        <div className="agreement-checkbox">
          <label>
            <input
              type="checkbox"
              checked={hasRead}
              onChange={e => setHasRead(e.target.checked)}
            />
            <span>I have read and understood the terms above</span>
          </label>
        </div>
        <div className="agreement-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAgree}
            disabled={!hasRead}
          >
            I Agree
          </button>
        </div>
      </div>
    </div>
  )

  if (showAsTopPanel) {
    return (
      <div className="user-agreement-top-panel">
        <div className="top-panel-header">
          <div className="top-panel-title">
            <Shield size={20} />
            <span>User Agreement & Privacy Notice</span>
          </div>
          <button className="top-panel-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="top-panel-content">
          <AgreementContent />
        </div>
      </div>
    )
  }

  if (showAsModal) {
    return (
      <div className="user-agreement-modal">
        <div className="modal-overlay" onClick={onClose} />
        <div className="modal-content">
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
          <AgreementContent />
        </div>
      </div>
    )
  }

  return (
    <div className="user-agreement-inline">
      <AgreementContent />
    </div>
  )
}

export default UserAgreement
