import React, { useState, useRef, useEffect } from 'react';
import { Rect, Group, Text, Line } from 'react-konva';
import Konva from 'konva';
import { Room as RoomType, Portal as PortalType, Wall as WallType } from '../../types/Room';

interface RoomProps {
  room: RoomType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPositionChange: (id: string, newX: number, newY: number) => void;
  onSizeChange: (id: string, newWidth: number, newHeight: number) => void;
  onPortalAdd?: (roomId: string, wallPosition: 'top' | 'right' | 'bottom' | 'left', position: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  gridSizeWidth: number;
  gridSizeHeight: number;
  disableDragging?: boolean;
}

const Room: React.FC<RoomProps> = ({
  room,
  isSelected,
  onSelect,
  onPositionChange,
  onSizeChange,
  onPortalAdd,
  onDragStart,
  onDragEnd,
  gridSizeWidth,
  gridSizeHeight,
  disableDragging = false,
}) => {
  const shapeRef = React.useRef<Konva.Rect>(null);
  const trRef = React.useRef<Konva.Transformer>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const dragStartPositionRef = useRef({ x: 0, y: 0 });

  const { id, x, y, width, height, name, color, portals, walls, gridX, gridY } = room;

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

  // Function to render portals
  const renderPortals = () => {
    return portals.map((portal: PortalType) => {
      // Calculate portal coordinates based on wall position and normalized position
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
      const portalWidth = portal.width * (portal.wallPosition === 'top' || portal.wallPosition === 'bottom' ? width : height);
      const offset = portal.position * (portal.wallPosition === 'top' || portal.wallPosition === 'bottom' ? width : height);
      
      switch (portal.wallPosition) {
        case 'top':
          x1 = offset;
          y1 = 0;
          x2 = offset + portalWidth;
          y2 = 0;
          break;
        case 'right':
          x1 = width;
          y1 = offset;
          x2 = width;
          y2 = offset + portalWidth;
          break;
        case 'bottom':
          x1 = offset;
          y1 = height;
          x2 = offset + portalWidth;
          y2 = height;
          break;
        case 'left':
          x1 = 0;
          y1 = offset;
          x2 = 0;
          y2 = offset + portalWidth;
          break;
      }

      return (
        <Line
          key={portal.id}
          points={[x1, y1, x2, y2]}
          stroke={portal.connectedRoomId ? 'green' : 'red'}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />
      );
    });
  };

  // Function to render walls
  const renderWalls = () => {
    return walls.map((wall: WallType) => {
      return (
        <Line
          key={wall.id}
          points={[wall.startX, wall.startY, wall.endX, wall.endY]}
          stroke="black"
          strokeWidth={2}
          lineCap="round"
        />
      );
    });
  };

  // Double click handler for adding new portals
  const handleDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!onPortalAdd) return;
    
    const rect = shapeRef.current;
    if (!rect) return;

    // Get the position relative to the room
    const stage = rect.getStage();
    if (!stage) return;

    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    
    // Convert global position to local position
    const localPos = {
      x: pointerPosition.x - rect.x(),
      y: pointerPosition.y - rect.y()
    };

    // Determine which wall was clicked
    const tolerance = 10; // pixels
    let wallPosition: 'top' | 'right' | 'bottom' | 'left' | null = null;
    let position = 0;

    if (localPos.y < tolerance) {
      wallPosition = 'top';
      position = Math.max(0, Math.min(1, localPos.x / width));
    } else if (localPos.x > width - tolerance) {
      wallPosition = 'right';
      position = Math.max(0, Math.min(1, localPos.y / height));
    } else if (localPos.y > height - tolerance) {
      wallPosition = 'bottom';
      position = Math.max(0, Math.min(1, localPos.x / width));
    } else if (localPos.x < tolerance) {
      wallPosition = 'left';
      position = Math.max(0, Math.min(1, localPos.y / height));
    }

    if (wallPosition) {
      onPortalAdd(id, wallPosition, position);
    }
  };

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
        onDblClick={handleDoubleClick}
        onDblTap={handleDoubleClick}
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
      
      {/* Room name */}
      <Text
        text={name}
        x={x + width * 0.02}
        y={y + height * 0.02}
        fontSize={Math.min(width, height) * 0.1}
        fill="black"
      />
      
      {/* Room dimensions */}
      <Text
        text={getDisplayDimensions()}
        x={x + width * 0.02}
        y={y + height * 0.02 + Math.min(width, height) * 0.1 + 5}
        fontSize={Math.min(width, height) * 0.05}
        fill="#555"
      />
      
      {/* Grid position */}
      <Text
        text={getGridPosition()}
        x={x + width * 0.02}
        y={y + height * 0.02 + Math.min(width, height) * 0.15 + 10}
        fontSize={Math.min(width, height) * 0.05}
        fill="#777"
      />
      
      {/* Render portals as lines on the walls */}
      <Group x={x} y={y}>
        {renderPortals()}
        {renderWalls()}
      </Group>
    </Group>
  );
};

export default Room; 