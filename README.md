# Installation instructions

This is a [Next.js](https://nextjs.org). It can be deployed on Vercel, run locally... or probably run elsewhere without too much trouble.

To run this you'll need a [Google Gemini API key](https://aistudio.google.com/app/apikey) (you should be able to get one for free, and run this game using a free-tier API key). ([Why Gemini?](#why-gemini)) Put the key in `.env.local` as `GEMINI_KEY="..."`

The tech stack:

- Next.js
  - React
  - TypeScript
- Tailwind for styling
- [Preact Signals](https://preactjs.com/guide/v10/signals/) for state management
- Actual game state is stored in [browser localStorage](./blob/main/lib/persistentsignal.ts)
- [One wee little server endpoint](./blob/main/app/api/llm/route.ts)
- The Gemini LLM

## Getting Started

Sign up for a [Gemini API Key](https://aistudio.google.com/app/apikey) and put it in `.env.local`:

```
GEMINI_KEY="your key"
```

Run `npm install` to install and `npm run dev` to run locally.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

# Code

There are only a few important parts of the code!

- [types.ts]() defines (almost) all the types used throughout the game
- [model.ts]() actually runs the game and manages game state
- [application.tsx]() is the entire UI
- [games/]() contains the game setup, [entities.ts]() for all the autonomous entities (people and AI), and [rooms.ts]() for all the locations.

There's a little more UI in [components/]() and some libraries in [lib/](), but they are mostly generic and secondary. Besides application.tsx [app/]() is mostly boilerplate or glue.
