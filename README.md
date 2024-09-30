# About

This is a game written from September 27-29, 2024, for the [Text Adventure Hack](https://textadventurehack.com/).

The main branch is deployed on [intra-game.vercel.app](https://intra-game.vercel.app/)

# Installation instructions

This is a [Next.js](https://nextjs.org). It can be deployed on Vercel, run locally... or probably run elsewhere without too much trouble.

To run this you'll need a [Google Gemini API key](https://aistudio.google.com/app/apikey) (you should be able to get one for free, and run this game using a free-tier API key). ([Why Gemini?](#why-gemini)) Put the key in `.env.local` as `GEMINI_KEY="..."`

The tech stack:

- Next.js
  - React
  - TypeScript
- Tailwind for styling
- [Preact Signals](https://preactjs.com/guide/v10/signals/) for state management
- Actual game state is stored in [browser localStorage](./lib/persistentsignal.ts)
- [One wee little server endpoint](./app/api/llm/route.ts)
- The Gemini LLM

## Getting Started

Sign up for a [Gemini API Key](https://aistudio.google.com/app/apikey) and put it in `.env.local`:

```
GEMINI_KEY="your key"
```

Run `npm install` to install and `npm run dev` to run locally.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

# Code

There are only a few important parts of the code! Note that many contain spoilers.

- [types.ts](./lib/types.ts) defines (almost) all the types used throughout the game
- [model.ts](./lib/model.ts) actually runs the game and manages game state
- [application.tsx](./app/application.tsx) is the entire UI
- [game/](./lib/game/) contains the game setup, [entities.ts](./lib/game/entities.ts) for all the autonomous entities (people and AI), and [rooms.ts](./lib/game/rooms.ts) for all the locations.
- [dossier.txt](./docs/dossier.txt) is the game background. I wasn't able to use much of this given the constrained implementation time, but I hope to eventually!

There's a little more UI in [components/](./components/) and some libraries in [lib/](./lib/), but they are mostly generic and secondary. Besides application.tsx [app/](./app/) is mostly boilerplate or glue.

# FAQ

## What are you trying to accomplish with this?

There's lots of LLM-based games that let the LLM hallucinate the entire story. But these have a dreamlike quality to them... things come into existance only as they are imagined. They are ungrounded. A normal text adventure has a very strict structure, with a set of formal commands to navigate that structure.

In this game I'm trying to have a bit of both. There's an underlying game model and a grounding to the story, but with opportunities for the user and LLM to navigate that together in imaginative ways.

## Why Gemini?

Entirely because Gemini offers a generous free tier, making it possible to share this application without much risk of large API charges.

Is Gemini good? Eh. It's no GPT or Claude. But it'll do.

## How does the LLM interaction work?

In general the LLM will always output responses enclosed in tags. It's not "real" HTML or XML or any kind of markup, it's just ways to wrap different kinds of output that can appear in a single response.

I deliberately did not use Tools or function calls for this. In part because Gemini isn't very good at them. But also the basic model of how a tool works isn't good for a game. The providers all generally expect:

1. Setup the situation as a prompt
2. Get the LLM to emit one or more tool calls (and handling the LLM's reluctance to actually emit multiple calls)
3. "Return" the "execution" of the tool call. This makes sense if the LLM is looking up information, but for a game it's mostly just updating game state and there's not interesting results.
4. Prod the LLM into finishing the response.

I really want the LLM to simply state what should happen, and then make it happen, and not return to the LLM at all.

Also when getting an LLM to simulate some fictional entity it's very useful to present the task as something like dialog generation, and never make the LLM "pretend" to be another person. Instead the LLM plays the part of a script writer. Tags get the LLM into the mode of writing dialog or simulating the effect of actions instead of the unnecessary and difficult task of changing the LLM's primary (helpful) personality to be something else.

## What's with the update stream?

If you look at the code you'll notice that the only real mutable structure is a stream of updates. There are "views" of the current state of the game given all the updates, but all edits are new updates added to the stream.

I find it's easier to work with and debug the system if the whole things is one long list of updates:

1. You get a chance to see all the changes; the changes become concrete saved objects. You don't just have to use lots of console.log statements and try to figure out how state updates.
2. You get undo that can undo _everything_ automatically. This is important because it's common to try something, get the wrong response, change the prompt, and you want to retry that same thing.
3. There's an opportunity to understand history. For instance if you want to know what an NPC character experienced you can know where the NPC was in the past, including only the history that was visible to the NPC.

## Is this based on something?

I've written almost all of this code from scratch for this hackathon. But I've done other similar projects in the past, much of which I wrote about in [Roleplaying driven by an LLM: observations & open questions](https://ianbicking.org/blog/2024/04/roleplaying-by-llm)

The actual code I brought over from other projects is persistentsignal.ts, parsetags.ts, template.ts, scrollonupdate.tsx

## Is this generated with AI?

I use Copilot and GPT extensively, but no large chunks are created independently by AI. There has been a lot of design work in creating the game, which is to say: I didn't know what this should be when I started. But much of the game [dossier](./docs/dossier.txt) was created in close collaboration with GPT.

## Security?

Because it all runs in the browser locally it's mostly fine... but it also means that there's a way to run arbitrary Gemini LLM calls with the deployed API key because the server isn't aware of what makes up a valid prompt or the state of any particular game. Pretty please don't abuse this. It's not even worth it, right? There's so many easier ways to run things on an LLM.
