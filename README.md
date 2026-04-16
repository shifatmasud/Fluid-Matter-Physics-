# MetaGlass | Displacement Demo

This project is a minimalist, interactive demonstration of using a dynamically generated SVG `feDisplacementMap` with the CSS `backdrop-filter: url()` property to create a liquid glass distortion effect.

The application is built using a "Meta Prototype" (#MP) interface, featuring draggable windows and a central dock for a sandbox-like user experience.

## Features

- **Dynamic Displacement Map**: The SVG map that creates the distortion is generated in real-time in the browser, adapting to the element's size and properties.
- **Real-time Controls**: A draggable "Control" window allows for live manipulation of the glass effect's parameters, such as bezel width, refraction intensity, background blur, and corner radius.
- **Debug Mode**: A debug toggle visualizes the underlying displacement map.
- **Meta Prototype UI**: A macOS-inspired interface with a draggable dock and floating windows built with Framer Motion.

## Directory Structure

```
.
├── assets/
│   └── (empty)
├── components/
│   ├── App/
│   │   └── MetaGlassApp.tsx
│   ├── Core/
│   │   ├── Controls.tsx
│   │   └── DraggableWindow.tsx
│   ├── Package/
│   │   └── GlassBubble.tsx
│   └── Section/
│       ├── Background.tsx
│       └── Dock.tsx
├── utils/
│   ├── generateDisplacementMap.ts
│   └── theme.ts
├── bugReport.md
├── importmap.js
├── index.html
├── index.tsx
├── noteBook.md
└── README.md
```
