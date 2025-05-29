# Impossidraw

Try it out at https://impossidraw.kranz.au

A design tool for creating portal-based impossible spaces. 

The tool ensures maximum room size is respected, and portal positions are correct, with corresponding portals always being in the same position relative to their enclosing room. 

Also allows you to export as a 3D model, by extruding the walls, with wall thickness and height configurable.

Built in [React](https://github.com/facebook/react) with [Konva](https://github.com/konvajs/konva) and [three.js](https://github.com/mrdoob/three.js)

## New Features

### Portal Corner Indicators
In the 3D Builder, portals now display bright yellow corner indicators at each corner of the portal opening. These small extruded blocks make portals instantly identifiable when importing the 3D model into Unity or other 3D editors, allowing for precise portal placement.

### Portal Schema Export
The 3D Builder now includes an "Export Portal Schema" button that generates a downloadable `.txt` file containing:
- XYZ coordinates of all portal corners (in millimeters)
- Portal connection information
- Room associations
- Unique portal IDs

This data can be used to programmatically position portals in Unity or other game engines with exact coordinate precision.

## Video Demo

[![Impossidraw Demo](https://img.youtube.com/vi/T-HjJbsD0Yc/0.jpg)](https://www.youtube.com/watch?v=T-HjJbsD0Yc)

https://www.youtube.com/watch?v=T-HjJbsD0Yc

## Screenshots

![Welcome Screen](/_docs/images/welcomeimpo.jpg)
**Figure: Welcome Screen**

![New Project Screen](/_docs/images/newprojimpo.jpg)
**Figure: New project screen**

![Canvas View](/_docs/images/canvasimpo.jpg)
**Figure: The Canvas**

![Room Placement](/_docs/images/placeroomimpo.png)
**Figure: Placing a Room**

![Placed Room](/_docs/images/roomplaceimpo.jpg)
**Figure: The placed room**

![Wall Creation](/_docs/images/create_wall_preview.png)
**Figure: Creating a wall**

![Vertex Movement](/_docs/images/moving_vertex.png)
**Figure: Moving the vertex of a wall**

![Portal Creation](/_docs/images/create_portal.png)
**Figure: Creating a portal**

![3D Builder](/_docs/images/3dbuilder.jpg)
**Figure: 3D Builder Screen**