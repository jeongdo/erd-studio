import React from 'react';
import ERDCanvas from './components/ERDCanvas';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import Inspector from './components/Inspector';
import ContextMenu from './components/ContextMenu';
import ZoomControls from './components/ZoomControls';
import { useSchemaStore } from './store/schemaStore';
import { useKeyboard } from './hooks/useKeyboard';
import { useHistory } from './hooks/useHistory';

const App: React.FC = () => {
  const { theme } = useSchemaStore();
  useKeyboard();
  useHistory();

  return (
    <div className={`app ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <Toolbar />
      <div className="main-layout">
        <Sidebar />
        <ERDCanvas />
        <Inspector />
      </div>
      <ZoomControls />
      <ContextMenu />
    </div>
  );
};

export default App;
