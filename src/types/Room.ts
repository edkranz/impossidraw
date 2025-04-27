export interface Portal {
  id: string;
  wallPosition: 'top' | 'right' | 'bottom' | 'left';
  // Position along the wall (0-1 normalized)
  position: number;
  // Width of the portal (normalized 0-1)
  width: number;
  // ID of the connected room
  connectedRoomId: string | null;
  // ID of the connected portal in the other room
  connectedPortalId: string | null;
}

export interface Vertex {
  id: string;
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  // IDs of the vertices that form this wall
  vertexIds: string[];
  // Whether this wall is selected
  isSelected?: boolean;
}

export interface Room {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  // Color for display
  color: string;
  // List of portals in this room
  portals: Portal[];
  // List of internal walls in this room
  walls: Wall[];
  // List of vertices used by walls in this room
  vertices: Vertex[];
  // Grid cell coordinates
  gridX: number;
  gridY: number;
}

// Custom type for the overall floor plan
export interface FloorPlan {
  // Grid size in millimeters
  gridSizeWidth: number;
  gridSizeHeight: number;
  
  // Collection of rooms
  rooms: Room[];
} 