import React, { useState } from 'react';
import logo from '../assets/impossidraw.png';

interface NavbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport?: () => void;
  onImport?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  onUndo, 
  onRedo, 
  onClear,
  canUndo,
  canRedo,
  onExport,
  onImport
}) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);

  const toggleFileMenu = () => {
    setFileMenuOpen(!fileMenuOpen);
    setEditMenuOpen(false);
  };

  const toggleEditMenu = () => {
    setEditMenuOpen(!editMenuOpen);
    setFileMenuOpen(false);
  };

  const closeMenus = () => {
    setFileMenuOpen(false);
    setEditMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src={logo} alt="Impossidraw Logo" className="app-logo" />
        <h4>Impossidraw!</h4>
      </div>
      <div className="navbar-menu">
        <div className="menu-item">
          <button onClick={toggleFileMenu} className="menu-button">File</button>
          {fileMenuOpen && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => { closeMenus(); }}>
                <span className="item-icon">📄</span>
                <span>New</span>
              </button>
              {onImport && (
                <button className="dropdown-item" onClick={() => { closeMenus(); onImport(); }}>
                  <span className="item-icon">📂</span>
                  <span>Import</span>
                </button>
              )}
              {onExport && (
                <button className="dropdown-item" onClick={() => { closeMenus(); onExport(); }}>
                  <span className="item-icon">💾</span>
                  <span>Export</span>
                </button>
              )}
              <button className="dropdown-item" onClick={() => { closeMenus(); onClear(); }}>
                <span className="item-icon">🗑️</span>
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>
        <div className="menu-item">
          <button onClick={toggleEditMenu} className="menu-button">Edit</button>
          {editMenuOpen && (
            <div className="dropdown-menu">
              <button 
                className="dropdown-item" 
                onClick={() => { closeMenus(); onUndo(); }}
                disabled={!canUndo}
              >
                <span className="item-icon">↩️</span>
                <span>Undo</span>
                <span className="shortcut">Ctrl+Z</span>
              </button>
              <button 
                className="dropdown-item"
                onClick={() => { closeMenus(); onRedo(); }}
                disabled={!canRedo}
              >
                <span className="item-icon">↪️</span>
                <span>Redo</span>
                <span className="shortcut">Ctrl+Y</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 