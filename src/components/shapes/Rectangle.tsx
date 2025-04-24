import React from 'react';
import { Rect, Transformer } from 'react-konva';
import Konva from 'konva';

interface RectangleProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPositionChange: (newX: number, newY: number) => void;
  onSizeChange: (newWidth: number, newHeight: number) => void;
}

const Rectangle: React.FC<RectangleProps> = ({
  id,
  x,
  y,
  width,
  height,
  fill,
  isSelected,
  onSelect,
  onPositionChange,
  onSizeChange,
}) => {
  const shapeRef = React.useRef<Konva.Rect>(null);
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
      <Rect
        id={id}
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        onClick={() => onSelect(id)}
        ref={shapeRef}
        draggable
        onDragEnd={(e) => {
          onPositionChange(e.target.x(), e.target.y());
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
            
            onSizeChange(
              Math.max(5, node.width() * scaleX),
              Math.max(5, node.height() * scaleY)
            );
          }
        }}
      />
      {isSelected && <Transformer ref={trRef} />}
    </>
  );
};

export default Rectangle; 