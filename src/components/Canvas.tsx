import React, { useState, useEffect } from 'react';
import { Stage, Layer, Text } from 'react-konva';
import Rectangle from './shapes/Rectangle';
import Circle from './shapes/Circle';

interface RectShape {
  id: string;
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

interface CircleShape {
  id: string;
  type: 'circle';
  x: number;
  y: number;
  radius: number;
  fill: string;
}

type Shape = RectShape | CircleShape;

interface CanvasProps {
  width: number;
  height: number;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  addToHistory: (shapes: Shape[]) => void;
}

const Canvas: React.FC<CanvasProps> = ({ width, height, shapes, setShapes, addToHistory }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
        const updatedShapes = shapes.filter(shape => shape.id !== selectedId);
        setShapes(updatedShapes);
        addToHistory(updatedShapes);
        setSelectedId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId, shapes, setShapes, addToHistory]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleDeselect = (e: any) => {
    // Deselect when clicking on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
    }
  };

  const updateShapePosition = (id: string, newX: number, newY: number) => {
    const updatedShapes = shapes.map((shape) => {
      if (shape.id === id) {
        return {
          ...shape,
          x: newX,
          y: newY,
        };
      }
      return shape;
    });
    
    setShapes(updatedShapes);
    addToHistory(updatedShapes);
  };

  const updateRectangleSize = (id: string, newWidth: number, newHeight: number) => {
    const updatedShapes = shapes.map((shape) => {
      if (shape.id === id && shape.type === 'rectangle') {
        return {
          ...shape,
          width: newWidth,
          height: newHeight,
        };
      }
      return shape;
    });
    
    setShapes(updatedShapes);
    addToHistory(updatedShapes);
  };

  const updateCircleRadius = (id: string, newRadius: number) => {
    const updatedShapes = shapes.map((shape) => {
      if (shape.id === id && shape.type === 'circle') {
        return {
          ...shape,
          radius: newRadius,
        };
      }
      return shape;
    });
    
    setShapes(updatedShapes);
    addToHistory(updatedShapes);
  };

  return (
    <Stage 
      width={width} 
      height={height}
      onClick={handleDeselect}
    >
      <Layer>
        {/* Instructions */}
        {selectedId && (
          <Text 
            text="Press Delete to remove shape" 
            x={10} 
            y={10} 
            fontSize={14}
            fill="#555"
            padding={5}
            background="#f0f0f0"
          />
        )}
        
        {shapes.map((shape) => {
          if (shape.type === 'rectangle') {
            return (
              <Rectangle
                key={shape.id}
                id={shape.id}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                fill={shape.fill}
                isSelected={shape.id === selectedId}
                onSelect={handleSelect}
                onPositionChange={(newX, newY) => updateShapePosition(shape.id, newX, newY)}
                onSizeChange={(newWidth, newHeight) => updateRectangleSize(shape.id, newWidth, newHeight)}
              />
            );
          } else if (shape.type === 'circle') {
            return (
              <Circle
                key={shape.id}
                id={shape.id}
                x={shape.x}
                y={shape.y}
                radius={shape.radius}
                fill={shape.fill}
                isSelected={shape.id === selectedId}
                onSelect={handleSelect}
                onPositionChange={(newX, newY) => updateShapePosition(shape.id, newX, newY)}
                onRadiusChange={(newRadius) => updateCircleRadius(shape.id, newRadius)}
              />
            );
          }
          return null;
        })}
      </Layer>
    </Stage>
  );
};

export default Canvas; 