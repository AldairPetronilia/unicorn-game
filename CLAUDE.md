# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MCP Server Configuration

This project uses the Serena MCP server for intelligent code navigation and analysis. Serena provides semantic code understanding tools that enable efficient exploration of the codebase without reading entire files. When working with this project, Claude Code should:

- Use Serena's symbolic tools (`find_symbol`, `get_symbols_overview`) for targeted code reading
- Leverage `search_for_pattern` for flexible pattern matching across the codebase
- Utilize memory files to store and retrieve project-specific knowledge
- Prioritize semantic edits over line-based edits when modifying code

## Project Overview

This is a Next.js 15 React game application featuring a "Labubu Rainbow Catch" browser-based game. The app uses TypeScript, React 19, and Tailwind CSS v4, built with Next.js App Router architecture.

## Development Commands

```bash
# Run development server with Turbopack
npm run dev

# Build production version
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

## Architecture

### Game Structure
The main game is implemented in `app/labubu-game/` as a client-side React component using HTML5 Canvas:

- **page.tsx**: Core game component with rendering loop and game logic
- **types.ts**: TypeScript interfaces for game entities (Unicorn, Labubu, Rainbow, Heart, GameState)
- **sounds.ts**: Web Audio API sound system for game effects and background music
- **game.css**: Game-specific styling

### Game Mechanics
- Canvas-based 2D rendering with custom drawing functions
- Entity collision detection system
- Difficulty scaling based on score
- Power-up system (rainbow multiplier, extra lives)
- Combo system for consecutive catches
- Three Labubu types: normal (+10 pts), golden (+50 pts), black (-1 life penalty)

### State Management
- Uses React hooks (useState, useRef, useEffect) for state management
- Game state stored in ref for animation frame access
- Score persistence via localStorage

## Key Technical Patterns

- **Animation Loop**: Uses requestAnimationFrame for smooth 60fps gameplay
- **Input Handling**: Supports both keyboard (arrow keys) and touch controls
- **Audio Context**: Manages sound effects through Web Audio API with mute functionality
- **Canvas Rendering**: Custom draw functions for each entity type with particle effects

## Working with This Codebase

When making changes to this project, follow these guidelines:

1. **Code Navigation**: Use Serena's semantic tools to understand code structure before making changes
2. **Testing**: Run `npm run lint` after making changes to ensure code quality
3. **Game Performance**: Maintain 60fps performance by optimizing canvas operations
4. **Type Safety**: Leverage TypeScript interfaces in `types.ts` for all game entities
5. **Sound Management**: Ensure all audio operations handle user interaction requirements for autoplay policies