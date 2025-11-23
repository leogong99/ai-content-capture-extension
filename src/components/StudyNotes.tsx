import React, { useState } from 'react'
import { StudyNotes as StudyNotesType } from '@/types'
import { BookOpen, HelpCircle, CheckSquare, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface StudyNotesProps {
  studyNotes: StudyNotesType
}

export const StudyNotes: React.FC<StudyNotesProps> = ({
  studyNotes,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'keypoints' | 'questions' | 'actions'>('summary')

  return (
    <div className="study-notes-container">
      <div className="study-notes-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="study-notes-header-left">
          <Sparkles size={16} />
          <span>Study Notes</span>
          {studyNotes.generatedAt && (
            <span className="study-notes-timestamp">
              {new Date(studyNotes.generatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="study-notes-header-right">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isExpanded && (
        <div className="study-notes-content">
          <div className="study-notes-tabs">
            <button
              className={`study-notes-tab ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              <BookOpen size={14} />
              Summary
            </button>
            <button
              className={`study-notes-tab ${activeTab === 'keypoints' ? 'active' : ''}`}
              onClick={() => setActiveTab('keypoints')}
            >
              <BookOpen size={14} />
              Key Points
            </button>
            <button
              className={`study-notes-tab ${activeTab === 'questions' ? 'active' : ''}`}
              onClick={() => setActiveTab('questions')}
            >
              <HelpCircle size={14} />
              Questions
            </button>
            {studyNotes.actionItems.length > 0 && (
              <button
                className={`study-notes-tab ${activeTab === 'actions' ? 'active' : ''}`}
                onClick={() => setActiveTab('actions')}
              >
                <CheckSquare size={14} />
                Actions
              </button>
            )}
          </div>

          <div className="study-notes-panel">
            {activeTab === 'summary' && (
              <div className="study-notes-section">
                <h4>Brief Summary</h4>
                <p className="study-notes-text">{studyNotes.briefSummary}</p>
                <h4>Detailed Summary</h4>
                <p className="study-notes-text">{studyNotes.detailedSummary}</p>
              </div>
            )}

            {activeTab === 'keypoints' && (
              <div className="study-notes-section">
                <ul className="study-notes-list">
                  {studyNotes.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'questions' && (
              <div className="study-notes-section">
                <ul className="study-notes-list">
                  {studyNotes.questions.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'actions' && studyNotes.actionItems.length > 0 && (
              <div className="study-notes-section">
                <ul className="study-notes-list">
                  {studyNotes.actionItems.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

