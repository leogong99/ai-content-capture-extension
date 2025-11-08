import React from 'react'
import { ContentEntry } from '@/types'
import { Calendar, Tag, ExternalLink, Trash2, Eye } from 'lucide-react'

interface ContentCardProps {
  entry: ContentEntry
  onDelete: (id: string) => void
  onView: (entry: ContentEntry) => void
}

export const ContentCard: React.FC<ContentCardProps> = ({
  entry,
  onDelete,
  onView,
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

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <div className="content-card">
      <div className="content-card-header">
        <h3 className="content-card-title" title={entry.title}>
          {truncateText(entry.title, 60)}
        </h3>
        <div className="content-card-actions">
          <button
            className="btn-icon"
            onClick={() => onView(entry)}
            title="View details"
          >
            <Eye size={16} />
          </button>
          <button
            className="btn-icon btn-danger"
            onClick={() => onDelete(entry.id)}
            title="Delete entry"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="content-card-body">
        <div className="content-card-content">
          {entry.type === 'image' || entry.content.startsWith('data:image/') ? (
            <div className="image-preview">
              <img
                src={entry.metadata?.imageUrl || entry.content}
                alt={entry.metadata?.altText || 'Captured image'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  objectFit: 'contain',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
                onError={e => {
                  console.error('Image failed to load:', e)
                  console.log('Entry type:', entry.type)
                  console.log(
                    'Image src:',
                    entry.metadata?.imageUrl || entry.content
                  )
                  console.log(
                    'Image src length:',
                    (entry.metadata?.imageUrl || entry.content)?.length
                  )
                  console.log(
                    'Image src preview:',
                    (entry.metadata?.imageUrl || entry.content)?.substring(
                      0,
                      100
                    )
                  )
                  e.currentTarget.style.display = 'none'
                }}
                onLoad={() => {
                  console.log('Image loaded successfully')
                }}
              />
            </div>
          ) : (
            <div>
              <p className="content-text">{truncateText(entry.content)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="content-card-footer">
        <div className="content-card-meta">
          <div className="meta-item">
            <Calendar size={14} />
            <span>{formatDate(entry.createdAt)}</span>
          </div>
          <div className="meta-item">
            <span className="category-badge">{entry.category}</span>
          </div>
          <div className="meta-item">
            <span className="type-badge">{entry.type}</span>
          </div>
        </div>

        {entry.tags.length > 0 && (
          <div className="content-card-tags">
            <Tag size={14} />
            <div className="tags">
              {entry.tags.slice(0, 3).map((tag, index) => (
                <span key={index} className="tag">
                  {tag}
                </span>
              ))}
              {entry.tags.length > 3 && (
                <span className="tag-more">+{entry.tags.length - 3}</span>
              )}
            </div>
          </div>
        )}

        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="content-card-link"
        >
          <ExternalLink size={14} />
          <span>View Source</span>
        </a>
      </div>
    </div>
  )
}