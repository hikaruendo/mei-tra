# Mei-Tra Mobile

React Native mobile app for the Mei-Tra card game.

## Setup

1. Install dependencies:
```bash
cd mei-tra-mobile
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your backend URL
```

3. Start the development server:
```bash
npm start
```

## Development

- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS device/simulator  
- `npm run web` - Run in web browser

## Architecture

- **App.tsx** - Main navigation setup
- **app/** - Screen components (LobbyScreen, GameScreen)
- **components/** - Reusable UI components (Card, PlayerHand, GameField)
- **services/** - Business logic and API services (useSocketService)
- **types/** - TypeScript type definitions (shared with backend via @shared)

## Features

- Real-time multiplayer gameplay via Socket.IO
- Touch-optimized card interface with haptic feedback
- Responsive design for mobile devices
- Connection status indicators
- Game state synchronization