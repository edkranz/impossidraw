import { Room, Portal, Vertex, Wall, FloorPlan } from '../types/Room';
import { v4 as uuidv4 } from 'uuid';

// Keep a cache of portal colors to ensure matching pairs have the same color
const portalColorCache: Record<string, string> = {};

/**
 * Generates a bright color for a portal based on its ID or its connection
 * The same color will be returned for a given portal ID or its connected portal ID
 */
export function getPortalColor(portal: Portal): string {
  // Use the portal ID as the key
  let portalId = portal.id;
  
  // If this portal has a connection, use the smaller of the two IDs
  // as the key to ensure both portals get the same color
  if (portal.connectedPortalId) {
    portalId = portal.id < portal.connectedPortalId ? portal.id : portal.connectedPortalId;
  }
  
  // If we've already generated a color for this connection, use it
  if (portalColorCache[portalId]) {
    return portalColorCache[portalId];
  }
  
  // Generate a deterministic color based on the ID string
  // This ensures the same ID always gets the same color
  let hash = 0;
  for (let i = 0; i < portalId.length; i++) {
    hash = portalId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert hash to HSL color
  // Use a high saturation and moderate lightness for bright, distinct colors
  const hue = Math.abs(hash % 360);
  const saturation = 80; // High saturation for vibrant colors
  const lightness = 55; // Medium lightness for visibility
  
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  
  // Cache the color for this connection
  portalColorCache[portalId] = color;
  
  return color;
}

// Define the legacy portal type for migration purposes
interface LegacyPortal {
  id?: string;
  wallPosition: 'top' | 'right' | 'bottom' | 'left';
  position: number;
  width: number;
  connectedRoomId: string | null;
  connectedPortalId: string | null;
}

/**
 * Creates a pair of connected portals between two rooms
 */
export function createPortalPair(
  sourceRoom: Room,
  targetRoom: Room,
  sourceVertexIds: string[],
  targetVertexIds: string[]
): { sourcePortal: Portal; targetPortal: Portal } {
  // Create source portal
  const sourcePortalId = uuidv4();
  const sourcePortal: Portal = {
    id: sourcePortalId,
    vertexIds: sourceVertexIds,
    isPortal: true,
    connectedRoomId: targetRoom.id,
    connectedPortalId: null, // Will be set after creating target portal
  };

  // Create target portal
  const targetPortalId = uuidv4();
  const targetPortal: Portal = {
    id: targetPortalId,
    vertexIds: targetVertexIds,
    isPortal: true,
    connectedRoomId: sourceRoom.id,
    connectedPortalId: sourcePortalId,
  };

  // Update source portal with target portal ID
  sourcePortal.connectedPortalId = targetPortalId;

  return { sourcePortal, targetPortal };
}

/**
 * Converts old-style portal format to new wall-based format
 */
export function convertLegacyPortals(room: Room): Room {
  const newRoom = { ...room };
  const newPortals: Portal[] = [];
  const newPortalIds: string[] = [];
  
  // Cast the old portals array to LegacyPortal for the conversion
  const legacyPortals = room.portals as unknown as LegacyPortal[];
  
  // For each legacy portal, create vertices and a wall-based portal
  legacyPortals.forEach(legacyPortal => {
    // Create vertices based on wall position and normalized position
    const portalStartVertex: Vertex = {
      id: uuidv4(),
      isPortalVertex: true,
      x: 0, 
      y: 0
    };
    
    const portalEndVertex: Vertex = {
      id: uuidv4(),
      isPortalVertex: true,
      x: 0,
      y: 0
    };
    
    // Calculate actual coordinates based on room dimensions and portal position
    switch (legacyPortal.wallPosition) {
      case 'top':
        portalStartVertex.x = room.x + (room.width * legacyPortal.position);
        portalStartVertex.y = room.y;
        portalEndVertex.x = room.x + (room.width * (legacyPortal.position + legacyPortal.width));
        portalEndVertex.y = room.y;
        break;
      case 'right':
        portalStartVertex.x = room.x + room.width;
        portalStartVertex.y = room.y + (room.height * legacyPortal.position);
        portalEndVertex.x = room.x + room.width;
        portalEndVertex.y = room.y + (room.height * (legacyPortal.position + legacyPortal.width));
        break;
      case 'bottom':
        portalStartVertex.x = room.x + (room.width * legacyPortal.position);
        portalStartVertex.y = room.y + room.height;
        portalEndVertex.x = room.x + (room.width * (legacyPortal.position + legacyPortal.width));
        portalEndVertex.y = room.y + room.height;
        break;
      case 'left':
        portalStartVertex.x = room.x;
        portalStartVertex.y = room.y + (room.height * legacyPortal.position);
        portalEndVertex.x = room.x;
        portalEndVertex.y = room.y + (room.height * (legacyPortal.position + legacyPortal.width));
        break;
    }
    
    // Add vertices to room
    newRoom.vertices.push(portalStartVertex, portalEndVertex);
    
    // Create a portal based on the Wall interface
    const newPortal: Portal = {
      id: legacyPortal.id || uuidv4(),
      vertexIds: [portalStartVertex.id, portalEndVertex.id],
      isPortal: true,
      connectedRoomId: legacyPortal.connectedRoomId,
      connectedPortalId: legacyPortal.connectedPortalId
    };
    
    newPortals.push(newPortal);
    newPortalIds.push(newPortal.id);
    newRoom.walls.push(newPortal);
  });
  
  return {
    ...newRoom,
    portals: newPortals,
    portalIds: newPortalIds
  };
}

/**
 * Finds the connected portal in another room
 */
export function findConnectedPortal(portal: Portal, rooms: Room[]): Portal | null {
  if (!portal.connectedRoomId || !portal.connectedPortalId) return null;
  
  const connectedRoom = rooms.find(room => room.id === portal.connectedRoomId);
  if (!connectedRoom) return null;
  
  return connectedRoom.walls.find(
    wall => 'isPortal' in wall && wall.id === portal.connectedPortalId
  ) as Portal | null;
}

/**
 * Creates a portal from a wall segment
 * @param wall The wall to convert to a portal
 * @param sourceRoom The room containing the wall
 * @param targetRoom The room to connect to
 * @param floorPlan The entire floor plan
 * @param createCorrespondingPortal Whether to create a matching portal in the target room
 * @returns The updated floor plan
 */
export function createPortalFromWall(
  wall: Wall,
  sourceRoom: Room,
  targetRoom: Room,
  floorPlan: FloorPlan,
  createCorrespondingPortal: boolean = true
): FloorPlan {
  // Clone the floor plan to avoid mutation
  const newFloorPlan = { 
    ...floorPlan,
    rooms: [...floorPlan.rooms]
  };
  
  // Find the source room in the cloned floor plan
  const newSourceRoomIndex = newFloorPlan.rooms.findIndex((r: Room) => r.id === sourceRoom.id);
  if (newSourceRoomIndex === -1) return floorPlan;
  
  // Find the target room in the cloned floor plan
  const newTargetRoomIndex = newFloorPlan.rooms.findIndex((r: Room) => r.id === targetRoom.id);
  if (newTargetRoomIndex === -1) return floorPlan;
  
  // Create a portal from the wall
  const portal: Portal = {
    ...wall,
    id: uuidv4(), // New ID for the portal
    isPortal: true,
    connectedRoomId: targetRoom.id,
    connectedPortalId: null // Will be set if creating corresponding portal
  };
  
  // Create a new source room with the portal
  const newSourceRoom = {
    ...newFloorPlan.rooms[newSourceRoomIndex],
    walls: [...newFloorPlan.rooms[newSourceRoomIndex].walls]
  };
  
  // Replace the wall with the portal in the source room
  const wallIndex = newSourceRoom.walls.findIndex((w: Wall) => w.id === wall.id);
  if (wallIndex === -1) return floorPlan;
  
  newSourceRoom.walls[wallIndex] = portal;
  
  // Update portalIds
  newSourceRoom.portalIds = [...(newSourceRoom.portalIds || []), portal.id];
  
  // Also add to the legacy portals array for backwards compatibility
  if (!newSourceRoom.portals) {
    newSourceRoom.portals = [];
  }
  
  // Update the source room in the floor plan
  newFloorPlan.rooms[newSourceRoomIndex] = newSourceRoom;
  
  // Create corresponding portal in the target room if requested
  if (createCorrespondingPortal) {
    const newTargetRoom = {
      ...newFloorPlan.rooms[newTargetRoomIndex],
      walls: [...newFloorPlan.rooms[newTargetRoomIndex].walls],
      vertices: [...newFloorPlan.rooms[newTargetRoomIndex].vertices]
    };
    
    // Create vertices for the corresponding portal
    // We need to map the source vertices to target room coordinates
    const sourceVertices = wall.vertexIds.map(id => 
      sourceRoom.vertices.find(v => v.id === id)
    ).filter((v): v is Vertex => v !== undefined);
    
    if (sourceVertices.length < 2) return floorPlan;
    
    // Create corresponding vertices in the target room
    const targetVertices: Vertex[] = sourceVertices.map(v => ({
      id: uuidv4(),
      x: v.x, // You may need to transform these coordinates based on room positions
      y: v.y,
      isPortalVertex: true
    }));
    
    // Create the corresponding portal
    const correspondingPortal: Portal = {
      id: uuidv4(),
      vertexIds: targetVertices.map(v => v.id),
      isPortal: true,
      connectedRoomId: sourceRoom.id,
      connectedPortalId: portal.id
    };
    
    // Update the source portal with the target portal ID
    portal.connectedPortalId = correspondingPortal.id;
    newFloorPlan.rooms[newSourceRoomIndex].walls[wallIndex] = portal;
    
    // Add vertices to the target room
    newTargetRoom.vertices.push(...targetVertices);
    
    // Add portal to the target room
    newTargetRoom.walls.push(correspondingPortal);
    
    // Update portalIds
    newTargetRoom.portalIds = [...(newTargetRoom.portalIds || []), correspondingPortal.id];
    
    // Also add to the legacy portals array for backwards compatibility
    if (!newTargetRoom.portals) {
      newTargetRoom.portals = [];
    }
    
    // Update the target room in the floor plan
    newFloorPlan.rooms[newTargetRoomIndex] = newTargetRoom;
  }
  
  return newFloorPlan;
} 