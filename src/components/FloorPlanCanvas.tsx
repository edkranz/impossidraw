import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Group, Line, Rect } from 'react-konva';
import { Room as RoomType, Portal as PortalType, FloorPlan } from '../types/Room';
import Room from './shapes/Room';
import { v4 as uuidv4 } from 'uuid';
import Konva from 'konva';
import '../styles/FloorPlanCanvas.css';
import { useGesture } from '@use-gesture/react';

interface FloorPlanCanvasProps {
  width: number;  // Viewport width
  height: number; // Viewport height
  floorPlan: FloorPlan;
  setFloorPlan: React.Dispatch<React.SetStateAction<FloorPlan>>;
  addToHistory: (floorPlan: FloorPlan) => void;
}

const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({ 
  width, 
  height, 
  floorPlan, 
  setFloorPlan, 
  addToHistory 
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectingPortals, setConnectingPortals] = useState<{ roomId: string, portalId: string } | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef<Konva.Stage>(null);
  const [isDraggingRoom, setIsDraggingRoom] = useState(false);
  const [isPlacingRoom, setIsPlacingRoom] = useState(false);
  const [previewRoomPosition, setPreviewRoomPosition] = useState({ gridX: 0, gridY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize canvas position to center
  useEffect(() => {
    setPosition({ x: width / 2, y: height / 2 });
  }, [width, height]);

  // Prevent default wheel behavior on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const preventDefaultWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    
    container.addEventListener('wheel', preventDefaultWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', preventDefaultWheel);
    };
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
        deleteRoom(selectedId);
      }
      
      // Cancel room placement mode when pressing Escape
      if (isPlacingRoom && e.key === 'Escape') {
        setIsPlacingRoom(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId, floorPlan, isPlacingRoom]);

  // Add body class to prevent scrolling
  useEffect(() => {
    document.body.classList.add('using-floor-plan');
    
    return () => {
      document.body.classList.remove('using-floor-plan');
    };
  }, []);

  // Use Gesture Hook for handling pan and pinch gestures
  useGesture(
    {
      // Handle pinch to zoom
      onPinch: ({ origin: [ox, oy], first, movement: [ms], offset: [scale], memo }) => {
        if (isDraggingRoom) return;
        
        if (first) {
          // Get the position of the stage container
          const stage = stageRef.current;
          if (!stage) return;
          
          const stageRect = stage.container().getBoundingClientRect();
          
          // Calculate the point under the pinch in stage coordinates
          const x = ox - stageRect.left;
          const y = oy - stageRect.top;
          
          // Store the point in scene coordinates (accounting for current pan and zoom)
          memo = {
            x: (x - position.x) / scale,
            y: (y - position.y) / scale
          };
        }
        
        // Limit min/max scale
        const newScale = Math.max(0.1, Math.min(5, scale));
        
        // Calculate new position to zoom toward pinch point
        const newPos = {
          x: ox - memo.x * newScale,
          y: oy - memo.y * newScale
        };
        
        setScale(newScale);
        setPosition(newPos);
        
        return memo;
      },
      
      // Handle mouse wheel and trackpad gestures
      onWheel: ({ event, delta: [dx, dy], offset: [, scrollY], pinching, touches }) => {
        if (pinching || isDraggingRoom) return;
        
        event.preventDefault();
        
        // Check if this is a trackpad two-finger pan (typical for Mac trackpads)
        // On most trackpads, horizontal scroll (dx) indicates intentional panning
        const isTrackpadPan = Math.abs(dx) > 0 || (event.ctrlKey === false && touches === 0);
        
        const stage = stageRef.current;
        if (!stage) return;
        
        // If it's a trackpad pan gesture, handle panning
        if (isTrackpadPan) {
          setPosition(prev => ({
            x: prev.x - dx,
            y: prev.y - dy
          }));
          return;
        }
        
        // Otherwise, handle as zoom
        const oldScale = scale;
        const pointer = stage.getPointerPosition();
        
        if (!pointer) return;
        
        const mousePointTo = {
          x: (pointer.x - position.x) / oldScale,
          y: (pointer.y - position.y) / oldScale,
        };
        
        // Calculate new scale
        const zoomFactor = 1.1;
        const newScale = dy > 0 ? oldScale / zoomFactor : oldScale * zoomFactor;
        
        // Limit min/max scale
        const limitedScale = Math.max(0.1, Math.min(5, newScale));
        
        // Calculate new position - keeps zoom centered on mouse pointer
        const newPos = {
          x: pointer.x - mousePointTo.x * limitedScale,
          y: pointer.y - mousePointTo.y * limitedScale,
        };
        
        setScale(limitedScale);
        setPosition(newPos);
      }
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      pinch: {
        distanceBounds: { min: 0 },
        scaleBounds: { min: 0.1, max: 5 },
        rubberband: true
      }
    }
  );

  // Handle room mouse events
  const handleSelect = (id: string) => {
    // Cancel room placement if we click on an existing room
    if (isPlacingRoom) {
      setIsPlacingRoom(false);
    }
    
    setSelectedId(id);
  };

  const handleDeselect = (e: any) => {
    // Deselect when clicking on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
      setConnectingPortals(null);
      
      // Room placement is now handled by handleCanvasClick
    }
  };

  // Set flags to prevent canvas from moving when dragging rooms
  const handleRoomDragStart = () => {
    setIsDraggingRoom(true);
  };

  const handleRoomDragEnd = (e: Konva.KonvaEventObject<DragEvent>, roomId: string) => {
    const room = floorPlan.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Reset the dragging flag
    setIsDraggingRoom(false);
    
    // Get the new position of the room after dragging
    const newX = e.target.x();
    const newY = e.target.y();
    
    // Calculate new grid position
    const newGridX = Math.round(newX / floorPlan.gridSizeWidth);
    const newGridY = Math.round(newY / floorPlan.gridSizeHeight);
    
    // Calculate snapped position
    const snappedX = newGridX * floorPlan.gridSizeWidth;
    const snappedY = newGridY * floorPlan.gridSizeHeight;
    
    // Check if there's already a room at this new grid position (excluding the current room)
    const isOccupied = floorPlan.rooms.some(
      r => r.id !== roomId && r.gridX === newGridX && r.gridY === newGridY
    );
    
    if (isOccupied) {
      // If occupied, revert to original position
      e.target.position({
        x: room.x,
        y: room.y
      });
      return;
    }
    
    // Update room position with snapped values
    const updatedRooms = floorPlan.rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          x: snappedX,
          y: snappedY,
          gridX: newGridX,
          gridY: newGridY
        };
      }
      return r;
    });
    
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: updatedRooms
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
  };

  const updateRoomPosition = (id: string, newX: number, newY: number, gridX: number, gridY: number) => {
    // Check if any room already occupies this grid cell
    const roomInCell = floorPlan.rooms.find(room => 
      room.id !== id && room.gridX === gridX && room.gridY === gridY
    );
    
    if (roomInCell) {
      // If a room already exists in this cell, don't update position
      alert(`Cannot place room here - cell is already occupied by ${roomInCell.name}`);
      
      // Return to its previous position
      const currentRoom = floorPlan.rooms.find(room => room.id === id);
      if (currentRoom) {
        const prevX = currentRoom.gridX * floorPlan.gridSizeWidth;
        const prevY = currentRoom.gridY * floorPlan.gridSizeHeight;
        
        // Update the visual position without changing grid coordinates
        const updatedRooms = floorPlan.rooms.map((room) => {
          if (room.id === id) {
            return {
              ...room,
              x: prevX,
              y: prevY,
            };
          }
          return room;
        });
        
        setFloorPlan({
          ...floorPlan,
          rooms: updatedRooms
        });
      }
      return;
    }
    
    const updatedRooms = floorPlan.rooms.map((room) => {
      if (room.id === id) {
        return {
          ...room,
          x: newX,
          y: newY,
          gridX,
          gridY,
          // Ensure room size fits within a grid cell
          width: Math.min(room.width, floorPlan.gridSizeWidth),
          height: Math.min(room.height, floorPlan.gridSizeHeight)
        };
      }
      return room;
    });
    
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: updatedRooms
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
  };

  const updateRoomSize = (id: string, newWidth: number, newHeight: number) => {
    // Limit room size to grid cell size
    const limitedWidth = Math.min(newWidth, floorPlan.gridSizeWidth);
    const limitedHeight = Math.min(newHeight, floorPlan.gridSizeHeight);
    
    const updatedRooms = floorPlan.rooms.map((room) => {
      if (room.id === id) {
        return {
          ...room,
          width: limitedWidth,
          height: limitedHeight,
        };
      }
      return room;
    });
    
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: updatedRooms
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
  };

  // Start room placement mode
  const startRoomPlacement = () => {
    setIsPlacingRoom(true);
    setSelectedId(null);
  };
  
  // Place a room at the specified grid position
  const placeRoomAtGridPosition = (gridX: number, gridY: number) => {
    const newRoomId = `room-${uuidv4()}`;
    
    // Calculate the snapped position
    const snappedX = gridX * floorPlan.gridSizeWidth;
    const snappedY = gridY * floorPlan.gridSizeHeight;
    
    // Check if any room already occupies this grid cell
    const roomInCell = floorPlan.rooms.find(room => 
      room.gridX === gridX && room.gridY === gridY
    );
    
    if (roomInCell) {
      alert(`Cannot place room here - cell is already occupied by ${roomInCell.name}`);
      return;
    }
    
    const newRoom: RoomType = {
      id: newRoomId,
      x: snappedX,
      y: snappedY,
      width: floorPlan.gridSizeWidth,
      height: floorPlan.gridSizeHeight,
      name: `Room ${floorPlan.rooms.length + 1}`,
      color: getRandomColor(0.2),
      portals: [],
      gridX,
      gridY
    };
    
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: [...floorPlan.rooms, newRoom]
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
    
    // Select the new room
    setSelectedId(newRoomId);
  };

  // Instead of immediately adding a room, enter placement mode
  const addRoom = () => {
    if (isPlacingRoom) {
      // Cancel placement mode if already active
      setIsPlacingRoom(false);
    } else {
      // Start placement mode
      startRoomPlacement();
    }
  };

  const deleteRoom = (roomId: string) => {
    // Find all portals that connect to this room
    const portalConnections: {roomId: string, portalId: string}[] = [];
    
    floorPlan.rooms.forEach(room => {
      room.portals.forEach(portal => {
        if (portal.connectedRoomId === roomId) {
          portalConnections.push({
            roomId: room.id,
            portalId: portal.id
          });
        }
      });
    });
    
    // Remove the room connections
    const updatedRooms = floorPlan.rooms
      .filter(room => room.id !== roomId)
      .map(room => {
        // Disconnect portals that connect to the deleted room
        const updatedPortals = room.portals.map(portal => {
          if (portal.connectedRoomId === roomId) {
            return {
              ...portal,
              connectedRoomId: null,
              connectedPortalId: null
            };
          }
          return portal;
        });
        
        return {
          ...room,
          portals: updatedPortals
        };
      });
    
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: updatedRooms
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
    setSelectedId(null);
  };

  const addPortalToRoom = (roomId: string, wallPosition: 'top' | 'right' | 'bottom' | 'left', position: number) => {
    const portalId = `portal-${uuidv4()}`;
    
    const updatedRooms = floorPlan.rooms.map(room => {
      if (room.id === roomId) {
        // Check if there's already a portal nearby to avoid overcrowding
        const tooClose = room.portals.some(portal => {
          if (portal.wallPosition !== wallPosition) return false;
          
          // Check if portals are within 10% of each other
          return Math.abs(portal.position - position) < 0.1;
        });
        
        if (tooClose) return room;
        
        return {
          ...room,
          portals: [
            ...room.portals,
            {
              id: portalId,
              wallPosition,
              position,
              width: 0.1, // Default to 10% of wall width/height
              connectedRoomId: null,
              connectedPortalId: null
            }
          ]
        };
      }
      return room;
    });
    
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: updatedRooms
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
  };

  const handlePortalClick = (roomId: string, portalId: string) => {
    // If we're not in portal connecting mode yet
    if (!connectingPortals) {
      setConnectingPortals({ roomId, portalId });
      return;
    }
    
    // If we clicked the same portal, cancel connecting mode
    if (connectingPortals.roomId === roomId && connectingPortals.portalId === portalId) {
      setConnectingPortals(null);
      return;
    }
    
    // Connect the two portals
    const updatedRooms = floorPlan.rooms.map(room => {
      // Update the first portal
      if (room.id === connectingPortals.roomId) {
        const updatedPortals = room.portals.map(portal => {
          if (portal.id === connectingPortals.portalId) {
            return {
              ...portal,
              connectedRoomId: roomId,
              connectedPortalId: portalId
            };
          }
          return portal;
        });
        
        return {
          ...room,
          portals: updatedPortals
        };
      }
      
      // Update the second portal
      if (room.id === roomId) {
        const updatedPortals = room.portals.map(portal => {
          if (portal.id === portalId) {
            return {
              ...portal,
              connectedRoomId: connectingPortals.roomId,
              connectedPortalId: connectingPortals.portalId
            };
          }
          return portal;
        });
        
        return {
          ...room,
          portals: updatedPortals
        };
      }
      
      return room;
    });
    
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: updatedRooms
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
    setConnectingPortals(null);
  };

  const handleCanvasMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Update preview room position when in placement mode
    if (isPlacingRoom) {
      const stage = stageRef.current;
      if (!stage) return;
      
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;
      
      // Convert screen coordinates to world coordinates
      const worldX = (pointerPos.x - position.x) / scale;
      const worldY = (pointerPos.y - position.y) / scale;
      
      // Calculate grid position
      const gridX = Math.floor(worldX / floorPlan.gridSizeWidth);
      const gridY = Math.floor(worldY / floorPlan.gridSizeHeight);
      
      setPreviewRoomPosition({ gridX, gridY });
    }
  };

  // Add a dedicated function to handle canvas clicks during room placement
  const handleCanvasClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only handle clicks when in placement mode
    if (!isPlacingRoom) return;
    
    // Skip if not clicking on the stage itself (e.g. clicking on another shape)
    if (e.target !== e.target.getStage()) return;
    
    // Place the room at the current preview position
    const { gridX, gridY } = previewRoomPosition;
    
    // Check if the cell is already occupied
    const isOccupied = floorPlan.rooms.some(room => 
      room.gridX === gridX && room.gridY === gridY
    );
    
    if (isOccupied) {
      alert(`Cannot place room here - cell is already occupied`);
      return;
    }
    
    placeRoomAtGridPosition(gridX, gridY);
    
    // Exit placement mode
    setIsPlacingRoom(false);
  };

  const renderGrid = () => {
    const { gridSizeWidth, gridSizeHeight } = floorPlan;
    const lines = [];
    
    // Calculate the visible area in grid coordinates
    const leftEdge = Math.floor(-position.x / scale / gridSizeWidth) * gridSizeWidth - gridSizeWidth;
    const topEdge = Math.floor(-position.y / scale / gridSizeHeight) * gridSizeHeight - gridSizeHeight;
    const rightEdge = Math.ceil((width - position.x) / scale / gridSizeWidth) * gridSizeWidth + gridSizeWidth;
    const bottomEdge = Math.ceil((height - position.y) / scale / gridSizeHeight) * gridSizeHeight + gridSizeHeight;
    
    // Vertical lines
    for (let x = leftEdge; x <= rightEdge; x += gridSizeWidth) {
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, topEdge, x, bottomEdge]}
          stroke="#ddd"
          strokeWidth={1 / scale}
        />
      );
    }
    
    // Horizontal lines
    for (let y = topEdge; y <= bottomEdge; y += gridSizeHeight) {
      lines.push(
        <Line
          key={`h-${y}`}
          points={[leftEdge, y, rightEdge, y]}
          stroke="#ddd"
          strokeWidth={1 / scale}
        />
      );
    }
    
    return lines;
  };

  const getRandomColor = (alpha = 1) => {
    const r = Math.floor(Math.random() * 200 + 55);
    const g = Math.floor(Math.random() * 200 + 55);
    const b = Math.floor(Math.random() * 200 + 55);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Render preview room when in placement mode
  const renderPreviewRoom = () => {
    if (!isPlacingRoom) return null;
    
    const { gridX, gridY } = previewRoomPosition;
    const x = gridX * floorPlan.gridSizeWidth;
    const y = gridY * floorPlan.gridSizeHeight;
    
    // Check if cell is occupied
    const isOccupied = floorPlan.rooms.some(room => 
      room.gridX === gridX && room.gridY === gridY
    );
    
    // Render a preview rectangle
    return (
      <Rect
        x={x}
        y={y}
        width={floorPlan.gridSizeWidth}
        height={floorPlan.gridSizeHeight}
        stroke={isOccupied ? 'red' : '#1890ff'}
        strokeWidth={2}
        dash={[5, 5]}
        fill={isOccupied ? 'rgba(255, 0, 0, 0.1)' : 'rgba(24, 144, 255, 0.1)'}
        onClick={() => {
          if (!isOccupied) {
            placeRoomAtGridPosition(gridX, gridY);
            setIsPlacingRoom(false);
          } else {
            alert(`Cannot place room here - cell is already occupied`);
          }
        }}
      />
    );
  };

  // Add an effect to ensure isDraggingRoom is always reset
  useEffect(() => {
    return () => {
      // This will run when the component unmounts or when dependencies change
      // Ensures we don't leave the app in a broken state
      setIsDraggingRoom(false);
    };
  }, []);

  return (
    <div 
      className="floor-plan-canvas-container" 
      style={{ 
        touchAction: 'none', 
        overflow: 'hidden',
        position: 'relative'
      }}
      ref={containerRef}
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchMove={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="floor-plan-controls">
        <button onClick={addRoom}>{isPlacingRoom ? "Cancel Room" : "Add Room"}</button>
        <span className="grid-info">Grid: {floorPlan.gridSizeWidth}×{floorPlan.gridSizeHeight}mm</span>
        <span className="scale-info">Scale: {Math.round(scale * 100)}%</span>
        {selectedId && <span className="selected-info">Room selected: {floorPlan.rooms.find(r => r.id === selectedId)?.name}</span>}
        {isPlacingRoom && <span className="placement-info">Click to place room</span>}
      </div>
      <Stage 
        width={width} 
        height={height}
        onClick={isPlacingRoom ? handleCanvasClick : handleDeselect}
        ref={stageRef}
        onMouseMove={handleCanvasMouseMove}
        position={position}
        scale={{x: scale, y: scale}}
      >
        <Layer>
          {/* Grid */}
          <Group>{renderGrid()}</Group>
          
          {/* Preview Room */}
          {renderPreviewRoom()}
          
          {/* Rooms */}
          {floorPlan.rooms.map((room) => (
            <Room
              key={room.id}
              room={room}
              isSelected={room.id === selectedId}
              onSelect={handleSelect}
              onPositionChange={(id, newX, newY) => {
                const roomTarget = {
                  target: {
                    attrs: { id },
                    x: () => newX,
                    y: () => newY
                  }
                } as unknown as Konva.KonvaEventObject<DragEvent>;
                handleRoomDragEnd(roomTarget, id);
              }}
              onSizeChange={updateRoomSize}
              onPortalAdd={addPortalToRoom}
              gridSizeWidth={floorPlan.gridSizeWidth}
              gridSizeHeight={floorPlan.gridSizeHeight}
              onDragStart={handleRoomDragStart}
              onDragEnd={() => setIsDraggingRoom(false)}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default FloorPlanCanvas; 