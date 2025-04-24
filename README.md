# React Konva Canvas Demo

A simple drawing application built with React, TypeScript, and [react-konva](https://konvajs.org/docs/react/).

## Features

- Create and manipulate basic shapes (rectangles and circles)
- Select, move, and resize shapes
- Add new shapes with the toolbar
- Clear all shapes

## Project Structure

```
src/
├── components/
│   ├── Canvas.tsx          # Main canvas component using Konva
│   ├── Toolbar.tsx         # UI controls for adding shapes
│   └── shapes/
│       ├── Rectangle.tsx   # Reusable rectangle component
│       └── Circle.tsx      # Reusable circle component
├── App.tsx                 # Main application component
└── index.tsx               # Entry point
```

## Getting Started

1. Clone the repository
2. Install dependencies:
```
npm install
```
3. Start the development server:
```
npm start
```

## Next Steps

This is a simple example to get you started with Konva. Here are some ideas to extend it:

- Add more shape types (lines, stars, text, etc.)
- Implement color picker for shapes
- Add undo/redo functionality
- Save and load drawings
- Add layers support
- Implement free drawing with brush tools

## Resources

- [Konva.js Documentation](https://konvajs.org/docs/)
- [React Konva Examples](https://konvajs.org/docs/react/)
