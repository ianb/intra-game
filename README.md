# About

This is a game written from September 27-29, 2024, for the [Text Adventure Hack](https://textadventurehack.com/).

The main branch is deployed on [intra-game.vercel.app](https://intra-game.vercel.app/)

# Installation instructions

This is a [Next.js](https://nextjs.org) application. It can be deployed on Vercel, run locally... or probably run elsewhere without too much trouble.

To run this you'll need to connect to [OpenRouter.ai](https://openrouter.ai/) to access various LLM models. You can use free models or connect your own API keys for paid models. The game will work with free models, though paid models generally provide better performance.

The tech stack:

- Next.js
  - React
  - TypeScript
- Tailwind for styling
- [Preact Signals](https://preactjs.com/guide/v10/signals/) for state management
- Actual game state is stored in [browser localStorage](./lib/persistentsignal.ts)
- [OpenRouter.ai](https://openrouter.ai/) for LLM access
- Various LLM models (GPT-4, Claude, Gemini, etc.)

## Getting Started

1. Run `npm install` to install dependencies
2. Run `npm run dev` to start the development server
3. Open [http://localhost:3000](http://localhost:3000) with your browser
4. In the game, go to Settings (⚙) and connect to OpenRouter.ai to access LLM models

The game will work with free models, but you can also connect your own API keys through OpenRouter for access to premium models.

# Code

There are only a few important parts of the code! Note that many contain spoilers.

- [types.ts](./lib/types.ts) defines (almost) all the types used throughout the game, outside of classes
- [model.ts](./lib/game/model.ts) manages game state in the browser and the user/game interaction
- [world.ts](./lib/game/world.ts) represents a moment in the world, and is a getter for most objects
- [classes.ts](./lib/game/classes.ts) has the class for Entity and its children (e.g., Room, Person, Player). These manage most of the actual game play!
- [gameobjs.ts](./lib/game/gameobjs.ts) is the instantiation of all the actual game state, individual people and rooms, etc. (though all logic is in classes.ts)
- [application.tsx](./app/application.tsx) is the entire UI
- [dossier.md](./docs/dossier.md) is the game background. I wasn't able to use much of this given the constrained implementation time, but I hope to eventually!

There's a little more UI in [components/](./components/) and some libraries in [lib/](./lib/), but they are mostly generic and secondary. Besides application.tsx [app/](./app/) is mostly boilerplate or glue.

# FAQ

## What are you trying to accomplish with this?

This began as a submission to the [RetroAI Quest](https://textadventurehack.com/) Hackathon, which asked for an AI-powered retro-feeling text game. I had already been thinking a lot about this subject, so my appreciation to the hackathon runners for inspiring me to actually do it!

There's lots of LLM-based games that let the LLM hallucinate the entire story. But these have a dreamlike quality to them... things come into existance only as they are imagined. They are ungrounded. A normal text adventure has a very strict structure, with a set of formal commands to navigate that structure.

In this game I'm trying to have a bit of both. There's an underlying game model and a grounding to the story, but with opportunities for the user and LLM to navigate that together in imaginative ways.

## Why OpenRouter?

OpenRouter provides access to a wide variety of LLM models through a single API, including free options. This makes it easy to experiment with different models and find what works best for the game experience.

The free tier models are quite capable for this type of game, and OpenRouter's unified interface makes it simple to switch between different providers.

## How does the LLM interaction work?

In general the LLM should always output responses enclosed in tags. It's not "real" HTML or XML or any kind of markup, it's just ways to wrap different kinds of output that can appear in a single response.

I deliberately did not use Tools or function calls for this. The basic model of how a tool works isn't good for a game. The providers all generally expect:

1. Setup the situation as a prompt
2. Get the LLM to emit one or more tool calls (and handling the LLM's reluctance to actually emit multiple calls)
3. "Return" the "execution" of the tool call. This makes sense if the LLM is looking up information, but for a game it's mostly just updating game state and there's not interesting results.
4. Prod the LLM into finishing the response given the result of those executions.

I really want the LLM to simply state what should happen, and then make it happen, and not return to the LLM at all.

Also when getting an LLM to simulate some fictional entity it's very useful to present the task as something like dialog generation, and never make the LLM "pretend" to be another person. Instead the LLM plays the part of a script writer. Tags get the LLM into the mode of writing dialog or simulating the effect of actions instead of the unnecessary and difficult task of changing the LLM's primary (helpful) personality to be something else.

## What's with the update stream?

If you look at the code you'll notice that the only real mutable structure is a stream of updates. There are "views" of the current state of the game given all the updates, but all edits are new updates added to the stream.

I find it's easier to work with and debug the system if the whole things is one long list of updates:

1. You get a chance to see all the changes; the changes become concrete saved objects. You don't just have to use lots of console.log statements and try to figure out how state updates.
2. You get undo that can undo _everything_ automatically. This is important because it's common to try something, get the wrong response, change the prompt, and you want to retry that same thing.
3. There's an opportunity to understand history. For instance if you want to know what an NPC character experienced you can know where the NPC was in the past, including only the history that was visible to the NPC.

## Is this based on something?

I've done other similar projects in the past, much of which I wrote about in [Roleplaying driven by an LLM: observations & open questions](https://ianbicking.org/blog/2024/04/roleplaying-by-llm), but this is an independent piece of code. I do feel like I'm developing a "game engine" of sorts, but for now I'm developing a game that happens to have an engine as part of it.

## Is this generated with AI?

I use Copilot and GPT extensively, but no large chunks are created independently by AI. But much of the game [dossier](./docs/dossier.md) was created in close collaboration with GPT.

## Security?

Because it all runs in the browser locally it's mostly fine... but it also means that there's a way to run arbitrary LLM calls with the deployed API key because the server isn't aware of what makes up a valid prompt or the state of any particular game. Pretty please don't abuse this. It's not even worth it, right? There's so many easier ways to run things on an LLM.
