import React from 'react'
import { ContentEntry, DuplicateMatch } from '@/types'
import { AlertTriangle, Merge, X, Save } from 'lucide-react'

interface DuplicateWarningProps {
  newEntry: ContentEntry
  duplicates: DuplicateMatch[]
  onMerge: (targetId: string) => void
  onSaveAnyway: () => void
  onCancel: () => void
}

export const DuplicateWarning: React.FC<DuplicateWarningProps> = ({
  newEntry: _newEntry,
  duplicates,
  onMerge,
  onSaveAnyway,
  onCancel,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const getMatchTypeColor = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return '#f44336'
      case 'url':
        return '#ff9800'
      case 'content':
        return '#2196f3'
      default:
        return '#9e9e9e'
    }
  }

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return 'Exact Duplicate'
      case 'url':
        return 'Same URL'
      case 'content':
        return 'Similar Content'
      default:
        return 'Near Duplicate'
    }
  }

  // Get the best match (highest similarity)
  const bestMatch = duplicates[0]

  return (
    <div className="duplicate-warning">
      <div className="duplicate-warning-header">
        <AlertTriangle size={20} color="#ff9800" />
        <h3>Duplicate Content Detected</h3>
      </div>

      <div className="duplicate-warning-content">
        <p className="duplicate-warning-message">
          We found {duplicates.length} similar {duplicates.length === 1 ? 'entry' : 'entries'} that
          might be duplicates:
        </p>

        {/* Show best match preview */}
        {bestMatch && (
          <div className="duplicate-match-preview">
            <div className="match-header">
              <span
                className="match-type-badge"
                style={{ backgroundColor: getMatchTypeColor(bestMatch.matchType) }}
              >
                {getMatchTypeLabel(bestMatch.matchType)}
              </span>
              <span className="similarity-score">
                {Math.round(bestMatch.similarity * 100)}% similar
              </span>
            </div>

            <div className="match-entry-preview">
              <div className="preview-title">{bestMatch.entry.title}</div>
              <div className="preview-meta">
                <span>{formatDate(bestMatch.entry.createdAt)}</span>
                <span className="preview-category">{bestMatch.entry.category}</span>
              </div>
              <div className="preview-content">
                {truncateText(bestMatch.entry.summary || bestMatch.entry.content)}
              </div>
              <div className="preview-reason">{bestMatch.reason}</div>
            </div>
          </div>
        )}

        {/* Show all matches if more than one */}
        {duplicates.length > 1 && (
          <div className="all-matches">
            <details>
              <summary>
                View all {duplicates.length} similar {duplicates.length === 1 ? 'entry' : 'entries'}
              </summary>
              <div className="matches-list">
                {duplicates.map((match) => (
                  <div key={match.entry.id} className="match-item">
                    <div className="match-item-header">
                      <span
                        className="match-type-badge small"
                        style={{ backgroundColor: getMatchTypeColor(match.matchType) }}
                      >
                        {getMatchTypeLabel(match.matchType)}
                      </span>
                      <span className="similarity-score">
                        {Math.round(match.similarity * 100)}%
                      </span>
                    </div>
                    <div className="match-item-title">{match.entry.title}</div>
                    <div className="match-item-meta">
                      {formatDate(match.entry.createdAt)} • {match.entry.category}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      <div className="duplicate-warning-actions">
        {bestMatch && (
          <button
            className="btn btn-primary"
            onClick={() => onMerge(bestMatch.entry.id)}
            title="Merge with existing entry"
          >
            <Merge size={16} />
            Merge with Existing
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={onSaveAnyway}
          title="Save as new entry anyway"
        >
          <Save size={16} />
          Save Anyway
        </button>
        <button
          className="btn btn-secondary"
          onClick={onCancel}
          title="Cancel capture"
        >
          <X size={16} />
          Cancel
        </button>
      </div>
    </div>
  )
}

