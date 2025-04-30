import { Room, Wall, Portal, Vertex } from '../types/Room';

/**
 * Determines if a wall is actually a portal
 */
export function isPortal(wall: Wall): boolean {
  return 'isPortal' in wall && (wall as Portal).isPortal === true;
}

/**
 * Gets the vertices for a wall or portal
 */
export function getWallVertices(wall: Wall, room: Room): Vertex[] {
  return wall.vertexIds.map(id => 
    room.vertices.find(v => v.id === id)
  ).filter((v): v is Vertex => v !== undefined);
}

/**
 * Draws a wall or portal on the canvas
 */
export function drawWall(
  ctx: CanvasRenderingContext2D, 
  wall: Wall, 
  room: Room, 
  scale: number = 1
): void {
  const vertices = getWallVertices(wall, room);
  if (vertices.length < 2) return;
  
  ctx.beginPath();
  
  // Start from the first vertex
  ctx.moveTo(vertices[0].x * scale, vertices[0].y * scale);
  
  // Draw lines to each subsequent vertex
  for (let i = 1; i < vertices.length; i++) {
    ctx.lineTo(vertices[i].x * scale, vertices[i].y * scale);
  }
  
  // Different styling for portals vs regular walls
  if (isPortal(wall)) {
    // Portal styling
    const portal = wall as Portal;
    ctx.strokeStyle = portal.connectedRoomId ? '#4CAF50' : '#FFC107';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 3]);
  } else {
    // Regular wall styling
    ctx.strokeStyle = wall.isSelected ? '#2196F3' : '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
  }
  
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Draws all walls and portals for a room
 */
export function drawRoom(
  ctx: CanvasRenderingContext2D, 
  room: Room, 
  scale: number = 1,
  highlightPortals: boolean = true
): void {
  // Draw room outline
  ctx.strokeStyle = room.color;
  ctx.lineWidth = 1;
  ctx.strokeRect(
    room.x * scale, 
    room.y * scale, 
    room.width * scale, 
    room.height * scale
  );
  
  // Draw walls (non-portals first)
  room.walls
    .filter(wall => !isPortal(wall))
    .forEach(wall => drawWall(ctx, wall, room, scale));
  
  // Draw portals on top
  if (highlightPortals) {
    room.walls
      .filter(wall => isPortal(wall))
      .forEach(wall => drawWall(ctx, wall, room, scale));
  }
}

/**
 * Finds the closest wall or vertex to a point
 */
export function findClosestWallOrVertex(
  x: number, 
  y: number, 
  room: Room, 
  maxDistance: number = 10
): { type: 'wall' | 'vertex', id: string, distance: number } | null {
  let closest: { type: 'wall' | 'vertex', id: string, distance: number } | null = null;
  let minDistance = maxDistance;
  
  // Check vertices first
  for (const vertex of room.vertices) {
    const distance = Math.sqrt(
      Math.pow(vertex.x - x, 2) + Math.pow(vertex.y - y, 2)
    );
    
    if (distance < minDistance) {
      closest = { type: 'vertex' as const, id: vertex.id, distance };
      minDistance = distance;
    }
  }
  
  // Check walls
  for (const wall of room.walls) {
    const vertices = getWallVertices(wall, room);
    if (vertices.length < 2) continue;
    
    // Check distance to each wall segment
    for (let i = 1; i < vertices.length; i++) {
      const v1 = vertices[i-1];
      const v2 = vertices[i];
      
      const distance = distanceToLineSegment(
        x, y, 
        v1.x, v1.y, 
        v2.x, v2.y
      );
      
      if (distance < minDistance) {
        closest = { type: 'wall' as const, id: wall.id, distance };
        minDistance = distance;
      }
    }
  }
  
  return closest;
}

/**
 * Calculate distance from point to line segment
 */
function distanceToLineSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  
  if (len_sq !== 0) param = dot / len_sq;
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
} 