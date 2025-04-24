import React, { useState } from 'react';
import { Rect, Group, Text, Line } from 'react-konva';
import Konva from 'konva';
import { Room as RoomType, Portal as PortalType } from '../../types/Room';

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
}) => {
  const shapeRef = React.useRef<Konva.Rect>(null);
  const trRef = React.useRef<Konva.Transformer>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  const { id, x, y, width, height, name, color, portals, gridX, gridY } = room;

  // Snap to grid (in mm)
  const snapToGridX = (value: number): number => {
    return Math.round(value / gridSizeWidth) * gridSizeWidth;
  };

  const snapToGridY = (value: number): number => {
    return Math.round(value / gridSizeHeight) * gridSizeHeight;
  };

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

  // Handle drag move to show visual feedback
  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Update drag position for visual feedback
    setDragPosition({
      x: e.target.x(),
      y: e.target.y()
    });
    
    // If shape is available, modify position during drag to visually snap to grid
    if (shapeRef.current) {
      const snapX = snapToGridX(e.target.x());
      const snapY = snapToGridY(e.target.y());
      
      // Apply a visual hint by moving the shape partially toward the snap point
      const visualX = e.target.x() + (snapX - e.target.x()) * 0.2;
      const visualY = e.target.y() + (snapY - e.target.y()) * 0.2;
      
      shapeRef.current.position({
        x: visualX,
        y: visualY
      });
    }
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
    
    const previewGridX = Math.round(dragPosition.x / gridSizeWidth);
    const previewGridY = Math.round(dragPosition.y / gridSizeHeight);
    const previewX = previewGridX * gridSizeWidth;
    const previewY = previewGridY * gridSizeHeight;
    
    return (
      <Rect
        x={previewX}
        y={previewY}
        width={gridSizeWidth}
        height={gridSizeHeight}
        stroke="#1890ff"
        strokeWidth={2}
        dash={[5, 5]}
        fill="rgba(24, 144, 255, 0.1)"
      />
    );
  };

  return (
    <Group>
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
        draggable
        strokeScaleEnabled={false}
        strokeEnabled={true}
        perfectDrawEnabled={true}
        lineJoin="miter"
        onDragStart={() => {
          setIsDragging(true);
          setDragPosition({ x, y });
          if (onDragStart) {
            onDragStart();
          }
        }}
        onDragMove={handleDragMove}
        onDragEnd={(e) => {
          setIsDragging(false);
          // Snap to grid cell
          const newX = snapToGridX(e.target.x());
          const newY = snapToGridY(e.target.y());
          onPositionChange(id, newX, newY);
          
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
        x={x + 5}
        y={y + 5}
        fontSize={14}
        fill="black"
      />
      
      {/* Room dimensions */}
      <Text
        text={getDisplayDimensions()}
        x={x + 5}
        y={y + 25}
        fontSize={12}
        fill="#555"
      />
      
      {/* Grid position */}
      <Text
        text={getGridPosition()}
        x={x + 5}
        y={y + 45}
        fontSize={12}
        fill="#777"
      />
      
      {/* Render portals as lines on the walls */}
      <Group x={x} y={y}>
        {renderPortals()}
      </Group>
    </Group>
  );
};

export default Room; 