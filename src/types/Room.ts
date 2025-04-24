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