import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Group, Line, Rect } from 'react-konva';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { Room as RoomType, Portal as PortalType, FloorPlan, Wall as WallType, Vertex as VertexType } from '../types/Room';
import Room from './shapes/Room';
import '../styles/FloorPlanCanvas.css';
import { useGesture } from '@use-gesture/react';
import { getPortalColor } from '../utils/portalUtils';

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
  const [scale, setScale] = useState(0.25);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef<Konva.Stage>(null);
  const [isDraggingRoom, setIsDraggingRoom] = useState(false);
  const [isPlacingRoom, setIsPlacingRoom] = useState(false);
  const [previewRoomPosition, setPreviewRoomPosition] = useState({ gridX: 0, gridY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Portal placement state
  const [isPortalPlacementActive, setIsPortalPlacementActive] = useState(false);
  
  // Wall drawing state
  const [isDrawingWall, setIsDrawingWall] = useState(false);
  const [wallStartPoint, setWallStartPoint] = useState<{ x: number, y: number, roomId: string, vertexId?: string } | null>(null);
  const [wallPreview, setWallPreview] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  
  // Add portal drawing state similar to wall drawing state
  const [isDrawingPortal, setIsDrawingPortal] = useState(false);
  const [portalStartPoint, setPortalStartPoint] = useState<{ x: number, y: number, roomId: string, vertexId?: string } | null>(null);
  const [portalPreview, setPortalPreview] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  
  // Wall/vertex selection state
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null);

  // Add state to track portal connection
  const [pendingPortalConnection, setPendingPortalConnection] = useState<{
    sourceRoomId: string;
    portalId: string;
    vertices: { x: number, y: number }[];
    color: string | null;
  } | null>(null);

  // Add state for storing the temporary portal color
  const [pendingPortalColor, setPendingPortalColor] = useState<string | null>(null);

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
        setPendingPortalConnection(null);
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
  }, [selectedId, selectedWallId, selectedVertexId, floorPlan, isPlacingRoom, isWallPlacementActive, isPortalPlacementActive, pendingPortalConnection]);

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
    // If we're waiting for a portal connection target, handle the connection
    if (pendingPortalConnection) {
      handleRoomClickForPortalConnection(id);
      return;
    }
    
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
    if (isWallPlacementActive && isDrawingWall) {
      return;
    }
    
    // Don't deselect if we're in portal placement mode and drawing a portal
    if (isPortalPlacementActive && isDrawingPortal) {
      return;
    }
    
    // Deselect when clicking on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      // If we're in the portal connection phase, cancel it
      if (pendingPortalConnection) {
        setPendingPortalConnection(null);
        setIsPortalPlacementActive(false);
        return;
      }
      
      // Clear all selections
      setSelectedId(null);
      setSelectedWallId(null);
      setSelectedVertexId(null);
      
      // If wall placement is active, deactivate it
      if (isWallPlacementActive && setIsWallPlacementActive) {
        setIsWallPlacementActive(false);
      }
      
      // If portal placement is active, deactivate it
      if (isPortalPlacementActive) {
        setIsPortalPlacementActive(false);
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
      portalIds: [],
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

  const addPortalToRoom = (roomId: string, startVertexId: string | null, startX: number, startY: number, endX: number, endY: number) => {
    const portalId = `portal-${uuidv4()}`;
    
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
            y: startY,
            isPortalVertex: true
          };
          newVertices.push(startVertex);
        } else if (!startVertex.isPortalVertex) {
          // If using existing vertex, mark it as a portal vertex
          startVertex = {
            ...startVertex,
            isPortalVertex: true
          };
        }
        
        if (!endVertex) {
          endVertex = {
            id: `vertex-${uuidv4()}`,
            x: endX,
            y: endY,
            isPortalVertex: true
          };
          newVertices.push(endVertex);
        } else if (!endVertex.isPortalVertex) {
          // If using existing vertex, mark it as a portal vertex
          endVertex = {
            ...endVertex,
            isPortalVertex: true
          };
        }
        
        // Create the new portal - similar to a wall but with isPortal flag
        const newPortal: PortalType = {
          id: portalId,
          vertexIds: [startVertex.id, endVertex.id],
          isPortal: true,
          connectedRoomId: null,
          connectedPortalId: null
        };
        
        // Update existing vertices if needed
        const updatedVertices = room.vertices.map(v => {
          if (v.id === startVertex?.id && !v.isPortalVertex) {
            return { ...v, isPortalVertex: true };
          }
          if (v.id === endVertex?.id && !v.isPortalVertex) {
            return { ...v, isPortalVertex: true };
          }
          return v;
        });
        
        // Add any new vertices
        const finalVertices = [
          ...updatedVertices.filter(v => !newVertices.some(nv => nv.id === v.id)),
          ...newVertices
        ];
        
        return {
          ...room,
          walls: [...room.walls, newPortal],
          vertices: finalVertices
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
    // Import the utility function to find portals
    const { findConnectedPortal } = require('../utils/portalUtils');
    
    // If we're not in portal connecting mode yet
    if (!selectedId) {
      setSelectedId(roomId);
      return;
    }
    
    // If we clicked the same portal, cancel connecting mode
    if (selectedId === roomId) {
      setSelectedId(null);
      return;
    }
    
    // Connect the two portals
    const updatedRooms = floorPlan.rooms.map(room => {
      // Find the actual portal walls in the walls array
      const isPortal = (wall: any) => 'isPortal' in wall && wall.isPortal === true;
      
      // Update the first portal
      if (room.id === selectedId) {
        const updatedWalls = room.walls.map(wall => {
          if (isPortal(wall) && wall.id === portalId) {
            return {
              ...wall,
              connectedRoomId: roomId,
              connectedPortalId: portalId
            };
          }
          return wall;
        });
        
        return {
          ...room,
          walls: updatedWalls
        };
      }
      
      // Update the second portal
      if (room.id === roomId) {
        const updatedWalls = room.walls.map(wall => {
          if (isPortal(wall) && wall.id === portalId) {
            return {
              ...wall,
              connectedRoomId: selectedId,
              connectedPortalId: portalId
            };
          }
          return wall;
        });
        
        return {
          ...room,
          walls: updatedWalls
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
    setSelectedId(null);
  };

  // Toggle wall placement mode
  const toggleWallPlacement = () => {
    if (setIsWallPlacementActive) {
      setIsWallPlacementActive(!isWallPlacementActive);
      // Cancel room placement if active
      if (isPlacingRoom) {
        setIsPlacingRoom(false);
      }
    }
  };

  // Toggle portal placement mode
  const togglePortalPlacement = () => {
    // Reset portal drawing state when toggling
    setIsDrawingPortal(false);
    setPortalStartPoint(null);
    setPortalPreview(null);
    setPendingPortalConnection(null);
    
    setIsPortalPlacementActive(!isPortalPlacementActive);
    
    // Cancel other placement modes if active
    if (isPlacingRoom) {
      setIsPlacingRoom(false);
    }
    
    if (isWallPlacementActive && setIsWallPlacementActive) {
      setIsWallPlacementActive(false);
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
      }
    }
  };

  // Handle vertex drag
  const handleVertexDrag = (roomId: string, vertexId: string, newX: number, newY: number) => {
    const room = floorPlan.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Get the vertex being dragged
    const draggedVertex = room.vertices.find(v => v.id === vertexId);
    if (!draggedVertex) return;
    
    // Check if this vertex is part of a portal that has a connection
    let connectedPortalInfo: {
      sourceRoomId: string;
      sourcePortalId: string;
      targetRoomId: string;
      targetPortalId: string;
      draggedVertexIndex: number;
    } | null = null;
    
    // Find if this vertex belongs to a portal
    if (draggedVertex.isPortalVertex) {
      // Find which portal this vertex belongs to
      for (const wall of room.walls) {
        if (wall.vertexIds.includes(vertexId) && 'isPortal' in wall) {
          // First cast to PortalType to access portal properties
          const portalWall = wall as PortalType;
          if (portalWall.connectedRoomId && portalWall.connectedPortalId) {
            // Found a portal that uses this vertex and has a connection
            
            // Get the connected room and portal
            const targetRoom = floorPlan.rooms.find(r => r.id === portalWall.connectedRoomId);
            if (targetRoom) {
              // Find the connected portal in the target room
              const targetPortal = targetRoom.walls.find(w => w.id === portalWall.connectedPortalId) as PortalType | undefined;
              if (targetPortal) {
                // Store information about the connection for later use
                connectedPortalInfo = {
                  sourceRoomId: roomId,
                  sourcePortalId: portalWall.id,
                  targetRoomId: targetRoom.id,
                  targetPortalId: targetPortal.id,
                  // Index of the dragged vertex in the portal's vertex array (0 or 1 for start or end)
                  draggedVertexIndex: portalWall.vertexIds.indexOf(vertexId)
                };
                break;
              }
            }
          }
        }
      }
    }
    
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
      
      // If this was part of a connected portal, we need to handle the connected portal too
      let updatedRooms;
      if (connectedPortalInfo !== null) {
        // We'll need to update the rooms with the merged portals
        updatedRooms = floorPlan.rooms.map(r => {
          if (r.id === roomId) {
            return {
              ...r,
              walls: updatedWalls,
              vertices: updatedVertices
            };
          }
          
          // Handle the connected room's portal if needed (for merging)
          // This will need custom implementation based on the app's requirements
          return r;
        });
      } else {
        // Normal merge operation without connected portals
        updatedRooms = floorPlan.rooms.map(r => {
          if (r.id === roomId) {
            return {
              ...r,
              walls: updatedWalls,
              vertices: updatedVertices
            };
          }
          return r;
        });
      }
      
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
      // For connected portals, calculate relative movement in both rooms
      let updatedRooms;
      
      if (connectedPortalInfo !== null) {
        const sourceRoom = room; // The room with the vertex being dragged
        const targetRoomId = connectedPortalInfo.targetRoomId;
        const targetPortalId = connectedPortalInfo.targetPortalId;
        const draggedVertexIndex = connectedPortalInfo.draggedVertexIndex;
        
        const targetRoom = floorPlan.rooms.find(r => r.id === targetRoomId);
        
        if (targetRoom) {
          // Calculate how much the vertex has moved in relative terms
          const oldVertex = sourceRoom.vertices.find(v => v.id === vertexId);
          if (!oldVertex) return;
          
          // Calculate movement in relative units (0-1)
          const relativeXMovement = (newX - oldVertex.x) / sourceRoom.width;
          const relativeYMovement = (newY - oldVertex.y) / sourceRoom.height;
          
          // Find the target portal vertex that corresponds to the dragged vertex
          const targetPortal = targetRoom.walls.find(w => w.id === targetPortalId) as PortalType | undefined;
          if (!targetPortal) return;
          
          // Get the target vertex ID at the same position (first or second)
          const targetVertexId = targetPortal.vertexIds[draggedVertexIndex];
          
          // Find the target vertex
          const targetPortalVertex = targetRoom.vertices.find(v => v.id === targetVertexId);
          if (!targetPortalVertex) return;
          
          // Calculate the absolute movement for the target vertex
          const targetXMovement = relativeXMovement * targetRoom.width;
          const targetYMovement = relativeYMovement * targetRoom.height;
          
          // Calculate new coordinates for the target vertex
          const newTargetX = targetPortalVertex.x + targetXMovement;
          const newTargetY = targetPortalVertex.y + targetYMovement;
          
          // Update both rooms
          updatedRooms = floorPlan.rooms.map(r => {
            if (r.id === roomId) {
              // Update source room vertex
              return {
                ...r,
                vertices: r.vertices.map(vertex => {
                  if (vertex.id === vertexId) {
                    return {
                      ...vertex,
                      x: newX,
                      y: newY
                    };
                  }
                  return vertex;
                })
              };
            } 
            else if (r.id === targetRoom.id) {
              // Update target room vertex
              return {
                ...r,
                vertices: r.vertices.map(vertex => {
                  if (vertex.id === targetVertexId) {
                    return {
                      ...vertex,
                      x: newTargetX,
                      y: newTargetY
                    };
                  }
                  return vertex;
                })
              };
            }
            return r;
          });
        } else {
          // If target room not found, just update the source room
          updatedRooms = floorPlan.rooms.map(room => {
            if (room.id === roomId) {
              return {
                ...room,
                vertices: room.vertices.map(vertex => {
                  if (vertex.id === vertexId) {
                    return {
                      ...vertex,
                      x: newX,
                      y: newY
                    };
                  }
                  return vertex;
                })
              };
            }
            return room;
          });
        }
      } else {
        // Normal vertex movement without connected portals
        updatedRooms = floorPlan.rooms.map(room => {
          if (room.id === roomId) {
            return {
              ...room,
              vertices: room.vertices.map(vertex => {
                if (vertex.id === vertexId) {
                  return {
                    ...vertex,
                    x: newX,
                    y: newY
                  };
                }
                return vertex;
              })
            };
          }
          return room;
        });
      }
      
      const updatedFloorPlan = {
        ...floorPlan,
        rooms: updatedRooms
      };
      
      setFloorPlan(updatedFloorPlan);
      addToHistory(updatedFloorPlan);
    }
  };

  // Handle wall deletion
  const handleWallDelete = (roomId: string, wallId: string) => {
    // Find the wall to delete
    const roomToUpdate = floorPlan.rooms.find(r => r.id === roomId);
    if (!roomToUpdate) return;

    const wallToDelete = roomToUpdate.walls.find(w => w.id === wallId);
    if (!wallToDelete) return;

    // Check if the wall is a portal with a connected portal
    const isPortalWithConnection = 'isPortal' in wallToDelete && 
                                   wallToDelete.isPortal === true && 
                                   (wallToDelete as PortalType).connectedRoomId && 
                                   (wallToDelete as PortalType).connectedPortalId;

    let updatedRooms = floorPlan.rooms.map(room => {
      // Handle deleting the current wall/portal
      if (room.id === roomId) {
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
      
      // If deleting a portal, also delete the connected portal in the other room
      if (isPortalWithConnection) {
        const portal = wallToDelete as PortalType;
        if (room.id === portal.connectedRoomId) {
          // Find and delete the connected portal
          const connectedPortalId = portal.connectedPortalId;
          const connectedPortal = room.walls.find(w => w.id === connectedPortalId);
          
          if (connectedPortal) {
            // Check which vertices will become unused
            const vertexUsageCounts: Record<string, number> = {};
            
            // Count how many walls use each vertex
            room.walls.forEach(wall => {
              wall.vertexIds.forEach(vertexId => {
                vertexUsageCounts[vertexId] = (vertexUsageCounts[vertexId] || 0) + 1;
              });
            });
            
            // Get vertices that will only be used by this portal (count === 1)
            const unusedVertexIds = connectedPortal.vertexIds.filter(
              vertexId => vertexUsageCounts[vertexId] === 1
            );
            
            // Remove the connected portal
            const updatedWalls = room.walls.filter(wall => wall.id !== connectedPortalId);
            
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
        }
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

  // Update handlePortalDrawingStart to use a temporary portal ID
  const handlePortalDrawingStart = (roomId: string, x: number, y: number, existingVertexId?: string) => {
    if (!isPortalPlacementActive) return;
    
    // Only allow portal drawing in the selected room
    if (selectedId !== roomId) return;
    
    // Find the room in global coordinates
    const room = floorPlan.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Create a temporary portal ID to use for color generation
    const tempPortalId = `temp-portal-${uuidv4()}`;
    setPendingPortalColor(getPortalColor({ 
      id: tempPortalId, 
      vertexIds: [], 
      isPortal: true, 
      connectedRoomId: null, 
      connectedPortalId: null 
    }));
    
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
        setIsDrawingPortal(true);
        setPortalStartPoint({ 
          x: nearestVertex.x, 
          y: nearestVertex.y, 
          roomId,
          vertexId: nearestVertex.id
        });
        setPortalPreview({ 
          startX: nearestVertex.x, 
          startY: nearestVertex.y, 
          endX: nearestVertex.x, 
          endY: nearestVertex.y 
        });
        return;
      }
    }
    
    setIsDrawingPortal(true);
    setPortalStartPoint({ 
      x: localX, 
      y: localY, 
      roomId,
      vertexId: existingVertexId
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
    
    // Update portal preview
    setPortalPreview({
      startX: portalStartPoint.x,
      startY: portalStartPoint.y,
      endX: snapToX,
      endY: snapToY
    });
  };

  const handlePortalDrawingEnd = () => {
    if (!isDrawingPortal || !portalStartPoint || !portalPreview) return;
    
    // Check if portal has a minimum length (to prevent accidental clicks)
    const dx = portalPreview.endX - portalPreview.startX;
    const dy = portalPreview.endY - portalPreview.startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 10) { // Minimum 10px length
      // Create portal ID
      const portalId = `portal-${uuidv4()}`;
      const roomId = portalStartPoint.roomId;
      
      // Find the room to add the portal to
      const updatedRooms = floorPlan.rooms.map(room => {
        if (room.id === roomId) {
          // Similar to wall creation but creating a portal
          // Check if we have an existing vertex to start from
          let startVertex: VertexType | null = null;
          if (portalStartPoint.vertexId) {
            startVertex = room.vertices.find(v => v.id === portalStartPoint.vertexId) || null;
          }
          
          // Check if there's an existing vertex near the end point
          const endVertexSensitivity = 10; // pixels
          let endVertex: VertexType | null = null;
          
          for (const vertex of room.vertices) {
            const dx = vertex.x - portalPreview.endX;
            const dy = vertex.y - portalPreview.endY;
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
              x: portalPreview.startX,
              y: portalPreview.startY,
              isPortalVertex: true
            };
            newVertices.push(startVertex);
          } else if (!startVertex.isPortalVertex) {
            // Mark existing vertex as portal vertex
            startVertex = {
              ...startVertex,
              isPortalVertex: true
            };
          }
          
          if (!endVertex) {
            endVertex = {
              id: `vertex-${uuidv4()}`,
              x: portalPreview.endX,
              y: portalPreview.endY,
              isPortalVertex: true
            };
            newVertices.push(endVertex);
          } else if (!endVertex.isPortalVertex) {
            // Mark existing vertex as portal vertex
            endVertex = {
              ...endVertex,
              isPortalVertex: true
            };
          }
          
          // Create the portal as a special type of wall
          const newPortal: PortalType = {
            id: portalId,
            vertexIds: [startVertex.id, endVertex.id],
            isPortal: true,
            connectedRoomId: null,
            connectedPortalId: null
          };
          
          // Update existing vertices if needed
          const updatedVertices = room.vertices.map(v => {
            if (v.id === startVertex?.id && !v.isPortalVertex) {
              return { ...v, isPortalVertex: true };
            }
            if (v.id === endVertex?.id && !v.isPortalVertex) {
              return { ...v, isPortalVertex: true };
            }
            return v;
          });
          
          // Add any new vertices
          const finalVertices = [
            ...updatedVertices.filter(v => !newVertices.some(nv => nv.id === v.id)),
            ...newVertices
          ];
          
          return {
            ...room,
            walls: [...room.walls, newPortal],
            vertices: finalVertices
          };
        }
        return room;
      });
      
      const updatedFloorPlan = {
        ...floorPlan,
        rooms: updatedRooms
      };
      
      // Update state
      setFloorPlan(updatedFloorPlan);
      addToHistory(updatedFloorPlan);
      
      // Store portal information for the second step
      setPendingPortalConnection({
        sourceRoomId: roomId,
        portalId,
        vertices: [
          { x: portalPreview.startX, y: portalPreview.startY },
          { x: portalPreview.endX, y: portalPreview.endY }
        ],
        color: pendingPortalColor
      });
      
      // Change message to instruct user to select destination room
    }
    
    // Reset portal drawing state, but keep the color for the connection
    setIsDrawingPortal(false);
    setPortalStartPoint(null);
    setPortalPreview(null);
  };

  // Handle selecting a room to connect the portal to
  const handleRoomClickForPortalConnection = (targetRoomId: string) => {
    if (!pendingPortalConnection || targetRoomId === pendingPortalConnection.sourceRoomId) {
      return;
    }
    
    // Find source and target rooms
    const sourceRoom = floorPlan.rooms.find(r => r.id === pendingPortalConnection.sourceRoomId);
    const targetRoom = floorPlan.rooms.find(r => r.id === targetRoomId);
    
    if (!sourceRoom || !targetRoom) {
      setPendingPortalConnection(null);
      return;
    }
    
    // Find the source portal
    const sourcePortal = sourceRoom.walls.find(w => w.id === pendingPortalConnection.portalId) as PortalType | undefined;
    if (!sourcePortal) {
      setPendingPortalConnection(null);
      return;
    }
    
    // Create a mirror portal in the target room
    const mirrorPortalId = `portal-${uuidv4()}`;
    
    // Calculate where to place the mirror portal in the target room
    // This will create a portal at the same relative position in the target room
    const [startPoint, endPoint] = pendingPortalConnection.vertices;
    
    // Calculate relative positions within the source room
    const relStartX = startPoint.x / sourceRoom.width;
    const relStartY = startPoint.y / sourceRoom.height;
    const relEndX = endPoint.x / sourceRoom.width;
    const relEndY = endPoint.y / sourceRoom.height;
    
    // Calculate absolute positions in the target room
    const targetStartX = relStartX * targetRoom.width;
    const targetStartY = relStartY * targetRoom.height;
    const targetEndX = relEndX * targetRoom.width;
    const targetEndY = relEndY * targetRoom.height;
    
    // Create vertices for the mirrored portal
    const mirrorStartVertexId = `vertex-${uuidv4()}`;
    const mirrorEndVertexId = `vertex-${uuidv4()}`;
    
    const updatedRooms = floorPlan.rooms.map(room => {
      // Update the source room portal to connect to the target
      if (room.id === pendingPortalConnection.sourceRoomId) {
        const updatedWalls = room.walls.map(wall => {
          if (wall.id === pendingPortalConnection.portalId) {
            return {
              ...wall,
              connectedRoomId: targetRoomId,
              connectedPortalId: mirrorPortalId
            };
          }
          return wall;
        });
        
        return {
          ...room,
          walls: updatedWalls
        };
      }
      
      // Create the mirrored portal in the target room
      if (room.id === targetRoomId) {
        // Create new vertices for the mirror portal
        const mirrorStartVertex: VertexType = {
          id: mirrorStartVertexId,
          x: targetStartX,
          y: targetStartY,
          isPortalVertex: true
        };
        
        const mirrorEndVertex: VertexType = {
          id: mirrorEndVertexId,
          x: targetEndX,
          y: targetEndY,
          isPortalVertex: true
        };
        
        // Create the mirror portal
        const mirrorPortal: PortalType = {
          id: mirrorPortalId,
          vertexIds: [mirrorStartVertexId, mirrorEndVertexId],
          isPortal: true,
          connectedRoomId: pendingPortalConnection.sourceRoomId,
          connectedPortalId: pendingPortalConnection.portalId
        };
        
        return {
          ...room,
          walls: [...room.walls, mirrorPortal],
          vertices: [...room.vertices, mirrorStartVertex, mirrorEndVertex]
        };
      }
      
      return room;
    });
    
    // Update the floor plan with both portals connected
    const updatedFloorPlan = {
      ...floorPlan,
      rooms: updatedRooms
    };
    
    setFloorPlan(updatedFloorPlan);
    addToHistory(updatedFloorPlan);
    
    // Clear the pending connection and color
    setPendingPortalConnection(null);
    setPendingPortalColor(null);
    setIsPortalPlacementActive(false);
  };

  // Handle canvas click now supports portal placement similar to wall placement
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
    
    // If we're waiting for the second room to place a portal, don't do anything
    // (selection is handled in the handleSelect function)
    if (pendingPortalConnection) {
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
    if (isPortalPlacementActive && selectedId && !pendingPortalConnection) {
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

  // Update handleCanvasMouseMove to handle portal drawing
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

  // Update handleStageMouseUp to handle portal drawing end
  const handleStageMouseUp = () => {
    if (isDrawingWall) {
      handleWallDrawingEnd();
    }
    
    if (isDrawingPortal) {
      handlePortalDrawingEnd();
    }
  };

  // Render portal preview during drawing
  const renderPortalPreview = () => {
    if (!isDrawingPortal || !portalStartPoint || !portalPreview) return null;
    
    const room = floorPlan.rooms.find(r => r.id === portalStartPoint.roomId);
    if (!room) return null;
    
    // Scale preview line thickness inversely proportional to zoom
    const scaledThickness = Math.max(8/scale, 0.5);
    
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
          stroke={pendingPortalColor || "#4CAF50"}
          strokeWidth={scaledThickness}
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
    
    // Calculate grid line thickness that ensures consistent visual thickness
    // Base thickness when scale is 1.0, then adjust inversely proportional to zoom
    const baseThickness = 1;
    const gridLineThickness = Math.max(baseThickness / safeScale, 0.1);
    
    if (hLineCount > 0 && vLineCount > 0 && isFinite(hLineCount) && isFinite(vLineCount)) {
      // Vertical lines
      for (let x = leftEdge; x <= rightEdge; x += gridSizeWidth) {
        if (!isFinite(x)) continue;
        lines.push(
          <Line
            key={`v-${x}`}
            points={[x, topEdge, x, bottomEdge]}
            stroke="#ddd"
            strokeWidth={gridLineThickness}
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
            strokeWidth={gridLineThickness}
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
      const wallId = `wall-${uuidv4()}`;
      const roomId = wallStartPoint.roomId;
      
      // Find the room
      const updatedRooms = floorPlan.rooms.map(room => {
        if (room.id === roomId) {
          // Check if we have an existing vertex to start from
          let startVertex: VertexType | null = null;
          if (wallStartPoint.vertexId) {
            startVertex = room.vertices.find(v => v.id === wallStartPoint.vertexId) || null;
          }
          
          // Check if there's an existing vertex near the end point
          const endVertexSensitivity = 10; // pixels
          let endVertex: VertexType | null = null;
          
          for (const vertex of room.vertices) {
            const dx = vertex.x - wallPreview.endX;
            const dy = vertex.y - wallPreview.endY;
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
              x: wallPreview.startX,
              y: wallPreview.startY
            };
            newVertices.push(startVertex);
          }
          
          if (!endVertex) {
            endVertex = {
              id: `vertex-${uuidv4()}`,
              x: wallPreview.endX,
              y: wallPreview.endY
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

  // Render wall preview during drawing
  const renderWallPreview = () => {
    if (!isDrawingWall || !wallStartPoint || !wallPreview) return null;
    
    const room = floorPlan.rooms.find(r => r.id === wallStartPoint.roomId);
    if (!room) return null;
    
    // Scale preview line thickness inversely proportional to zoom
    const scaledThickness = Math.max(8/scale, 0.5);
    
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
          strokeWidth={scaledThickness}
          dash={[5, 5]}
        />
      </Group>
    );
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
            className={`portal-button ${isPortalPlacementActive ? 'active' : ''}`}
          >
            {isPortalPlacementActive ? "Cancel Portal" : "Add Portal"}
          </button>
        )}
        <span className="grid-info">Grid: {floorPlan.gridSizeWidth}×{floorPlan.gridSizeHeight}mm</span>
        <span className="scale-info">Scale: {(scale * 100).toFixed(0)}% ({(floorPlan.gridSizeWidth * scale).toFixed(1)}mm/cell)</span>
        {selectedId && <span className="selected-info">Room selected: {floorPlan.rooms.find(r => r.id === selectedId)?.name}</span>}
        {isPlacingRoom && <span className="placement-info">Click to place room</span>}
        {isWallPlacementActive && <span className="placement-info">Click and drag within {selectedId ? floorPlan.rooms.find(r => r.id === selectedId)?.name : 'selected room'} to create wall</span>}
        {isPortalPlacementActive && !pendingPortalConnection && 
          <span className="placement-info">Click and drag within {selectedId ? floorPlan.rooms.find(r => r.id === selectedId)?.name : 'selected room'} to create portal</span>
        }
        {pendingPortalConnection && 
          <span className="placement-info">Now select a target room to create the connected portal</span>
        }
        {selectedWallId && <span className="placement-info">Wall selected (Delete/Backspace to remove)</span>}
        {selectedVertexId && <span className="placement-info">Vertex selected (Drag to move, Delete/Backspace to remove)</span>}
      </div>
      
      {/* Help tooltip for walls and vertices */}
      <div className="interaction-tooltip">
        {isWallPlacementActive && 
          "Click and drag to create walls. Click on existing vertices to connect walls. Press ESC to cancel."
        }
        {isPortalPlacementActive && !pendingPortalConnection && 
          `Click and drag within ${selectedId ? floorPlan.rooms.find(r => r.id === selectedId)?.name : 'selected room'} to create portal. Press ESC to cancel.`
        }
        {pendingPortalConnection && 
          "Select another room to create a connected portal. The second portal will be placed at the same relative position. Press ESC to cancel."
        }
        {!isWallPlacementActive && !isPortalPlacementActive && selectedWallId && 
          "Press Delete or Backspace to remove the selected wall. Ctrl+Double-click also works."
        }
        {!isWallPlacementActive && !isPortalPlacementActive && selectedVertexId && 
          "Drag to move vertex. Press Delete to remove (only works for vertices used by one wall)."
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
              isPortalPlacementActive={isPortalPlacementActive}
              scale={scale} // Pass the current zoom level
            />
          ))}
          
          {/* Wall preview */}
          {renderWallPreview()}
          
          {/* Portal preview */}
          {renderPortalPreview()}
        </Layer>
      </Stage>
    </div>
  );
};

export default FloorPlanCanvas; 