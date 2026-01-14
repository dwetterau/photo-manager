import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { PhotoGrid } from './components/PhotoGrid';
import { PhotoList } from './components/PhotoList';
import { StatusBar } from './components/StatusBar';
import { usePhotoStore } from './store/photoStore';

function App() {
  const { viewMode, loadConfig } = usePhotoStore();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <div className="flex h-full bg-surface-950">
      {/* Sidebar - Directory management */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <Toolbar />

        {/* Photo display area - virtualized components handle their own scrolling */}
        <main className="flex-1 overflow-hidden p-4">
          {viewMode === 'grid' ? <PhotoGrid /> : <PhotoList />}
        </main>

        {/* Status bar */}
        <StatusBar />
      </div>
    </div>
  );
}

export default App;

