import React from 'react';
import { Circle as KonvaCircle, Transformer } from 'react-konva';
import Konva from 'konva';

interface CircleProps {
  id: string;
  x: number;
  y: number;
  radius: number;
  fill: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPositionChange: (newX: number, newY: number) => void;
  onRadiusChange: (newRadius: number) => void;
}

const Circle: React.FC<CircleProps> = ({
  id,
  x,
  y,
  radius,
  fill,
  isSelected,
  onSelect,
  onPositionChange,
  onRadiusChange,
}) => {
  const shapeRef = React.useRef<Konva.Circle>(null);
  const trRef = React.useRef<Konva.Transformer>(null);

  React.useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      // attach transformer to the selected shape
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaCircle
        id={id}
        x={x}
        y={y}
        radius={radius}
        fill={fill}
        onClick={() => onSelect(id)}
        ref={shapeRef}
        draggable
        onDragEnd={(e) => {
          onPositionChange(e.target.x(), e.target.y());
        }}
        onTransformEnd={(e) => {
          // transformer changes scale, not radius
          // so we need to adjust radius based on scale
          if (shapeRef.current) {
            const node = shapeRef.current;
            const scaleX = node.scaleX();
            
            // reset scale to 1 - radius will be updated
            node.scaleX(1);
            node.scaleY(1);
            
            onRadiusChange(Math.max(5, node.radius() * scaleX));
          }
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            // limit resize
            if (newBox.width < 10 || newBox.height < 10) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default Circle; 