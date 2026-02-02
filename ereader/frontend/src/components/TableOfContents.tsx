import './TableOfContents.css';

interface Chapter {
  id: string;
  title: string;
  filename: string;
  content: string;
  raw?: string;
  metadata?: Record<string, unknown>;
}

interface TableOfContentsProps {
  chapters: Chapter[];
  currentChapterIndex: number;
  onSelectChapter: (index: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function TableOfContents({
  chapters,
  currentChapterIndex,
  onSelectChapter,
  isOpen,
  onClose,
}: TableOfContentsProps) {
  const handleChapterClick = (index: number) => {
    onSelectChapter(index);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`toc-backdrop ${isOpen ? 'toc-backdrop--open' : ''}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className={`toc-sidebar ${isOpen ? 'toc-sidebar--open' : ''}`}>
        <header className="toc-header">
          <h2 className="toc-title">Contents</h2>
          <button className="toc-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </header>

        <div className="toc-book-info">
          <h1 className="toc-book-title">The Fall of Troy</h1>
          <p className="toc-book-subtitle">Book One: The Gathering Storm</p>
        </div>

        <nav className="toc-nav">
          <ul className="toc-list">
            {chapters.map((chapter, index) => (
              <li key={chapter.id} className="toc-item">
                <button
                  className={`toc-link ${index === currentChapterIndex ? 'toc-link--active' : ''}`}
                  onClick={() => handleChapterClick(index)}
                >
                  <span className="toc-chapter-number">Chapter {index + 1}</span>
                  <span className="toc-chapter-title">{chapter.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <footer className="toc-footer">
          <div className="toc-progress-info">
            <span>Progress</span>
            <span>
              {currentChapterIndex + 1} of {chapters.length} chapters
            </span>
          </div>
          <div className="toc-progress-bar-container">
            <div
              className="toc-progress-bar"
              style={{
                width: `${((currentChapterIndex + 1) / chapters.length) * 100}%`,
              }}
            />
          </div>
        </footer>
      </aside>
    </>
  );
}
