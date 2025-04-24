import React from 'react';

interface ToolbarProps {
  onAddRectangle: () => void;
  onAddCircle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onAddRectangle, 
  onAddCircle,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) => {
  return (
    <div className="drawing-toolbar">
      <div className="toolbar-section">
        <button 
          onClick={onAddRectangle} 
          className="toolbar-button" 
          title="Add Rectangle"
        >
          □
        </button>
        <button 
          onClick={onAddCircle} 
          className="toolbar-button" 
          title="Add Circle"
        >
          ○
        </button>
        <button 
          className="toolbar-button" 
          title="Add Triangle (coming soon)"
          disabled
        >
          △
        </button>
        <button 
          className="toolbar-button" 
          title="Add Star (coming soon)"
          disabled
        >
          ★
        </button>
        <button 
          className="toolbar-button" 
          title="Add Line (coming soon)"
          disabled
        >
          ╱
        </button>
        <button 
          className="toolbar-button" 
          title="Add Text (coming soon)"
          disabled
        >
          T
        </button>
      </div>
      
      <div className="toolbar-divider"></div>
      
      <div className="toolbar-section">
        <button 
          onClick={onUndo} 
          className="toolbar-button" 
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
        >
          ↩
        </button>
        <button 
          onClick={onRedo} 
          className="toolbar-button" 
          title="Redo (Ctrl+Y)"
          disabled={!canRedo}
        >
          ↪
        </button>
      </div>
    </div>
  );
};

export default Toolbar; 