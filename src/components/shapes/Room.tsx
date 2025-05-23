import React, { useState, useRef, useEffect } from 'react';
import { Rect, Group, Text, Line, Circle } from 'react-konva';
import Konva from 'konva';
import { Room as RoomType, Portal as PortalType, Wall as WallType, Vertex as VertexType } from '../../types/Room';
import { isPortal, getWallVertices } from '../../utils/drawingUtils';
import { getPortalColor } from '../../utils/portalUtils';

interface RoomProps {
  room: RoomType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPositionChange: (id: string, newX: number, newY: number) => void;
  onSizeChange: (id: string, newWidth: number, newHeight: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  gridSizeWidth: number;
  gridSizeHeight: number;
  disableDragging?: boolean;
  onWallSelect?: (roomId: string, wallId: string) => void;
  onVertexSelect?: (roomId: string, vertexId: string) => void;
  onVertexDrag?: (roomId: string, vertexId: string, x: number, y: number) => void;
  onWallDelete?: (roomId: string, wallId: string) => void;
  selectedWallId?: string | null;
  selectedVertexId?: string | null;
  isPortalPlacementActive?: boolean;
  scale?: number; // Add scale prop to receive zoom level
}

const Room: React.FC<RoomProps> = ({
  room,
  isSelected,
  onSelect,
  onPositionChange,
  onSizeChange,
  onDragStart,
  onDragEnd,
  gridSizeWidth,
  gridSizeHeight,
  disableDragging = false,
  onWallSelect,
  onVertexSelect,
  onVertexDrag,
  onWallDelete,
  selectedWallId,
  selectedVertexId,
  isPortalPlacementActive = false,
  scale = 1 // Default scale if not provided
}) => {
  const shapeRef = React.useRef<Konva.Rect>(null);
  const trRef = React.useRef<Konva.Transformer>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const dragStartPositionRef = useRef({ x: 0, y: 0 });

  const { id, x, y, width, height, name, color, portals, walls, vertices, gridX, gridY } = room;

  // State to track hovered vertex and wall
  const [hoveredVertexId, setHoveredVertexId] = useState<string | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const [dragPreviewLines, setDragPreviewLines] = useState<{
    vertexId: string;
    points: number[];
  }[]>([]);
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);

  // Calculate scaled sizes for visual elements based on zoom level
  const getScaledSize = (baseSize: number): number => {
    // Scale inversely with zoom level with a reasonable minimum
    return Math.max(baseSize / scale, baseSize * 0.25);
  };

  // Wall thickness that scales with zoom
  const getWallThickness = (isSelected: boolean, isHovered: boolean): number => {
    const baseThickness = isSelected ? 6 : (isHovered ? 5 : 4);
    return getScaledSize(baseThickness);
  };

  // Vertex radius that scales with zoom
  const getVertexRadius = (isSelected: boolean, isHovered: boolean): number => {
    const baseRadius = isSelected ? 10 : (isHovered ? 8 : 6);
    return getScaledSize(baseRadius);
  };

  // Hit areas that scale with zoom for easier interaction
  const getHitArea = (baseSize: number): number => {
    return getScaledSize(baseSize * 2); // Make hit areas even larger than visible elements
  };

  // Snap to grid (in mm)
  const snapToGridX = (value: number): number => {
    return Math.round(value / gridSizeWidth) * gridSizeWidth;
  };

  const snapToGridY = (value: number): number => {
    return Math.round(value / gridSizeHeight) * gridSizeHeight;
  };

  // Effect to update position when component props change
  useEffect(() => {
    if (shapeRef.current) {
      // Ensure the shape is exactly at the grid position specified
      shapeRef.current.position({
        x: x,
        y: y
      });
    }
  }, [x, y]);

  React.useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      // attach transformer to the selected shape
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Get room dimensions in meters for display
  const getDisplayDimensions = () => {
    const widthM = (width / 1000).toFixed(2);
    const heightM = (height / 1000).toFixed(2);
    return `${widthM}m × ${heightM}m`;
  };

  // Get grid cell coordinates for display
  const getGridPosition = () => {
    return `Cell: ${gridX},${gridY}`;
  };

  // Handle drag move with improved behavior
  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Get raw position from cursor
    const rawX = e.target.x();
    const rawY = e.target.y();
    
