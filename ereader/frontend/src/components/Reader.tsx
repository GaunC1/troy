import { useState, useEffect, useRef, useCallback } from 'react';
import './Reader.css';

interface Chapter {
  id: string;
  title: string;
  filename: string;
  content: string;
  raw?: string;
  metadata?: Record<string, unknown>;
}

interface ReaderProps {
  chapters: Chapter[];
  currentChapterIndex: number;
  onChapterChange: (index: number) => void;
  onToggleToc: () => void;
}

export function Reader({
  chapters,
  currentChapterIndex,
  onChapterChange,
  onToggleToc,
}: ReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [paginatedContent, setPaginatedContent] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const chapter = chapters[currentChapterIndex];

  // Paginate content based on container size
  const paginateContent = useCallback(() => {
    if (!measureRef.current || !chapter?.content) {
      console.log('Cannot paginate:', { measureRef: !!measureRef.current, content: !!chapter?.content });
      return;
    }

    const container = measureRef.current;
    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;

    console.log('Container size:', { containerHeight, containerWidth });

    // If container has no height yet, show all content
    if (containerHeight < 100) {
      setPaginatedContent([chapter.content]);
      setTotalPages(1);
      setIsReady(true);
      return;
    }

    // Create a temporary element to measure text
    const tempDiv = document.createElement('div');
    tempDiv.className = 'reader-page-content';
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.width = `${containerWidth}px`;
    tempDiv.style.height = 'auto';
    tempDiv.innerHTML = chapter.content;
    document.body.appendChild(tempDiv);

    const pages: string[] = [];
    const elements = Array.from(tempDiv.children) as HTMLElement[];

    let currentPageContent = '';
    let currentHeight = 0;

    const flushPage = () => {
      if (currentPageContent.trim()) {
        pages.push(currentPageContent);
        currentPageContent = '';
        currentHeight = 0;
      }
    };

    for (const element of elements) {
      const elementHeight = element.offsetHeight;
      const marginTop = parseInt(getComputedStyle(element).marginTop) || 0;
      const marginBottom = parseInt(getComputedStyle(element).marginBottom) || 0;
      const totalHeight = elementHeight + marginTop + marginBottom;

      // If single element is larger than page, we need to split it
      if (totalHeight > containerHeight && currentPageContent === '') {
        pages.push(element.outerHTML);
        continue;
      }

      if (currentHeight + totalHeight > containerHeight) {
        flushPage();
      }

      currentPageContent += element.outerHTML;
      currentHeight += totalHeight;
    }

    flushPage();
    document.body.removeChild(tempDiv);

    // Ensure at least one page
    if (pages.length === 0) {
      pages.push(chapter.content);
    }

    console.log('Paginated into', pages.length, 'pages');
    setPaginatedContent(pages);
    setTotalPages(pages.length);
    setCurrentPage(0);
    setIsReady(true);
  }, [chapter?.content]);

  // Re-paginate on chapter change or resize
  useEffect(() => {
    setIsReady(false);
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      paginateContent();
    }, 100);

    const handleResize = () => {
      paginateContent();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [paginateContent, chapter?.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentPage(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentPage(totalPages - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages, currentPage, currentChapterIndex, chapters.length]);

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
    } else if (currentChapterIndex < chapters.length - 1) {
      onChapterChange(currentChapterIndex + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
    } else if (currentChapterIndex > 0) {
      onChapterChange(currentChapterIndex - 1);
    }
  };

  // Touch/swipe support
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    }

    touchStartX.current = null;
  };

  if (!chapter) {
    return (
      <div className="reader-container">
        <div className="reader-empty">
          <p>No chapter selected</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="reader-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <header className="reader-header">
        <button className="reader-menu-btn" onClick={onToggleToc} aria-label="Table of Contents">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
        <span className="reader-chapter-title">{chapter.title}</span>
        <span className="reader-page-indicator">
          {currentPage + 1} / {totalPages}
        </span>
      </header>

      {/* Main reading area */}
      <main className="reader-main" ref={contentRef}>
        <div className="reader-page-wrapper" ref={measureRef}>
          {isReady ? (
            <div
              className="reader-page-content"
              dangerouslySetInnerHTML={{
                __html: paginatedContent[currentPage] || chapter.content,
              }}
            />
          ) : (
            <div className="reader-loading">Loading...</div>
          )}
        </div>
      </main>

      {/* Navigation controls */}
      <div className="reader-nav">
        <button
          className="reader-nav-btn reader-nav-prev"
          onClick={goToPrevPage}
          disabled={currentPage === 0 && currentChapterIndex === 0}
          aria-label="Previous page"
        >
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        <div className="reader-tap-zone reader-tap-prev" onClick={goToPrevPage} />
        <div className="reader-tap-zone reader-tap-next" onClick={goToNextPage} />

        <button
          className="reader-nav-btn reader-nav-next"
          onClick={goToNextPage}
          disabled={currentPage === totalPages - 1 && currentChapterIndex === chapters.length - 1}
          aria-label="Next page"
        >
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="reader-progress">
        <div
          className="reader-progress-bar"
          style={{
            width: `${((currentChapterIndex * totalPages + currentPage + 1) / (chapters.length * totalPages)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
