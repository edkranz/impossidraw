import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import FloorPlanCanvas from './components/FloorPlanCanvas';
import FloorPlanToolbar from './components/FloorPlanToolbar';
import Navbar from './components/Navbar';
import { FloorPlan } from './types/Room';

function App() {
  // Canvas viewport dimensions - just for the visible area
  const [canvasSize, setCanvasSize] = useState({
    width: window.innerWidth - 40,
    height: window.innerHeight - 120
  });

  // For file import - used to trigger click on the hidden file input
  const [triggerFileInput, setTriggerFileInput] = useState(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({
        width: window.innerWidth - 40,
        height: window.innerHeight - 120
      });
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Initialize with a default floor plan
  // Grid cell size determines the maximum room size
  const [floorPlan, setFloorPlan] = useState<FloorPlan>({
    gridSizeWidth: 100, // 100mm (10cm) grid width by default
    gridSizeHeight: 100, // 100mm (10cm) grid height by default
    rooms: []
  });

  // History for undo/redo
  const [history, setHistory] = useState<FloorPlan[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize history with initial floor plan
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{...floorPlan}]);
      setHistoryIndex(0);
    }
  }, [history.length, floorPlan]);

  // Define handleUndo and handleRedo using useCallback to avoid dependency issues
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setFloorPlan({...history[newIndex]});
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setFloorPlan({...history[newIndex]});
    }
  }, [historyIndex, history]);

  // Handle keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) || 
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  const addToHistory = (newFloorPlan: FloorPlan) => {
    // Cut off future history if we've gone back and made changes
    const newHistory = history.slice(0, historyIndex + 1);
    
    // Don't add to history if the floor plans are the same
    if (JSON.stringify(newHistory[newHistory.length - 1]) === JSON.stringify(newFloorPlan)) {
      return;
    }
    
    newHistory.push({...newFloorPlan});
    
    // Limit history size if needed (optional)
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const clearAll = () => {
    const newFloorPlan: FloorPlan = {
      ...floorPlan,
      rooms: []
    };
    setFloorPlan(newFloorPlan);
    addToHistory(newFloorPlan);
  };

  // Create a new project with specified grid sizes
  const createNewProject = (gridSizeWidth: number, gridSizeHeight: number) => {
    const newFloorPlan: FloorPlan = {
      gridSizeWidth,
      gridSizeHeight,
      rooms: []
    };
    setFloorPlan(newFloorPlan);
    addToHistory(newFloorPlan);
  };

  // Import a floor plan from JSON
  const importFloorPlan = (importedFloorPlan: FloorPlan) => {
    // Make sure we're setting valid values, or use defaults if needed
    const newFloorPlan: FloorPlan = {
      gridSizeWidth: importedFloorPlan.gridSizeWidth || 100,
      gridSizeHeight: importedFloorPlan.gridSizeHeight || 100,
      rooms: Array.isArray(importedFloorPlan.rooms) ? importedFloorPlan.rooms.map(room => ({
        ...room,
        gridX: room.gridX || Math.floor(room.x / (importedFloorPlan.gridSizeWidth || 100)),
        gridY: room.gridY || Math.floor(room.y / (importedFloorPlan.gridSizeHeight || 100))
      })) : []
    };
    
    setFloorPlan(newFloorPlan);
    addToHistory(newFloorPlan);
  };

  // Handler for export from navbar
  const handleExport = () => {
    const dataStr = JSON.stringify(floorPlan, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileName = `floorplan_${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  };

  // Handler for import from navbar
  const handleImport = () => {
    setTriggerFileInput(true);
  };

  // Reset trigger after it's been used
  useEffect(() => {
    if (triggerFileInput) {
      setTriggerFileInput(false);
    }
  }, [triggerFileInput]);

  return (
    <div className="App">
      <Navbar 
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={clearAll}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onExport={handleExport}
        onImport={handleImport}
      />
      <div className="canvas-container">
        <FloorPlanToolbar 
          onNewProject={createNewProject}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={clearAll}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          floorPlan={floorPlan}
          importFloorPlan={importFloorPlan}
          triggerFileInput={triggerFileInput}
        />
        <FloorPlanCanvas 
          width={canvasSize.width} 
          height={canvasSize.height}
          floorPlan={floorPlan}
          setFloorPlan={setFloorPlan}
          addToHistory={addToHistory}
        />
      </div>
    </div>
  );
}

export default App;
