import React, { useState, useRef, useEffect } from 'react';
import { FloorPlan, Room } from '../types/Room';

interface FloorPlanToolbarProps {
  onNewProject: (gridSizeWidth: number, gridSizeHeight: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  floorPlan: FloorPlan;
  importFloorPlan: (floorPlan: FloorPlan) => void;
  triggerFileInput?: boolean;
  toggleInspector: () => void;
  isInspectorVisible: boolean;
  onOpenBuilder: () => void;
}

const FloorPlanToolbar: React.FC<FloorPlanToolbarProps> = ({
  onNewProject,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  floorPlan,
  importFloorPlan,
  triggerFileInput,
  toggleInspector,
  isInspectorVisible,
  onOpenBuilder
}) => {
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [gridSizeWidth, setGridSizeWidth] = useState(1000); 
  const [gridSizeHeight, setGridSizeHeight] = useState(1000);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to handle file input trigger from Navbar
  useEffect(() => {
    if (triggerFileInput && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [triggerFileInput]);

  const handleNewProject = () => {
    onNewProject(gridSizeWidth, gridSizeHeight);
    setShowNewProjectDialog(false);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(floorPlan, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileName = `floorplan_${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content) as FloorPlan;
        importFloorPlan(parsedData);
      } catch (error) {
        alert('Failed to parse the imported file. Please ensure it is a valid floor plan JSON file.');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    
    // Reset file input value so the same file can be imported again if needed
    if (event.target) event.target.value = '';
  };

  return (
    <div className="floor-plan-toolbar">
      <div className="toolbar-section">
        <button 
          onClick={() => setShowNewProjectDialog(true)}
          className="toolbar-button" 
          title="Create New Project"
        >
          New Project
        </button>
        <button 
          onClick={onClear}
          className="toolbar-button" 
          title="Clear All Rooms"
        >
          Clear All
        </button>
        <button 
          onClick={handleExport}
          className="toolbar-button" 
          title="Export as JSON"
        >
          Export
        </button>
        <button 
          onClick={handleImportClick}
          className="toolbar-button" 
          title="Import from JSON"
        >
          Import
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".json"
          onChange={handleFileChange}
        />
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
      
      <div className="toolbar-divider"></div>
      
      <div className="toolbar-section">
        <button 
          onClick={onOpenBuilder}
          className="toolbar-button" 
          title="Open 3D Builder"
          disabled={floorPlan.rooms.length === 0}
        >
          Build 3D
        </button>
      </div>
      
      <button 
        onClick={toggleInspector}
        className="toolbar-button inspector-toggle-icon" 
        title={isInspectorVisible ? "Hide Inspector" : "Show Inspector"}
        style={{ marginLeft: 'auto' }}
      >
        ℹ️
      </button>
      
      {showNewProjectDialog && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create New Project</h3>
            <div className="form-group">
              <label>Maximum Room Width (X) (mm):</label>
              <input 
                value={gridSizeWidth} 
                onChange={(e) => setGridSizeWidth(Number(e.target.value))} 
              />
            </div>
            <div className="form-group">
              <label>Maximum Room Length (Y) (mm):</label>
              <input 
                value={gridSizeHeight} 
                onChange={(e) => setGridSizeHeight(Number(e.target.value))} 
            />
            </div>
            <div className="form-actions">
              <button onClick={handleNewProject}>Create</button>
              <button onClick={() => setShowNewProjectDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloorPlanToolbar; 