export interface Portal extends Wall {
  // Connection information
  connectedRoomId: string | null;
  // ID of the connected portal in the other room
  connectedPortalId: string | null;
  // Whether this is a portal (distinguishes from regular walls)
  isPortal: true;
}

export interface Vertex {
  id: string;
  x: number;
  y: number;
  // Optional flag to mark vertices that are part of portals
  isPortalVertex?: boolean;
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
  // List of portals in this room (deprecated, use portalIds instead)
  portals: Portal[];
  // List of portal IDs referencing objects in the walls array
  portalIds: string[];
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