    // Calculate the snapped grid position for preview only
    const snappedGridX = Math.round(rawX / gridSizeWidth);
    const snappedGridY = Math.round(rawY / gridSizeHeight);
    const snappedX = snappedGridX * gridSizeWidth;
    const snappedY = snappedGridY * gridSizeHeight;
    
    // Update the preview position to show the snapped destination
    setDragPosition({
      x: snappedX,
      y: snappedY
    });
    
    // Let the object follow the cursor naturally - no snapping during drag
    // The shape's position is already being updated by Konva drag behavior
  };

  // Function to render all walls and portals
  const renderWalls = () => {
    // First render regular walls
    const regularWalls = walls.filter(wall => !isPortal(wall));
    const portals = walls.filter(wall => isPortal(wall)) as PortalType[];
    
    return (
      <>
        {/* Regular walls */}
        {regularWalls.map((wall: WallType) => {
          // Find vertices for this wall
          const wallVertices = getWallVertices(wall, room);
          
          if (wallVertices.length < 2) return null;
          
          // Create points array for the line
          const points: number[] = [];
          wallVertices.forEach(vertex => {
            points.push(vertex.x, vertex.y);
          });
          
          const isWallSelected = wall.id === selectedWallId;
          const isWallHovered = wall.id === hoveredWallId;
          
          return (
            <React.Fragment key={wall.id}>
              <Line
                points={points}
                stroke={isWallSelected ? "#1890ff" : (isWallHovered ? "#69c0ff" : "black")}
                strokeWidth={getWallThickness(isWallSelected, isWallHovered)}
                lineCap="round"
                lineJoin="round"
                onClick={() => onWallSelect && onWallSelect(id, wall.id)}
                onTap={() => onWallSelect && onWallSelect(id, wall.id)}
                onDblClick={(e) => {
                  // Handle double click to delete wall
                  if (e.evt.ctrlKey || e.evt.metaKey) {
                    onWallDelete && onWallDelete(id, wall.id);
                  }
                }}
                hitStrokeWidth={getHitArea(10)} // Wider hit area for easier selection
                onMouseEnter={() => {
                  document.body.style.cursor = 'pointer';
                  setHoveredWallId(wall.id);
                }}
                onMouseLeave={() => {
                  document.body.style.cursor = 'default';
                  setHoveredWallId(null);
                }}
              />
              
              {/* Render vertices for selected walls */}
              {renderWallVertices(wall, wallVertices)}
            </React.Fragment>
          );
        })}
        
        {/* Portals */}
        {portals.map((portal: PortalType) => {
          // Find vertices for this portal
          const portalVertices = getWallVertices(portal, room);
          
          if (portalVertices.length < 2) return null;
          
          // Create points array for the line
          const points: number[] = [];
          portalVertices.forEach(vertex => {
            points.push(vertex.x, vertex.y);
          });
          
          const isPortalSelected = portal.id === selectedWallId;
          const isPortalHovered = portal.id === hoveredWallId;
          
          // Get a consistent color for this portal
          const portalColor = getPortalColor(portal);
          
          return (
            <React.Fragment key={portal.id}>
              <Line
                points={points}
                stroke={portalColor}
                strokeWidth={getWallThickness(isPortalSelected, isPortalHovered)}
                lineCap="round"
                lineJoin="round"
                onClick={() => onWallSelect && onWallSelect(id, portal.id)}
                onTap={() => onWallSelect && onWallSelect(id, portal.id)}
                hitStrokeWidth={getHitArea(12)} // Wider hit area for easier selection
                onMouseEnter={() => {
                  document.body.style.cursor = 'pointer';
                  setHoveredWallId(portal.id);
                }}
                onMouseLeave={() => {
                  document.body.style.cursor = 'default';
                  setHoveredWallId(null);
                }}
              />
              
              {/* Render vertices for selected portals */}
              {renderWallVertices(portal, portalVertices)}
            </React.Fragment>
          );
        })}
      </>
    );
  };
  
  // Function to render the vertices for a wall or portal
  const renderWallVertices = (wall: WallType, vertices: VertexType[]) => {
    const isWallSelected = wall.id === selectedWallId;
    
    // Only render vertices if this wall is selected or one of its vertices is selected
    if (!isWallSelected && !vertices.some(v => v.id === selectedVertexId)) {
      return null;
    }
    
    return vertices.map(vertex => {
      const isVertexSelected = vertex.id === selectedVertexId;
      const isVertexHovered = vertex.id === hoveredVertexId;
      
      return (
        <Circle
          key={vertex.id}
          x={vertex.x}
          y={vertex.y}
          radius={getVertexRadius(isVertexSelected, isVertexHovered)}
          fill={isVertexSelected ? "#1890ff" : (isVertexHovered ? "#69c0ff" : (isWallSelected ? "#d9f0ff" : "#f0f0f0"))}
          stroke={isVertexSelected ? "#0050b3" : (isVertexHovered ? "#1890ff" : (isWallSelected ? "#69c0ff" : "#d9d9d9"))}
          strokeWidth={isVertexSelected || isVertexHovered ? getScaledSize(2) : getScaledSize(1)}
          opacity={isVertexSelected || isVertexHovered ? 1 : 0.8}
          // Add a larger hitbox area
          hitStrokeWidth={getScaledSize(6)}
          // Set invisible hit area that's larger than the visible vertex
          hitRadius={getHitArea(8)}
          draggable={!disableDragging}
          onClick={(e) => {
            e.cancelBubble = true; // Prevent event from bubbling to the room
            onVertexSelect && onVertexSelect(id, vertex.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onVertexSelect && onVertexSelect(id, vertex.id);
          }}
          onDragStart={() => {
            setIsDraggingVertex(true);
          }}
          onDragMove={(e) => {
            // Confine vertex drag within room bounds
            const newX = Math.max(0, Math.min(width, e.target.x()));
            const newY = Math.max(0, Math.min(height, e.target.y()));
            e.target.position({ x: newX, y: newY });
            
            // Update preview lines for all walls that use this vertex
            renderVertexDragPreview(vertex.id, newX, newY);
          }}
          onDragEnd={(e) => {
            const newX = Math.max(0, Math.min(width, e.target.x()));
            const newY = Math.max(0, Math.min(height, e.target.y()));
            onVertexDrag && onVertexDrag(id, vertex.id, newX, newY);
            
            // Clear drag previews once drag is complete
            setIsDraggingVertex(false);
          }}
          onMouseEnter={() => {
            document.body.style.cursor = 'pointer';
            setHoveredVertexId(vertex.id);
          }}
          onMouseLeave={() => {
            document.body.style.cursor = 'default';
            setHoveredVertexId(null);
          }}
        />
      );
    });
  };
  
  // Function to render preview when dragging a vertex
  const renderVertexDragPreview = (vertexId: string, newX: number, newY: number) => {
    // Find all walls that use this vertex
    const connectedWalls = walls.filter(wall => wall.vertexIds.includes(vertexId));
    
    const newPreviewLines = connectedWalls.map(wall => {
      // Get all vertices for this wall
      const wallVertices = wall.vertexIds
        .map(vid => {
          // If this is the vertex being dragged, use the new position
          if (vid === vertexId) {
            return { id: vid, x: newX, y: newY };
          }
          // Otherwise use the original vertex
          return vertices.find(v => v.id === vid);
        })
        .filter(v => v) as VertexType[];
      
      // Create points array for preview line
      const points: number[] = [];
      wallVertices.forEach(v => {
        points.push(v.x, v.y);
      });
      
      return {
        vertexId,
        points
      };
    });
    
    setDragPreviewLines(newPreviewLines);
  };
  
  // Clear preview lines when not dragging
  useEffect(() => {
    if (!isDraggingVertex) {
      setDragPreviewLines([]);
    }
  }, [isDraggingVertex]);

  // Render grid cell preview during drag
  const renderGridPreview = () => {
    if (!isDragging) return null;
    
    // Use the calculated dragging position for the preview
    const previewX = dragPosition.x;
    const previewY = dragPosition.y;
    
    // Check if the dragged room is at the same position as the preview
    const currentPosX = shapeRef.current?.x() || x;
    const currentPosY = shapeRef.current?.y() || y;
    const snappedCurrentX = snapToGridX(currentPosX);
    const snappedCurrentY = snapToGridY(currentPosY);
    
    // Determine if the preview is at a different position than current 
    const isPreviewDifferent = previewX !== snappedCurrentX || previewY !== snappedCurrentY;
    
    // Render a more prominent preview when it's at a different position
    return (
      <Group>
        {/* Semi-transparent destination outline */}
        <Rect
          x={previewX}
          y={previewY}
          width={gridSizeWidth}
          height={gridSizeHeight}
          stroke={isPreviewDifferent ? '#1890ff' : 'rgba(24, 144, 255, 0.5)'}
          strokeWidth={2}
          dash={[5, 5]}
          fill={isPreviewDifferent ? 'rgba(24, 144, 255, 0.2)' : 'rgba(24, 144, 255, 0.1)'}
        />
        
        {/* Grid coordinates label */}
        {isPreviewDifferent && (
          <Text
            text={`Cell: ${Math.round(previewX / gridSizeWidth)},${Math.round(previewY / gridSizeHeight)}`}
            x={previewX + 5}
            y={previewY + gridSizeHeight - 20}
            fontSize={12}
            fill="#1890ff"
          />
        )}
      </Group>
    );
  };

  return (
    <Group
      onMouseEnter={e => {
        document.body.style.cursor = disableDragging ? 'default' : 'pointer';
      }}
      onMouseLeave={e => {
        document.body.style.cursor = 'default';
      }}
    >
      {renderGridPreview()}
      <Rect
        id={id}
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke={isSelected ? '#1890ff' : '#333'}
        strokeWidth={isSelected ? 3 : 1}
        shadowColor={isSelected ? '#1890ff' : undefined}
        shadowBlur={isSelected ? 6 : 0}
        shadowOpacity={isSelected ? 0.3 : 0}
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
        ref={shapeRef}
        draggable={!disableDragging}
        strokeScaleEnabled={false}
        strokeEnabled={true}
        perfectDrawEnabled={true}
        lineJoin="miter"
        onDragStart={(e) => {
          setIsDragging(true);
          
          // Store initial position for reference
          dragStartPositionRef.current = { 
            x: e.target.x(), 
            y: e.target.y() 
          };
          
          // Initialize the drag position at the current position
          setDragPosition({ 
            x: snapToGridX(e.target.x()), 
            y: snapToGridY(e.target.y()) 
          });
          
          if (onDragStart) {
            onDragStart();
          }
        }}
        onDragMove={handleDragMove}
        onDragEnd={(e) => {
          setIsDragging(false);
          
          // Always snap to grid on end
          const snappedX = snapToGridX(e.target.x());
          const snappedY = snapToGridY(e.target.y());
          
          // Make sure position is exactly on grid
          if (shapeRef.current) {
            shapeRef.current.position({
              x: snappedX,
              y: snappedY
            });
          }
          
          // Only notify of position change if actually moved
          if (snappedX !== x || snappedY !== y) {
            onPositionChange(id, snappedX, snappedY);
          }
          
          // Call the optional onDragEnd callback
          if (onDragEnd) {
            onDragEnd();
          }
        }}
        onTransformEnd={(e) => {
          // transformer changes scale, so we need to adjust width and height
          if (shapeRef.current) {
            const node = shapeRef.current;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            
            // reset scale to 1
            node.scaleX(1);
            node.scaleY(1);
            
            // Limit size to grid cell size
            const newWidth = Math.min(node.width() * scaleX, gridSizeWidth);
            const newHeight = Math.min(node.height() * scaleY, gridSizeHeight);
            
            node.width(newWidth);
            node.height(newHeight);
            
            onSizeChange(id, newWidth, newHeight);
          }
        }}
      />
      
      {/* Room name
      <Text
        text={name}
        x={x + width * 0.02}
        y={y + height * 0.02}
        fontSize={Math.min(width, height) * 0.1}
        fill="black"
      /> */}
      
      {/* Room dimensions
      <Text
        text={getDisplayDimensions()}
        x={x + width * 0.02}
        y={y + height * 0.02 + Math.min(width, height) * 0.1 + 5}
        fontSize={Math.min(width, height) * 0.05}
        fill="#555"
      /> */}
      
      {/* Grid position
      <Text
        text={getGridPosition()}
        x={x + width * 0.02}
        y={y + height * 0.02 + Math.min(width, height) * 0.15 + 10}
        fontSize={Math.min(width, height) * 0.05}
        fill="#777"
      /> */}
      
      {/* Render walls */}
      <Group x={x} y={y}>
        {renderWalls()}
        
        {/* Render preview lines during vertex drag */}
        {dragPreviewLines.map((line, index) => (
          <Line
            key={`preview-${line.vertexId}-${index}`}
            points={line.points}
            stroke="#1890ff"
            strokeWidth={getScaledSize(4)}
            dash={[5, 5]}
            opacity={0.6}
            lineCap="round"
            lineJoin="round"
          />
        ))}
      </Group>
    </Group>
  );
};

export default Room; 