import React from 'react';
import { useSchemaStore } from '../store/schemaStore';

const Sidebar: React.FC = () => {
  const { schemaData, currentView, setCurrentView, searchTerm, setSearchTerm } = useSchemaStore();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value.toLowerCase());
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">Views</div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search tables..."
          value={searchTerm}
          onChange={handleSearch}
        />
      </div>
      <div className="sidebar-list">
        {Object.keys(schemaData).map(key => (
          <div
            key={key}
            className={`sidebar-item ${currentView === key ? 'active' : ''}`}
            onClick={() => setCurrentView(key)}
          >
            <div className="item-icon" />
            <span>{schemaData[key].name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
