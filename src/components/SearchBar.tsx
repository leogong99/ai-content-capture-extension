import React, { useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { SearchFilters } from '@/types'

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void
  onClear: () => void
  placeholder?: string
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onClear,
  placeholder = 'Search captured content...',
}) => {
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})

  const handleSearch = () => {
    onSearch(query, filters)
  }

  const handleClear = () => {
    setQuery('')
    setFilters({})
    onClear()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const updateFilter = (key: keyof SearchFilters, value: string | string[] | undefined) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onSearch(query, newFilters)
  }

  return (
    <div className="search-container">
      <div className="search-bar">
        <div className="search-input-container">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="search-input"
          />
          {query && (
            <button
              onClick={handleClear}
              className="btn-clear"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="search-actions">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-filter ${showFilters ? 'active' : ''}`}
            title="Toggle filters"
          >
            <Filter size={16} />
          </button>
          <button onClick={handleSearch} className="btn-search" title="Search">
            Search
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="search-filters">
          <div className="filter-group">
            <label>Category:</label>
            <select
              value={filters.category || ''}
              onChange={e =>
                updateFilter('category', e.target.value || undefined)
              }
            >
              <option value="">All Categories</option>
              <option value="Technology">Technology</option>
              <option value="News">News</option>
              <option value="Tutorial">Tutorial</option>
              <option value="Research">Research</option>
              <option value="Shopping">Shopping</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Education">Education</option>
              <option value="General">General</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Type:</label>
            <select
              value={filters.type || ''}
              onChange={e => updateFilter('type', e.target.value || undefined)}
            >
              <option value="">All Types</option>
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="page">Page</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Date From:</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={e =>
                updateFilter('dateFrom', e.target.value || undefined)
              }
            />
          </div>

          <div className="filter-group">
            <label>Date To:</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={e =>
                updateFilter('dateTo', e.target.value || undefined)
              }
            />
          </div>

          <div className="filter-group">
            <label>Tags (comma-separated):</label>
            <input
              type="text"
              value={filters.tags?.join(', ') || ''}
              onChange={e => {
                const tags = e.target.value
                  .split(',')
                  .map(tag => tag.trim())
                  .filter(tag => tag.length > 0)
                updateFilter('tags', tags.length > 0 ? tags : undefined)
              }}
              placeholder="tag1, tag2, tag3"
            />
          </div>
        </div>
      )}
    </div>
  )
}
