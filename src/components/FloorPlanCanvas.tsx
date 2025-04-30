import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Group, Line, Rect } from 'react-konva';
import { Room as RoomType, Portal as PortalType, FloorPlan, Wall as WallType, Vertex as VertexType } from '../types/Room';
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
  selectedRoom: RoomType | null;
  setSelectedRoom: React.Dispatch<React.SetStateAction<RoomType | null>>;
  isWallPlacementActive?: boolean;
  setIsWallPlacementActive?: React.Dispatch<React.SetStateAction<boolean>>;
}

const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({ 
  width, 
  height, 
  floorPlan, 
  setFloorPlan, 
  addToHistory,
  selectedRoom,
  setSelectedRoom,
  isWallPlacementActive = false,
  setIsWallPlacementActive
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
  
  // Wall drawing state
  const [isDrawingWall, setIsDrawingWall] = useState(false);
  const [wallStartPoint, setWallStartPoint] = useState<{ x: number, y: number, roomId: string, vertexId?: string } | null>(null);
  const [wallPreview, setWallPreview] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  
  // Wall/vertex selection state
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null);
  
  // Portal selection state
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [selectedPortalEnd, setSelectedPortalEnd] = useState<'start' | 'end' | null>(null);

  // Portal placement state
  const [isPortalPlacementActive, setIsPortalPlacementActive] = useState(false);
  const [isDrawingPortal, setIsDrawingPortal] = useState(false);
  const [portalStartPoint, setPortalStartPoint] = useState<{ x: number, y: number, roomId: string } | null>(null);
  const [portalPreview, setPortalPreview] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [pendingPortal, setPendingPortal] = useState<{ 
    roomId: string, 
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number 
  } | null>(null);

  // Calculate min and max zoom limits based on grid size
  const getZoomLimits = () => {
    // Minimum scale ensures grid cells don't become too small (prevents crashes when zoomed out too far)
    // Base it on grid size - smaller grid = lower minimum zoom
    const minScale = Math.max(0.01, 30 / Math.max(floorPlan.gridSizeWidth, floorPlan.gridSizeHeight));
    
    // Maximum scale prevents grid cells from becoming too large
    // Base it on grid size - larger grid = higher maximum zoom
    const maxScale = Math.min(50, 5000 / Math.min(floorPlan.gridSizeWidth, floorPlan.gridSizeHeight));
    
    return { minScale, maxScale };
  };

  // Initialize canvas position to center
  useEffect(() => {
    setPosition({ x: width / 2, y: height / 2 });
  }, [width, height]);

  // Handle zoom slider change
  const handleZoomSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoomPercent = parseFloat(e.target.value);
    const newScale = newZoomPercent / 100;
    
    // Get current center point in world coordinates
    const centerX = (width / 2 - position.x) / scale;
    const centerY = (height / 2 - position.y) / scale;
    
    // Calculate new position that keeps the center point in the same world position
    const newX = width / 2 - centerX * newScale;
    const newY = height / 2 - centerY * newScale;
    
    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

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
        // If a wall is selected, delete it
        if (selectedWallId) {
          e.preventDefault();
          handleWallDelete(selectedId, selectedWallId);
          return;
        }
        // If a vertex is selected, delete it (only if it's not used by multiple walls)
        else if (selectedVertexId) {
          e.preventDefault();
          // Find the room
          const room = floorPlan.rooms.find(r => r.id === selectedId);
          if (!room) return;
          
          // Count how many walls use this vertex
          let vertexUsageCount = 0;
          for (const wall of room.walls) {
            if (wall.vertexIds.includes(selectedVertexId)) {
              vertexUsageCount++;
            }
          }
          
          // If the vertex is used by only one wall, delete that wall
          if (vertexUsageCount === 1) {
            const wallToDelete = room.walls.find(wall => 
              wall.vertexIds.includes(selectedVertexId)
            );
            if (wallToDelete) {
              handleWallDelete(selectedId, wallToDelete.id);
            }
          } else if (vertexUsageCount > 1) {
            // If used by multiple walls, show an alert
            alert("Cannot delete vertex used by multiple walls. Delete the walls first.");
          }
          return;
        }
        // If a portal is selected, delete it and its connection
        else if (selectedPortalId) {
          e.preventDefault();
          handlePortalDelete(selectedId, selectedPortalId);
          return;
        }
        
        // Otherwise delete the room
        deleteRoom(selectedId);
      }
      
      // Cancel room placement mode when pressing Escape
      if (isPlacingRoom && e.key === 'Escape') {
        setIsPlacingRoom(false);
      }
      
      // Cancel wall placement mode when pressing Escape
      if (isWallPlacementActive && e.key === 'Escape' && setIsWallPlacementActive) {
        setIsWallPlacementActive(false);
      }
      
      // Cancel portal placement mode when pressing Escape
      if (isPortalPlacementActive && e.key === 'Escape') {
        setIsPortalPlacementActive(false);
        setPendingPortal(null);
      }
      
      // Add room shortcut - 'n' key
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only trigger if not typing in an input field
        if (!(e.target instanceof HTMLInputElement) && 
            !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          addRoom();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId, selectedWallId, selectedVertexId, selectedPortalId, floorPlan, isPlacingRoom, isWallPlacementActive, isPortalPlacementActive]);

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
      onPinch: ({ origin: [ox, oy], first, movement: [ms], offset: [s], delta: [ds], memo }) => {
        if (isDraggingRoom) return;
        
        // Ensure we're working with valid numbers
        const validDs = isNaN(ds) ? 0 : ds;
        
        // Calculate zoom limits
        const { minScale, maxScale } = getZoomLimits();
        
        // Using geometric progression for smooth zooming
        // For a small change ds, we want to advance proportionally on a logarithmic scale
        // This ensures that each zoom step "feels" the same regardless of the current zoom level
        const zoomFactor = Math.exp(validDs * 0.5); // 0.5 is a sensitivity factor
        const newScale = scale * zoomFactor;
        
        // Apply zoom limits
        const clampedScale = Math.min(Math.max(newScale, minScale), maxScale);
        
        // Prevent extremely small scales that can cause NaN issues
        if (clampedScale < 0.0001 || !isFinite(clampedScale)) {
          return;
        }
        
        const stage = stageRef.current;
        if (!stage) return;
        
        // Get stage dimensions
        const stageRect = stage.container().getBoundingClientRect();
        
        // Get pointer position relative to stage
        const pointerX = ox - stageRect.left;
        const pointerY = oy - stageRect.top;
        
        // Get pointer position in world coordinates
        const worldX = (pointerX - position.x) / scale;
        const worldY = (pointerY - position.y) / scale;
        
        // Calculate new position that keeps the point under the pointer in the same world position
        let newX = pointerX - worldX * clampedScale;
        let newY = pointerY - worldY * clampedScale;
        
        // Guard against NaN values
        if (isNaN(newX) || !isFinite(newX)) newX = position.x;
        if (isNaN(newY) || !isFinite(newY)) newY = position.y;
        
        setScale(clampedScale);
        setPosition({ x: newX, y: newY });
        
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
        
        // Calculate zoom limits
        const { minScale, maxScale } = getZoomLimits();
        
        // Using geometric progression for smooth zooming
        // For a fixed zoom-in/out step, we want a constant multiplication factor
        // This ensures that each zoom step "feels" the same regardless of the current zoom level
        const wheelZoomSensitivity = 0.2; // Controls how much zoom per wheel click
        
        // For zooming in/out with wheel, we use a fixed multiplicative factor
        // This gives consistent zoom feel regardless of current zoom level
        const zoomInFactor = Math.exp(wheelZoomSensitivity);
        const zoomOutFactor = Math.exp(-wheelZoomSensitivity);
        
        // Apply the appropriate factor
        const newScale = dy > 0 
          ? oldScale * zoomOutFactor  // Zoom out
          : oldScale * zoomInFactor;  // Zoom in
        
        // Apply zoom limits
        const clampedScale = Math.min(Math.max(newScale, minScale), maxScale);
        
        // Prevent extremely small scales that can cause NaN issues
        if (clampedScale < 0.0001 || !isFinite(clampedScale)) {
          return;
        }
        
        // Calculate new position that keeps zoom centered on mouse pointer
        let newX = pointer.x - mousePointTo.x * clampedScale;
        let newY = pointer.y - mousePointTo.y * clampedScale;
        
        // Guard against NaN values
        if (isNaN(newX) || !isFinite(newX)) newX = position.x;
        if (isNaN(newY) || !isFinite(newY)) newY = position.y;
        
        setScale(clampedScale);
        setPosition({ x: newX, y: newY });
      }
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      pinch: {
        distanceBounds: { min: 0 },
        rubberband: true
      }
    }
  );

  // Sync selectedId with the selectedRoom from props
  useEffect(() => {
    if (selectedId) {
      const room = floorPlan.rooms.find(room => room.id === selectedId);
      setSelectedRoom(room || null);
    } else {
      setSelectedRoom(null);
    }
  }, [selectedId, floorPlan.rooms, setSelectedRoom]);

  // If selectedRoom changes externally, update selectedId
  useEffect(() => {
    if (selectedRoom) {
      setSelectedId(selectedRoom.id);
    }
  }, [selectedRoom]);

  // Handle room mouse events
  const handleSelect = (id: string) => {
    // Cancel room placement if we click on an existing room
    if (isPlacingRoom) {
      setIsPlacingRoom(false);
    }
    
    // If selecting a different room while in wall placement mode, disable wall placement
    if (isWallPlacementActive && selectedId !== id && setIsWallPlacementActive) {
      setIsWallPlacementActive(false);
    }
    
    // Clear wall and vertex selections when selecting a room
    setSelectedWallId(null);
    setSelectedVertexId(null);
    
    setSelectedId(id);
  };

  const handleDeselect = (e: any) => {
    // Don't deselect if we're in wall placement mode and drawing a wall
    if ((isWallPlacementActive && isDrawingWall) || (isPortalPlacementActive && isDrawingPortal)) {
      return;
    }
    
    // Don't deselect if we have a pending portal
    if (pendingPortal) {
      return;
    }
    
    // Deselect when clicking on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      // Clear all selections
      setSelectedId(null);
      setSelectedWallId(null);
      setSelectedVertexId(null);
      setConnectingPortals(null);
      
      // If wall placement is active, deactivate it
      if (isWallPlacementActive && setIsWallPlacementActive) {
        setIsWallPlacementActive(false);
      }
      
      // If portal placement is active, deactivate it
      if (isPortalPlacementActive) {
        setIsPortalPlacementActive(false);
        setPendingPortal(null);
      }
    }
  };

  // Set flags to prevent canvas from moving when dragging rooms
  const handleRoomDragStart = () => {
    setIsDraggingRoom(true);
  };

  const handleRoomDragEnd = (e: Konva.KonvaEventObject<DragEvent>, roomId: string) => {
    // Reset the dragging flag
    setIsDraggingRoom(false);
    
    const room = floorPlan.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Get the new position of the room after dragging
    const newX = e.target.x();
    const newY = e.target.y();
    
    // Calculate new grid position - ensure exact grid alignment
    const newGridX = Math.round(newX / floorPlan.gridSizeWidth);
    const newGridY = Math.round(newY / floorPlan.gridSizeHeight);
    
    // Calculate snapped position
    const snappedX = newGridX * floorPlan.gridSizeWidth;
    const snappedY = newGridY * floorPlan.gridSizeHeight;
    
    // Skip updates if the room hasn't actually changed position
    if (room.gridX === newGridX && room.gridY === newGridY) {
      return;
    }
    
    // Check if there's already a room at this new grid position (excluding the current room)
    const isOccupied = floorPlan.rooms.some(
      r => r.id !== roomId && r.gridX === newGridX && r.gridY === newGridY
    );
    
    if (isOccupied) {
      // If occupied, revert to original position without triggering a new state update
      if (typeof e.target.position === 'function') {
        e.target.position({
          x: room.x,
          y: room.y
        });
      }
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
      walls: [],
      vertices: [],
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
    // Clear the selected room if we're deleting it
    if (selectedId === roomId) {
      setSelectedId(null);
    }
    
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

  // Toggle wall placement mode
  const toggleWallPlacement = () => {
    if (setIsWallPlacementActive) {
      setIsWallPlacementActive(!isWallPlacementActive);
      // Cancel room placement if active
      if (isPlacingRoom) {
        setIsPlacingRoom(false);
      }
      // Cancel portal placement if active
      if (isPortalPlacementActive) {
        setIsPortalPlacementActive(false);
        setPendingPortal(null);
      }
    }
  };

  // Toggle portal placement mode
  const togglePortalPlacement = () => {
    setIsPortalPlacementActive(!isPortalPlacementActive);
    // Cancel room placement if active
    if (isPlacingRoom) {
      setIsPlacingRoom(false);
    }
    // Cancel wall placement if active
    if (isWallPlacementActive && setIsWallPlacementActive) {
      setIsWallPlacementActive(false);
    }
    // Clear pending portal if canceling
    if (isPortalPlacementActive) {
      setPendingPortal(null);
    }
  };

  // Handle wall selection
  const handleWallSelect = (roomId: string, wallId: string) => {
    // Handle event propagation
    if (selectedId !== roomId) {
      // If clicking a wall in a different room, select that room first
      setSelectedId(roomId);
    }
    
    if (selectedWallId === wallId) {
      // Deselect if already selected
      setSelectedWallId(null);
    } else {
      // Select this wall and clear other selections
      setSelectedWallId(wallId);
      setSelectedVertexId(null);
    }
  };

  // Handle vertex selection
  const handleVertexSelect = (roomId: string, vertexId: string) => {
    if (isWallPlacementActive && selectedId === roomId) {
      // If in wall placement mode and selecting a vertex, start drawing from that vertex
      const room = floorPlan.rooms.find(r => r.id === roomId);
      if (!room) return;
      
      const vertex = room.vertices.find(v => v.id === vertexId);
      if (!vertex) return;
      
      setIsDrawingWall(true);
      setWallStartPoint({ 
        x: vertex.x, 
        y: vertex.y, 
        roomId,
        vertexId: vertex.id
      });
      setWallPreview({ 
        startX: vertex.x, 
        startY: vertex.y, 
        endX: vertex.x, 
        endY: vertex.y 
      });
    } else {
      // Handle event propagation
      if (selectedId !== roomId) {
        // If clicking a vertex in a different room, select that room first
        setSelectedId(roomId);
      }
      
      if (selectedVertexId === vertexId) {
        // Deselect if already selected
        setSelectedVertexId(null);
      } else {
        // Select this vertex and clear other selections
        setSelectedVertexId(vertexId);
        setSelectedWallId(null);
        setSelectedPortalId(null);
        setSelectedPortalEnd(null);
      }
    }
  };

  // Handle portal selection
  const handlePortalSelect = (roomId: string, portalId: string, end: 'start' | 'end') => {
    // Handle event propagation
    if (selectedId !== roomId) {
      // If clicking a portal in a different room, select that room first
      setSelectedId(roomId);
    }
    
    if (selectedPortalId === portalId && selectedPortalEnd === end) {
      // Deselect if already selected
      setSelectedPortalId(null);
      setSelectedPortalEnd(null);
    } else {
      // Select this portal and clear other selections
      setSelectedPortalId(portalId);
      setSelectedPortalEnd(end);
      setSelectedWallId(null);
      setSelectedVertexId(null);
    }
  };

  // Handle vertex drag
  const handleVertexDrag = (roomId: string, vertexId: string, newX: number, newY: number) => {
    const room = floorPlan.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Check if this vertex is close to any other vertex for merging
    const mergeThreshold = 15; // pixels
    let targetVertex: VertexType | null = null;
    
    // Find the closest vertex that's not the one being dragged
    for (const vertex of room.vertices) {
      if (vertex.id !== vertexId) {
        const distance = Math.sqrt(
          Math.pow(vertex.x - newX, 2) + 
          Math.pow(vertex.y - newY, 2)
        );
        
        if (distance < mergeThreshold) {
          targetVertex = vertex;
          break;
        }
      }
    }
    
    // If we found a target vertex to merge with
    if (targetVertex) {
      // Update all walls that use the dragged vertex to use the target vertex
      const updatedWalls = room.walls.map(wall => {
        // If this wall uses the dragged vertex
        if (wall.vertexIds.includes(vertexId)) {
          // Replace references to the dragged vertex with the target vertex
          const updatedVertexIds = wall.vertexIds.map(vid => 
            vid === vertexId ? targetVertex!.id : vid
          );
          
          // Remove any duplicates that might have been created
          const uniqueVertexIds = updatedVertexIds.filter((vid, index) => 
            updatedVertexIds.indexOf(vid) === index
          );
          
          // Only keep walls that still have at least 2 vertices
          if (uniqueVertexIds.length < 2) {
            return null; // Mark for removal
          }
          
          return {
            ...wall,
            vertexIds: uniqueVertexIds
          };
        }
        return wall;
      }).filter(wall => wall !== null) as WallType[]; // Remove any null entries
      
      // Remove the dragged vertex since it's now merged
      const updatedVertices = room.vertices.filter(v => v.id !== vertexId);
      
      // Update the room with new walls and vertices
      const updatedRooms = floorPlan.rooms.map(r => {
        if (r.id === roomId) {
          return {
            ...r,
            walls: updatedWalls,
            vertices: updatedVertices
          };
        }
        return r;
      });
      
      // Clear selected vertex since it no longer exists
      setSelectedVertexId(null);
      
      const updatedFloorPlan = {
        ...floorPlan,
        rooms: updatedRooms
      };
      
      setFloorPlan(updatedFloorPlan);
      addToHistory(updatedFloorPlan);
    } else {
      // Normal vertex movement if not merging
      const updatedRooms = floorPlan.rooms.map(room => {
        if (room.id === roomId) {
          // Update the vertex position
          const updatedVertices = room.vertices.map(vertex => {
            if (vertex.id === vertexId) {
              return {
                ...vertex,
                x: newX,
                y: newY
              };
            }
            return vertex;
          });
          
          return {
            ...room,
            vertices: updatedVertices
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
    }
  };

  // Handle portal drag
  const handlePortalDrag = (roomId: string, portalId: string, end: 'start' | 'end', newX: number, newY: number) => {
    const room = floorPlan.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    const portal = room.portals.find(p => p.id === portalId);
    if (!portal || !portal.startX || !portal.endX || !portal.startY || !portal.endY) return;
    
    // Calculate new relative positions
    const newRelativeX = newX / room.width;
    const newRelativeY = newY / room.height;
    
    // Update this portal
    let updatedPortal: PortalType;
    if (end === 'start') {
      updatedPortal = {
        ...portal,
        startX: newX,
        startY: newY,
        relativeStartX: newRelativeX,
        relativeStartY: newRelativeY
      };
    } else {
      updatedPortal = {
        ...portal,
        endX: newX,
        endY: newY,
        relativeEndX: newRelativeX,
        relativeEndY: newRelativeY
      };
    }
    
    // Find the connected room and portal
    const connectedRoomId = portal.connectedRoomId;
    const connectedPortalId = portal.connectedPortalId;
    
    if (!connectedRoomId || !connectedPortalId) {
      // If this portal isn't connected, just update it
      const updatedRooms = floorPlan.rooms.map(r => {
        if (r.id === roomId) {
          return {
            ...r,
            portals: r.portals.map(p => p.id === portalId ? updatedPortal : p)
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
      return;
    }
    
    // Find the connected room and portal
    const connectedRoom = floorPlan.rooms.find(r => r.id === connectedRoomId);
    if (!connectedRoom) return;
    
    const connectedPortal = connectedRoom.portals.find(p => p.id === connectedPortalId);
    if (!connectedPortal || !connectedPortal.startX || !connectedPortal.endX || 
        !connectedPortal.startY || !connectedPortal.endY) return;
    
    // Calculate the position in the connected room
    const connectedX = end === 'start' 
      ? newRelativeX * connectedRoom.width 
      : newRelativeX * connectedRoom.width;
    
    const connectedY = end === 'start' 
      ? newRelativeY * connectedRoom.height 
      : newRelativeY * connectedRoom.height;
    
    // Update the connected portal
    let updatedConnectedPortal: PortalType;
    if (end === 'start') {
      updatedConnectedPortal = {
        ...connectedPortal,
        startX: connectedX,
        startY: connectedY,
        relativeStartX: newRelativeX,
        relativeStartY: newRelativeY
      };
    } else {
      updatedConnectedPortal = {
        ...connectedPortal,
        endX: connectedX,
        endY: connectedY,
        relativeEndX: newRelativeX,
        relativeEndY: newRelativeY
      };
    }
    
    // Update both portals
    const updatedRooms = floorPlan.rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          portals: r.portals.map(p => p.id === portalId ? updatedPortal : p)
        };
      }
      if (r.id === connectedRoomId) {
        return {
          ...r,
          portals: r.portals.map(p => p.id === connectedPortalId ? updatedConnectedPortal : p)
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

  // Handle wall deletion
  const handleWallDelete = (roomId: string, wallId: string) => {
    const updatedRooms = floorPlan.rooms.map(room => {
      if (room.id === roomId) {
        // Find the wall to delete
        const wallToDelete = room.walls.find(w => w.id === wallId);
        if (!wallToDelete) return room;
        
        // Check if any vertices are used only by this wall
        const vertexUsageCounts: Record<string, number> = {};
        
        // Count how many walls use each vertex
        room.walls.forEach(wall => {
          wall.vertexIds.forEach(vertexId => {
            vertexUsageCounts[vertexId] = (vertexUsageCounts[vertexId] || 0) + 1;
          });
        });
        
        // Get vertices that will only be used by this wall (count === 1)
        const unusedVertexIds = wallToDelete.vertexIds.filter(
          vertexId => vertexUsageCounts[vertexId] === 1
        );
        
        // Remove wall
        const updatedWalls = room.walls.filter(wall => wall.id !== wallId);
        
        // Remove any vertices that are no longer used by any wall
        const updatedVertices = room.vertices.filter(
          vertex => !unusedVertexIds.includes(vertex.id)
        );
        
        return {
          ...room,
          walls: updatedWalls,
          vertices: updatedVertices
        };
      }
      return room;
    });
    
    // Clear selection
    setSelectedWallId(null);
    
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: updatedRooms
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
  };

  // Add a wall to a room
  const addWallToRoom = (roomId: string, startVertexId: string | null, startX: number, startY: number, endX: number, endY: number) => {
    const wallId = `wall-${uuidv4()}`;
    
    const updatedRooms = floorPlan.rooms.map(room => {
      if (room.id === roomId) {
        // Check if we have an existing vertex to start from
        let startVertex: VertexType | null = null;
        if (startVertexId) {
          startVertex = room.vertices.find(v => v.id === startVertexId) || null;
        }
        
        // Check if there's an existing vertex near the end point
        const endVertexSensitivity = 10; // pixels
        let endVertex: VertexType | null = null;
        
        for (const vertex of room.vertices) {
          const dx = vertex.x - endX;
          const dy = vertex.y - endY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < endVertexSensitivity) {
            endVertex = vertex;
          }
        }
        
        // Create vertices as needed
        const newVertices: VertexType[] = [];
        
        if (!startVertex) {
          startVertex = {
            id: `vertex-${uuidv4()}`,
            x: startX,
            y: startY
          };
          newVertices.push(startVertex);
        }
        
        if (!endVertex) {
          endVertex = {
            id: `vertex-${uuidv4()}`,
            x: endX,
            y: endY
          };
          newVertices.push(endVertex);
        }
        
        // Create the new wall
        const newWall: WallType = {
          id: wallId,
          vertexIds: [startVertex.id, endVertex.id]
        };
        
        return {
          ...room,
          walls: [...room.walls, newWall],
          vertices: [...room.vertices, ...newVertices]
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

  // Wall drawing handlers
  const handleWallDrawingStart = (roomId: string, x: number, y: number, existingVertexId?: string) => {
    if (!isWallPlacementActive) return;
    
    // Only allow wall drawing in the selected room
    if (selectedId !== roomId) return;
    
    // Find the room in global coordinates
    const room = floorPlan.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Convert global coordinates to room-local coordinates
    const localX = x - room.x;
    const localY = y - room.y;
    
    // Ensure the point is within room bounds
    if (localX < 0 || localX > room.width || localY < 0 || localY > room.height) return;
    
    // Check if we're near an existing vertex
    if (!existingVertexId) {
      const sensitivity = 10; // pixels
      let nearestVertex: VertexType | null = null;
      let nearestDistance = Infinity;
      
      for (const vertex of room.vertices) {
        const dx = vertex.x - localX;
        const dy = vertex.y - localY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < sensitivity && distance < nearestDistance) {
          nearestVertex = vertex;
          nearestDistance = distance;
        }
      }
      
      if (nearestVertex) {
        existingVertexId = nearestVertex.id;
        // Use the exact vertex position
        setIsDrawingWall(true);
        setWallStartPoint({ 
          x: nearestVertex.x, 
          y: nearestVertex.y, 
          roomId,
          vertexId: nearestVertex.id
        });
        setWallPreview({ 
          startX: nearestVertex.x, 
          startY: nearestVertex.y, 
          endX: nearestVertex.x, 
          endY: nearestVertex.y 
        });
        return;
      }
    }
    
    setIsDrawingWall(true);
    setWallStartPoint({ 
      x: localX, 
      y: localY, 
      roomId,
      vertexId: existingVertexId
    });
    setWallPreview({ 
      startX: localX, 
      startY: localY, 
      endX: localX, 
      endY: localY 
    });
  };
  
  const handleWallDrawingMove = (x: number, y: number) => {
    if (!isDrawingWall || !wallStartPoint) return;
    
    // Find the room
    const room = floorPlan.rooms.find(r => r.id === wallStartPoint.roomId);
    if (!room) return;
    
    // Convert global coordinates to room-local coordinates
    const localX = Math.max(0, Math.min(room.width, x - room.x));
    const localY = Math.max(0, Math.min(room.height, y - room.y));
    
    // Check if we're near an existing vertex for snapping
    const sensitivity = 10; // pixels
    let snapToX = localX;
    let snapToY = localY;
    let snappedToVertex = false;
    
    for (const vertex of room.vertices) {
      const dx = vertex.x - localX;
      const dy = vertex.y - localY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < sensitivity) {
        snapToX = vertex.x;
        snapToY = vertex.y;
        snappedToVertex = true;
      }
    }
    
    // Update wall preview
    setWallPreview({
      startX: wallStartPoint.x,
      startY: wallStartPoint.y,
      endX: snapToX,
      endY: snapToY
    });
  };
  
  const handleWallDrawingEnd = () => {
    if (!isDrawingWall || !wallStartPoint || !wallPreview) return;
    
    // Check if wall has a minimum length (to prevent accidental clicks)
    const dx = wallPreview.endX - wallPreview.startX;
    const dy = wallPreview.endY - wallPreview.startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 10) { // Minimum 10px length
      addWallToRoom(
        wallStartPoint.roomId,
        wallStartPoint.vertexId || null,
        wallPreview.startX,
        wallPreview.startY,
        wallPreview.endX,
        wallPreview.endY
      );
      
      // After adding the wall, disable wall placement mode
      if (setIsWallPlacementActive) {
        setIsWallPlacementActive(false);
      }
    }
    
    // Reset wall drawing state
    setIsDrawingWall(false);
    setWallStartPoint(null);
    setWallPreview(null);
  };

  // Portal drawing handlers
  const handlePortalDrawingStart = (roomId: string, x: number, y: number) => {
    if (!isPortalPlacementActive) return;
    
    // Only allow portal drawing in the selected room
    if (selectedId !== roomId) return;
    
    // Find the room
    const room = floorPlan.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Convert global coordinates to room-local coordinates
    const localX = x - room.x;
    const localY = y - room.y;
    
    // Ensure the point is within room bounds
    if (localX < 0 || localX > room.width || localY < 0 || localY > room.height) return;
    
    setIsDrawingPortal(true);
    setPortalStartPoint({ 
      x: localX, 
      y: localY, 
      roomId
    });
    setPortalPreview({ 
      startX: localX, 
      startY: localY, 
      endX: localX, 
      endY: localY 
    });
  };
  
  const handlePortalDrawingMove = (x: number, y: number) => {
    if (!isDrawingPortal || !portalStartPoint) return;
    
    // Find the room
    const room = floorPlan.rooms.find(r => r.id === portalStartPoint.roomId);
    if (!room) return;
    
    // Convert global coordinates to room-local coordinates
    const localX = Math.max(0, Math.min(room.width, x - room.x));
    const localY = Math.max(0, Math.min(room.height, y - room.y));
    
    // Update portal preview
    setPortalPreview({
      startX: portalStartPoint.x,
      startY: portalStartPoint.y,
      endX: localX,
      endY: localY
    });
  };
  
  const handlePortalDrawingEnd = () => {
    if (!isDrawingPortal || !portalStartPoint || !portalPreview) return;
    
    // Check if portal has a minimum length
    const dx = portalPreview.endX - portalPreview.startX;
    const dy = portalPreview.endY - portalPreview.startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 10) { // Minimum 10px length
      // Store the pending portal for further processing
      setPendingPortal({
        roomId: portalStartPoint.roomId,
        startX: portalPreview.startX,
        startY: portalPreview.startY,
        endX: portalPreview.endX,
        endY: portalPreview.endY
      });
    }
    
    // Reset portal drawing state
    setIsDrawingPortal(false);
    setPortalStartPoint(null);
    setPortalPreview(null);
  };

  // Update canvas event handlers to handle wall drawing
  const handleCanvasClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    
    // Get pointer position in canvas coordinates
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    
    // Convert to world coordinates
    const worldPos = {
      x: (pointerPosition.x - position.x) / scale,
      y: (pointerPosition.y - position.y) / scale
    };
    
    // Calculate grid coordinates
    const gridX = Math.floor(worldPos.x / floorPlan.gridSizeWidth);
    const gridY = Math.floor(worldPos.y / floorPlan.gridSizeHeight);
    
    // If we're placing a room, place it at the clicked position
    if (isPlacingRoom) {
      placeRoomAtGridPosition(gridX, gridY);
      setIsPlacingRoom(false);
      return;
    }
    
    // If wall placement is active, check if click is inside the selected room
    if (isWallPlacementActive && selectedId) {
      const selectedRoom = floorPlan.rooms.find(room => room.id === selectedId);
      if (selectedRoom && 
          worldPos.x >= selectedRoom.x && 
          worldPos.x <= selectedRoom.x + selectedRoom.width && 
          worldPos.y >= selectedRoom.y && 
          worldPos.y <= selectedRoom.y + selectedRoom.height) {
        handleWallDrawingStart(selectedId, worldPos.x, worldPos.y);
        return; // Don't do deselection if we're starting to draw a wall
      }
    }
    
    // If portal placement is active, check if click is inside the selected room
    if (isPortalPlacementActive && selectedId) {
      const selectedRoom = floorPlan.rooms.find(room => room.id === selectedId);
      if (selectedRoom && 
          worldPos.x >= selectedRoom.x && 
          worldPos.x <= selectedRoom.x + selectedRoom.width && 
          worldPos.y >= selectedRoom.y && 
          worldPos.y <= selectedRoom.y + selectedRoom.height) {
        handlePortalDrawingStart(selectedId, worldPos.x, worldPos.y);
        return; // Don't do deselection if we're starting to draw a portal
      }
    }
    
    // If we reach here, handle deselection if clicking on empty space
    if (e.target === e.target.getStage()) {
      handleDeselect(e);
    }
  };

  const handleCanvasMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    
    // Get pointer position in canvas coordinates
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    
    // Convert to world coordinates
    const worldPos = {
      x: (pointerPosition.x - position.x) / scale,
      y: (pointerPosition.y - position.y) / scale
    };
    
    // If we're in room placement mode, update preview position
    if (isPlacingRoom) {
      // Calculate grid position
      const gridX = Math.floor(worldPos.x / floorPlan.gridSizeWidth);
      const gridY = Math.floor(worldPos.y / floorPlan.gridSizeHeight);
      
      setPreviewRoomPosition({ gridX, gridY });
    }
    
    // If we're drawing a wall, update the wall preview
    if (isDrawingWall) {
      handleWallDrawingMove(worldPos.x, worldPos.y);
    }
    
    // If we're drawing a portal, update the portal preview
    if (isDrawingPortal) {
      handlePortalDrawingMove(worldPos.x, worldPos.y);
    }
  };

  // Handle stage mouseup to end wall drawing
  const handleStageMouseUp = () => {
    if (isDrawingWall) {
      handleWallDrawingEnd();
    }
    
    if (isDrawingPortal) {
      handlePortalDrawingEnd();
    }
  };

  // Render wall preview during drawing
  const renderWallPreview = () => {
    if (!isDrawingWall || !wallStartPoint || !wallPreview) return null;
    
    const room = floorPlan.rooms.find(r => r.id === wallStartPoint.roomId);
    if (!room) return null;
    
    return (
      <Group>
        <Line
          x={room.x}
          y={room.y}
          points={[
            wallPreview.startX,
            wallPreview.startY,
            wallPreview.endX,
            wallPreview.endY
          ]}
          stroke="blue"
          strokeWidth={2}
          dash={[5, 5]}
        />
      </Group>
    );
  };

  const renderGrid = () => {
    const { gridSizeWidth, gridSizeHeight } = floorPlan;
    const lines = [];
    
    // Calculate the visible area in grid coordinates
    // Guard against extreme scale values that could cause NaN
    const safeScale = Math.max(0.0001, scale);
    
    const leftEdge = Math.floor(-position.x / safeScale / gridSizeWidth) * gridSizeWidth - gridSizeWidth;
    const topEdge = Math.floor(-position.y / safeScale / gridSizeHeight) * gridSizeHeight - gridSizeHeight;
    const rightEdge = Math.ceil((width - position.x) / safeScale / gridSizeWidth) * gridSizeWidth + gridSizeWidth;
    const bottomEdge = Math.ceil((height - position.y) / safeScale / gridSizeHeight) * gridSizeHeight + gridSizeHeight;
    
    // Safety check to prevent too many grid lines at extreme zoom levels
    const gridLineLimit = 1000;
    const hLineCount = Math.min(Math.ceil((bottomEdge - topEdge) / gridSizeHeight), gridLineLimit);
    const vLineCount = Math.min(Math.ceil((rightEdge - leftEdge) / gridSizeWidth), gridLineLimit);
    
    if (hLineCount > 0 && vLineCount > 0 && isFinite(hLineCount) && isFinite(vLineCount)) {
      // Vertical lines
      for (let x = leftEdge; x <= rightEdge; x += gridSizeWidth) {
        if (!isFinite(x)) continue;
        lines.push(
          <Line
            key={`v-${x}`}
            points={[x, topEdge, x, bottomEdge]}
            stroke="#ddd"
            strokeWidth={1 / safeScale}
          />
        );
      }
      
      // Horizontal lines
      for (let y = topEdge; y <= bottomEdge; y += gridSizeHeight) {
        if (!isFinite(y)) continue;
        lines.push(
          <Line
            key={`h-${y}`}
            points={[leftEdge, y, rightEdge, y]}
            stroke="#ddd"
            strokeWidth={1 / safeScale}
          />
        );
      }
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

  // Create a new portal between two rooms
  const createConnectedPortals = (sourceRoomId: string, targetRoomId: string, sourcePath: { x1: number, y1: number, x2: number, y2: number }) => {
    const sourceRoom = floorPlan.rooms.find(r => r.id === sourceRoomId);
    const targetRoom = floorPlan.rooms.find(r => r.id === targetRoomId);
    
    if (!sourceRoom || !targetRoom) return;
    
    // Generate unique IDs for both portals
    const sourcePortalId = `portal-${uuidv4()}`;
    const targetPortalId = `portal-${uuidv4()}`;
    
    // Calculate relative positions within the rooms (as percentages)
    const sourceStartRelative = {
      x: sourcePath.x1 / sourceRoom.width,
      y: sourcePath.y1 / sourceRoom.height
    };
    
    const sourceEndRelative = {
      x: sourcePath.x2 / sourceRoom.width,
      y: sourcePath.y2 / sourceRoom.height
    };
    
    // Calculate the same relative positions in the target room
    const targetStartX = sourceStartRelative.x * targetRoom.width;
    const targetStartY = sourceStartRelative.y * targetRoom.height;
    const targetEndX = sourceEndRelative.x * targetRoom.width;
    const targetEndY = sourceEndRelative.y * targetRoom.height;
    
    // Create the new portals with connections
    const sourcePortal: PortalType = {
      id: sourcePortalId,
      wallPosition: 'top', // Default, not used for internal portals
      position: 0, // Default, not used for internal portals
      width: 0.1, // Default, not used for internal portals
      connectedRoomId: targetRoomId,
      connectedPortalId: targetPortalId,
      // Internal portal coordinates
      startX: sourcePath.x1,
      startY: sourcePath.y1,
      endX: sourcePath.x2,
      endY: sourcePath.y2,
      // Store relative positions for maintaining portal positions during room resizing
      relativeStartX: sourceStartRelative.x,
      relativeStartY: sourceStartRelative.y,
      relativeEndX: sourceEndRelative.x,
      relativeEndY: sourceEndRelative.y
    };
    
    const targetPortal: PortalType = {
      id: targetPortalId,
      wallPosition: 'top', // Default, not used for internal portals
      position: 0, // Default, not used for internal portals
      width: 0.1, // Default, not used for internal portals
      connectedRoomId: sourceRoomId,
      connectedPortalId: sourcePortalId,
      // Internal portal coordinates
      startX: targetStartX,
      startY: targetStartY,
      endX: targetEndX,
      endY: targetEndY,
      // Store relative positions for maintaining portal positions during room resizing
      relativeStartX: sourceStartRelative.x,
      relativeStartY: sourceStartRelative.y,
      relativeEndX: sourceEndRelative.x,
      relativeEndY: sourceEndRelative.y
    };
    
    // Update the floor plan with new portals
    const updatedRooms = floorPlan.rooms.map(room => {
      if (room.id === sourceRoomId) {
        return {
          ...room,
          portals: [...room.portals, sourcePortal]
        };
      } else if (room.id === targetRoomId) {
        return {
          ...room,
          portals: [...room.portals, targetPortal]
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
    
    // Clear the pending portal state
    setPendingPortal(null);
    
    // Automatically exit portal placement mode
    setIsPortalPlacementActive(false);
  };

  // Render portal preview during drawing
  const renderPortalPreview = () => {
    if (!isDrawingPortal || !portalStartPoint || !portalPreview) return null;
    
    const room = floorPlan.rooms.find(r => r.id === portalStartPoint.roomId);
    if (!room) return null;
    
    return (
      <Group>
        <Line
          x={room.x}
          y={room.y}
          points={[
            portalPreview.startX,
            portalPreview.startY,
            portalPreview.endX,
            portalPreview.endY
          ]}
          stroke="purple"
          strokeWidth={3}
          dash={[5, 5]}
        />
      </Group>
    );
  };

  // Render target room selection UI when a portal is pending
  const renderRoomSelectionUI = () => {
    if (!pendingPortal) return null;
    
    // Filter rooms that are not the source room
    const availableRooms = floorPlan.rooms.filter(room => room.id !== pendingPortal.roomId);
    
    return (
      <div className="room-selection-ui">
        <div className="selection-overlay" onClick={() => setPendingPortal(null)} />
        <div className="selection-modal">
          <h3>Select Room to Connect Portal</h3>
          <p>Choose which room this portal connects to:</p>
          <div className="room-selection-list">
            {availableRooms.map(room => (
              <button
                key={room.id}
                onClick={() => {
                  createConnectedPortals(
                    pendingPortal.roomId,
                    room.id,
                    {
                      x1: pendingPortal.startX,
                      y1: pendingPortal.startY,
                      x2: pendingPortal.endX,
                      y2: pendingPortal.endY
                    }
                  );
                }}
                style={{ backgroundColor: room.color }}
              >
                {room.name}
              </button>
            ))}
          </div>
          <button className="cancel-btn" onClick={() => setPendingPortal(null)}>
            Cancel
          </button>
        </div>
      </div>
    );
  };

  // Handle portal delete
  const handlePortalDelete = (roomId: string, portalId: string) => {
    const room = floorPlan.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Find the portal
    const portal = room.portals.find(p => p.id === portalId);
    if (!portal) return;
    
    // Find the connected room and portal
    const connectedRoomId = portal.connectedRoomId;
    const connectedPortalId = portal.connectedPortalId;
    
    // Update rooms, removing the portals
    let updatedRooms = floorPlan.rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          portals: r.portals.filter(p => p.id !== portalId)
        };
      }
      
      // Also remove the connected portal from the other room if it exists
      if (connectedRoomId && r.id === connectedRoomId) {
        return {
          ...r,
          portals: r.portals.filter(p => p.id !== connectedPortalId)
        };
      }
      
      return r;
    });
    
    // Update the floor plan
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: updatedRooms
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
    
    // Clear selection
    setSelectedPortalId(null);
    setSelectedPortalEnd(null);
  };

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
        <div className="zoom-slider-container">
          <input
            type="range"
            min={Math.round(getZoomLimits().minScale * 100)}
            max={Math.round(getZoomLimits().maxScale * 100)}
            value={Math.round(scale * 100)}
            onChange={handleZoomSliderChange}
            className="zoom-slider"
          />
          <span className="zoom-label">{Math.round(scale * 100)}%</span>
        </div>
        <button onClick={addRoom}>{isPlacingRoom ? "Cancel Room" : "Add Room (n)"}</button>
        {setIsWallPlacementActive && selectedId && (
          <button 
            onClick={toggleWallPlacement}
            className={isWallPlacementActive ? 'active' : ''}
          >
            {isWallPlacementActive ? "Cancel Wall" : "Add Wall"}
          </button>
        )}
        {selectedId && (
          <button 
            onClick={togglePortalPlacement}
            className={isPortalPlacementActive ? 'active' : ''}
          >
            {isPortalPlacementActive ? "Cancel Portal" : "Add Portal"}
          </button>
        )}
        <span className="grid-info">Grid: {floorPlan.gridSizeWidth}×{floorPlan.gridSizeHeight}mm</span>
        <span className="scale-info">Scale: {(scale * 100).toFixed(0)}% ({(floorPlan.gridSizeWidth * scale).toFixed(1)}mm/cell)</span>
        {selectedId && <span className="selected-info">Room selected: {floorPlan.rooms.find(r => r.id === selectedId)?.name}</span>}
        {isPlacingRoom && <span className="placement-info">Click to place room</span>}
        {isWallPlacementActive && <span className="placement-info">Click and drag within {selectedId ? floorPlan.rooms.find(r => r.id === selectedId)?.name : 'selected room'} to create wall</span>}
        {selectedWallId && <span className="placement-info">Wall selected (Delete/Backspace to remove)</span>}
        {selectedVertexId && <span className="placement-info">Vertex selected (Drag to move, Delete/Backspace to remove)</span>}
      </div>
      
      {/* Help tooltip for walls and vertices */}
      <div className="interaction-tooltip">
        {isWallPlacementActive && 
          "Click and drag to create walls. Click on existing vertices to connect walls. Press ESC to cancel."
        }
        {isPortalPlacementActive && 
          "Click and drag to create a portal within a room. After drawing, select which room to connect to. Press ESC to cancel."
        }
        {!isWallPlacementActive && !isPortalPlacementActive && selectedWallId && 
          "Press Delete or Backspace to remove the selected wall. Ctrl+Double-click also works."
        }
        {!isWallPlacementActive && !isPortalPlacementActive && selectedVertexId && 
          "Drag to move vertex. Press Delete to remove (only works for vertices used by one wall)."
        }
        {!isWallPlacementActive && !isPortalPlacementActive && selectedPortalId && 
          "Drag portal vertices to reshape the portal. Changes will be mirrored in the connected room. Press Delete to remove the portal connection."
        }
      </div>
      <Stage 
        width={width} 
        height={height}
        onClick={handleDeselect}
        ref={stageRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseDown={handleCanvasClick}
        onMouseUp={handleStageMouseUp}
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
              disableDragging={isWallPlacementActive || isPortalPlacementActive}
              onWallSelect={handleWallSelect}
              onVertexSelect={handleVertexSelect}
              onVertexDrag={handleVertexDrag}
              onWallDelete={handleWallDelete}
              selectedWallId={selectedWallId}
              selectedVertexId={selectedVertexId}
              onPortalSelect={handlePortalSelect}
              onPortalDrag={handlePortalDrag}
              selectedPortalId={selectedPortalId}
              selectedPortalEnd={selectedPortalEnd}
            />
          ))}
          
          {/* Wall preview */}
          {renderWallPreview()}
          
          {/* Portal preview */}
          {renderPortalPreview()}
        </Layer>
      </Stage>
      
      {/* Room selection UI when a portal is pending */}
      {renderRoomSelectionUI()}
    </div>
  );
};

export default FloorPlanCanvas; 