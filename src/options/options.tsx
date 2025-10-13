import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionSettings, AIConfig, StorageConfig, UserAgreement } from '@/types';
import UserAgreementComponent from '@/components/UserAgreement';
import { 
  Brain, 
  Database, 
  Palette, 
  Save, 
  RotateCcw,
  Download,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  Shield
} from 'lucide-react';

const Options: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>({
    ai: {
      provider: 'local',
      enabled: true
    },
    storage: {
      maxEntries: 1000,
      autoCleanup: true,
      exportFormat: 'json'
    },
    theme: 'auto',
    userAgreement: {
      hasAgreed: false,
      version: '1.0'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAgreement, setShowAgreement] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response.success) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      setSettings({
        ai: {
          provider: 'local',
          enabled: true
        },
        storage: {
          maxEntries: 1000,
          autoCleanup: true,
          exportFormat: 'json'
        },
        theme: 'auto',
        userAgreement: {
          hasAgreed: false,
          version: '1.0'
        }
      });
    }
  };

  const handleShowAgreement = () => {
    setShowAgreement(true);
  };

  const handleAgreementAgree = async () => {
    try {
      const agreement: UserAgreement = {
        hasAgreed: true,
        agreedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      setSettings(prev => ({
        ...prev,
        userAgreement: agreement
      }));
      
      setShowAgreement(false);
      setMessage({ type: 'success', text: 'User agreement accepted!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save user agreement:', error);
      setMessage({ type: 'error', text: 'Failed to save user agreement' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const updateAISettings = (updates: Partial<AIConfig>) => {
    setSettings(prev => ({
      ...prev,
      ai: { ...prev.ai, ...updates }
    }));
  };

  const updateStorageSettings = (updates: Partial<StorageConfig>) => {
    setSettings(prev => ({
      ...prev,
      storage: { ...prev.storage, ...updates }
    }));
  };

  const handleExport = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'exportData' });
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai-content-capture-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Data exported successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setMessage({ type: 'error', text: 'Export failed' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await chrome.runtime.sendMessage({ action: 'importData', data });
          setMessage({ type: 'success', text: 'Data imported successfully!' });
          setTimeout(() => setMessage(null), 3000);
        } catch (error) {
          console.error('Import failed:', error);
          setMessage({ type: 'error', text: 'Failed to import data. Please check the file format.' });
          setTimeout(() => setMessage(null), 3000);
        }
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all captured content? This action cannot be undone.')) {
      try {
        await chrome.runtime.sendMessage({ action: 'clearAllData' });
        setMessage({ type: 'success', text: 'All data cleared successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Clear all failed:', error);
        setMessage({ type: 'error', text: 'Failed to clear data' });
        setTimeout(() => setMessage(null), 3000);
      }
    }
  };

  if (loading) {
    return (
      <div className="options-container">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="options-container">
      <UserAgreementComponent
        isOpen={showAgreement}
        onClose={() => setShowAgreement(false)}
        onAgree={handleAgreementAgree}
        showAsModal={true}
      />
      
      <div className="options-header">
        <h1>AI Content Capture Settings</h1>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={resetSettings}
            title="Reset to defaults"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            className="btn btn-primary"
            onClick={saveSettings}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="options-content">
        <div className="settings-section">
          <div className="section-header">
            <Brain size={20} />
            <h2>AI Configuration</h2>
          </div>
          <div className="section-content">
            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.ai.enabled}
                  onChange={(e) => updateAISettings({ enabled: e.target.checked })}
                />
                <span>Enable AI processing</span>
              </label>
              <p className="setting-description">
                When enabled, captured content will be automatically categorized and tagged using AI.
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">AI Provider</label>
              <select
                value={settings.ai.provider}
                onChange={(e) => updateAISettings({ provider: e.target.value as 'openai' | 'local' })}
                disabled={!settings.ai.enabled}
              >
                <option value="local">Local Processing (Default)</option>
                <option value="openai">OpenAI API</option>
              </select>
              <p className="setting-description">
                Local processing uses built-in heuristics. OpenAI provides more accurate results but requires an API key.
              </p>
            </div>

            {settings.ai.provider === 'openai' && (
              <div className="setting-group">
                <label className="setting-label">OpenAI API Key</label>
                <input
                  type="password"
                  value={settings.ai.apiKey || ''}
                  onChange={(e) => updateAISettings({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="api-key-input"
                />
                <p className="setting-description">
                  Your OpenAI API key. This is stored locally and never shared.
                </p>
              </div>
            )}

            {settings.ai.provider === 'openai' && (
              <div className="setting-group">
                <label className="setting-label">Model</label>
                <select
                  value={settings.ai.model || 'gpt-3.5-turbo'}
                  onChange={(e) => updateAISettings({ model: e.target.value })}
                >
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
                <p className="setting-description">
                  Choose the OpenAI model to use for content processing.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <Database size={20} />
            <h2>Storage Settings</h2>
          </div>
          <div className="section-content">
            <div className="setting-group">
              <label className="setting-label">Maximum Entries</label>
              <input
                type="number"
                value={settings.storage.maxEntries}
                onChange={(e) => updateStorageSettings({ maxEntries: parseInt(e.target.value) || 1000 })}
                min="100"
                max="10000"
                step="100"
              />
              <p className="setting-description">
                Maximum number of entries to store. Older entries will be automatically removed when this limit is reached.
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.storage.autoCleanup}
                  onChange={(e) => updateStorageSettings({ autoCleanup: e.target.checked })}
                />
                <span>Enable automatic cleanup</span>
              </label>
              <p className="setting-description">
                Automatically remove oldest entries when storage limit is reached.
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">Export Format</label>
              <select
                value={settings.storage.exportFormat}
                onChange={(e) => updateStorageSettings({ exportFormat: e.target.value as 'json' | 'csv' })}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
              <p className="setting-description">
                Default format for data export.
              </p>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <Palette size={20} />
            <h2>Appearance</h2>
          </div>
          <div className="section-content">
            <div className="setting-group">
              <label className="setting-label">Theme</label>
              <select
                value={settings.theme}
                onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' | 'auto' }))}
              >
                <option value="auto">Auto (System)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <p className="setting-description">
                Choose your preferred theme. Auto will follow your system settings.
              </p>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <Shield size={20} />
            <h2>User Agreement & Privacy</h2>
          </div>
          <div className="section-content">
            <div className="setting-group">
              <div className="agreement-status">
                <div className="agreement-info">
                  <h3>Privacy & Data Usage</h3>
                  <p>
                    This extension respects your privacy. All data is stored locally on your device. 
                    No personal information is collected or transmitted to external servers unless you 
                    choose to use OpenAI features with your own API key.
                  </p>
                  <div className="agreement-status-indicator">
                    <span className={`status-badge ${settings.userAgreement.hasAgreed ? 'agreed' : 'pending'}`}>
                      {settings.userAgreement.hasAgreed ? 'Agreed' : 'Pending Agreement'}
                    </span>
                    {settings.userAgreement.hasAgreed && settings.userAgreement.agreedAt && (
                      <span className="agreement-date">
                        Agreed on: {new Date(settings.userAgreement.agreedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleShowAgreement}
                >
                  <Shield size={16} />
                  {settings.userAgreement.hasAgreed ? 'View Agreement' : 'Review Agreement'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <Database size={20} />
            <h2>Data Management</h2>
          </div>
          <div className="section-content">
            <div className="data-actions">
              <button
                className="btn btn-secondary"
                onClick={handleExport}
                title="Export all captured content"
              >
                <Download size={16} />
                Export Data
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleImport}
                title="Import captured content from file"
              >
                <Upload size={16} />
                Import Data
              </button>
              <button
                className="btn btn-danger"
                onClick={handleClearAll}
                title="Delete all captured content"
              >
                <Trash2 size={16} />
                Clear All Data
              </button>
            </div>
            <p className="setting-description">
              Export your data for backup or import data from another installation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Initialize the options page
const container = document.getElementById('options-root');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
