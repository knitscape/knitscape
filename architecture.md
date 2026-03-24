# Architecture

- Using Vite for development of client-side apps
- My preference is for a small set of dependencies to minimize abstraction
  layers between my work and the browser, but there are cases where some
  libraries are very helpful.
- DOM is built via HTML templating with tagged template literals using the
  `lit-html` library. I don't want to use web components or a full component
  framework like React or LitElement
- Use Redux for state management

## Styling and Interfaces

- Styling is done with Tailwind, bias towards just using their core utility
  classes over custom component classes and utility classes. Use inline css
  styles when data is coming from a dynamic source (often the case when we're
  computing the size or position of things)
- For visual style, I want compact, information dense interfaces. We are
  building design tools and visual programming interfaces so our interfaces will
  laid out more like traditional CAD tools (onshape, solidworks, Rhino3d,
  blender) or design tools (photoshop, inkscape, illustrator, premier, etc) and
  contain lots of editing tools, toolbars, context bars, controls, etc; much
  more than simple information-sparse interfaces used for blogs or text-dominant
  interfaces.
