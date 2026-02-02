import { useState, useEffect } from 'react';
import { useBookData } from './hooks/useBookData';
import { Reader } from './components/Reader';
import { TableOfContents } from './components/TableOfContents';
import './App.css';

function App() {
  const { chapters, loading, connected } = useBookData();
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);

  // Save reading position to localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('troy-reader-position');
    if (savedPosition) {
      const position = parseInt(savedPosition, 10);
      if (!isNaN(position) && position >= 0) {
        setCurrentChapterIndex(position);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('troy-reader-position', currentChapterIndex.toString());
  }, [currentChapterIndex]);

  // Close TOC on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tocOpen) {
        setTocOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tocOpen]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="app-empty">
        <h1>The Fall of Troy</h1>
        <p>No chapters found. Add markdown files to the troy_book1 directory.</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Connection status indicator */}
      <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
        <span className="connection-dot" />
        {connected ? 'Live' : 'Offline'}
      </div>

      <TableOfContents
        chapters={chapters}
        currentChapterIndex={currentChapterIndex}
        onSelectChapter={setCurrentChapterIndex}
        isOpen={tocOpen}
        onClose={() => setTocOpen(false)}
      />

      <Reader
        chapters={chapters}
        currentChapterIndex={currentChapterIndex}
        onChapterChange={setCurrentChapterIndex}
        onToggleToc={() => setTocOpen(true)}
      />
    </div>
  );
}

export default App;
