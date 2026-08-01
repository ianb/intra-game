/**
 * The transcript: the story events the engine has produced, rendered in
 * order, plus the partial tag currently streaming in.
 */

import React, { KeyboardEvent, useEffect, useRef } from "react";
import {
  isPerson,
  isStoryActionAttempt,
  isStoryDescription,
  isStoryDialog,
  PersonScheduledEventType,
  StoryEventType,
  StoryEventWithPositionsType,
} from "@/lib/types";
import { A, Button, CheckButton } from "@/components/input";
import { CalculatingThrobber } from "@/components/throbber";
import { ColorizedText } from "./colorizedtext";
import { Entity, Exit, Person, Room } from "@/lib/game/classes";
import { TimePeriod } from "./hud";
import { imageForEntity } from "./images";
import { model } from "./model";
import {
  authState,
  pendingInput,
  sessionStatus,
  signIn,
  turnRunning,
} from "./session";
import { lastLlmError, openSettings, showInternals } from "./uistate";
import { parseTags, serializeAttrs } from "@/lib/parsetags";
import { renderStoryAction } from "./renderstoryaction";
import { scheduleForTime, timeAsString } from "@/lib/game/scheduler";
import { twMerge } from "tailwind-merge";
import { useSignals } from "@preact/signals-react/runtime";

export function ChatLog() {
  useSignals();
  return (
    <div>
      {model.updatesWithPositions.value.map((eventPos, i) => (
        <ChatLogItem eventPos={eventPos} key={i} />
      ))}
      {lastLlmError.value && (
        <div className="bg-red-900 text-white mx-8">
          <button
            className="float-right text-xs mr-2 text-xl hover:text-blue-600"
            onClick={() => {
              lastLlmError.value = "";
            }}
          >
            &times;
          </button>
          <div className="text-xs text-center">LLM error:</div>
          <pre className="text-sm whitespace-pre-wrap p-2">
            {lastLlmError.value}
          </pre>
        </div>
      )}
      <LoadingLine />
      <PendingInput />
      <StreamingLine />
      {turnRunning.value && !model.streaming.value && <CalculatingThrobber />}
    </div>
  );
}

/**
 * What to do when the game can't reach a model.
 *
 * Local play needs the player's own OpenRouter key, and a first-time visitor
 * doesn't have one — so on a deployment that can host games, this error is the
 * first and only moment they have a reason to sign in. Offering it anywhere
 * else (it used to be in Settings alone) means the dead end comes first and the
 * way out is somewhere they had no reason to look.
 */
function NoModelAccess() {
  useSignals();
  const auth = authState.value;
  const canSignIn = auth?.loginUrl && !auth.email;
  return (
    <div className="flex justify-center gap-2 pb-2">
      {canSignIn && (
        <Button
          className="bg-blue-700"
          onClick={() => {
            signIn(auth.loginUrl!);
          }}
        >
          Sign in with Google to play here
        </Button>
      )}
      <Button
        onClick={() => {
          openSettings.value = true;
        }}
      >
        ⚙ {canSignIn ? "Or use your own key" : "Open settings"}
      </Button>
    </div>
  );
}

/**
 * What is being waited for, while there is no game on screen yet.
 *
 * Only shown when the transcript is empty, which is the one time there is
 * nothing else to look at. Getting a game on screen is a round trip to find out
 * who you are, one to find the game, one to read its log, and for a new game a
 * model call to write the opening — several seconds, and all of it used to
 * happen behind a blank page.
 */
function LoadingLine() {
  useSignals();
  const status = sessionStatus.value;
  if (!status || model.updates.value.length || model.streaming.value) {
    return null;
  }
  return (
    <div className="text-gray-400 text-center py-8">
      {status}
      <span className="animate-pulse">▋</span>
    </div>
  );
}

/**
 * What the player just sent, before the server has said anything back.
 *
 * The player's line is part of the turn's result: the server appends it to the
 * log along with everything it caused, and none of that arrives until the turn
 * is over. So the transcript sat unchanged through the whole wait, and pressing
 * enter read as having done nothing.
 *
 * Dimmed, like the streaming text, because it is provisional — the
 * authoritative event replaces it when the turn lands.
 */
function PendingInput() {
  useSignals();
  const text = pendingInput.value;
  if (!text) {
    return null;
  }
  const player = model.world.getEntity("PLAYER");
  return (
    <div
      className={twMerge(
        player?.color,
        "border-l-2 pl-2 border-emerald-300 opacity-70",
      )}
    >
      {player?.name && <div className="font-bold">{player.name}</div>}
      <pre className="pl-3 whitespace-pre-wrap -indent-2 mb-2">{text}</pre>
    </div>
  );
}

/**
 * Narrative text still arriving from the model.
 *
 * This is provisional: when the turn completes the authoritative event lands in
 * the log and renders normally, and this clears. It replaces the throbber while
 * text is flowing, so a turn reads as arriving rather than as a wait followed by
 * a wall of text.
 */

function StreamingLine() {
  useSignals();
  const streaming = model.streaming.value;
  if (!streaming) {
    return null;
  }
  const speaker = model.world.getEntity(streaming.entityId);
  const isDialog = streaming.tag.type === "dialog";
  return (
    <>
      {speaker?.name && isDialog && (
        <div className="text-xs">
          <span className={speaker.color}>{speaker.name}</span> says
        </div>
      )}
      <pre
        className={twMerge(
          "whitespace-pre-wrap mb-2 opacity-70",
          isDialog ? "pl-3 -indent-2" : "px-2 mx-8 text-sm",
        )}
      >
        {streaming.tag.content}
        <span className="animate-pulse">▋</span>
      </pre>
    </>
  );
}

function ChatLogItem({ eventPos }: { eventPos: StoryEventWithPositionsType }) {
  useSignals();
  const update = eventPos.event;
  return (
    <>
      {Object.keys(update?.changes || {}).length > 0 && (
        <ChatLogStateUpdate update={update} />
      )}
      {update.actions.length > 0 && (
        <ChatLogEntityInteraction update={update} />
      )}
      <ChatLogTodos update={update} />
      <ChatLogMovement eventPos={eventPos} />
      {update.llmError && (
        <pre className="whitespace-pre-wrap text-red-400">
          <button
            className="float-right text-lg font-bold opacity-75 hover:opacity-100"
            onClick={() => model.removeStoryEvent(update)}
          >
            ×
          </button>
          {update.llmError.context}:{"\n"}
          {update.llmError.description}
        </pre>
      )}
    </>
  );
}

/**
 * "☐ find the missing ficus" where it happened, in the story.
 *
 * The task panel is a tab the player has to think to open. Something arriving
 * on the list is a small event in the fiction — someone asked you to do a thing
 * — and it reads better in place than as a number that quietly went up.
 */
function ChatLogTodos({ update }: { update: StoryEventType }) {
  useSignals();
  if (!update.todos?.length) {
    return null;
  }
  return (
    <div className="text-xs text-amber-300 my-1">
      {update.todos.map((todo) => (
        <div
          key={todo.id}
          className="cursor-default"
          title={todo.done ? "crossed off your list" : "added to your list"}
        >
          {todo.done ? "☑ " : "☐ "}
          <span className={todo.done ? "line-through" : ""}>{todo.title}</span>
        </div>
      ))}
    </div>
  );
}

function ChatLogStateUpdate({ update }: { update: StoryEventType }) {
  useSignals();
  function formatSchedule(schedule: PersonScheduledEventType[]) {
    if (!schedule || schedule.length === 0) {
      return "no schedule";
    }
    return schedule
      .map((item) => `${timeAsString(item.time)} ${item.scheduleId}`)
      .join(", ");
  }
  if (!showInternals.value) {
    return null;
  }
  const lines = [`Update ${update.id}:`];
  for (const [entityId, changes] of Object.entries(update.changes)) {
    for (const attr of Object.keys(changes.after || {})) {
      let before = JSON.stringify(changes.before ? changes.before[attr] : null);
      let after = JSON.stringify(changes.after ? changes.after[attr] : null);
      if (before === "undefined" && after === "undefined") {
        continue;
      }
      if (attr === "todaysSchedule") {
        before = formatSchedule(changes.before.todaysSchedule);
        after = formatSchedule(changes.after.todaysSchedule);
      }
      lines.push(`  ${entityId}.${attr}: ${before} => ${after}`);
    }
  }
  return (
    <pre className="text-xs whitespace-pre-wrap text-purple-400">
      {lines.join("\n")}
    </pre>
  );
}

function ChatLogEntityInteraction({ update }: { update: StoryEventType }) {
  useSignals();
  const children: React.ReactNode[] = [];
  if (showInternals.value && update.llmResponse) {
    const tags = parseTags(update.llmResponse);
    // The d20 the adjudicator saw, which is upstream of the llmResponse and
    // so isn't in any tag. Shown above the actionResolution so a "the
    // recorder erases itself" can be told apart from a critical failure.
    const rolled = update.actions
      .filter(isStoryActionAttempt)
      .find((action) => action.roll !== undefined);
    children.push(
      <div key="states">
        {rolled && (
          <pre className="whitespace-pre-wrap text-xs pl-2 text-amber-400">
            {`d20: ${rolled.roll}` +
              (rolled.roll === 1
                ? " (critical failure)"
                : rolled.roll === 20
                  ? " (critical success)"
                  : "")}
          </pre>
        )}
        {tags.map((tag, i) => (
          <div key={i}>
            <pre className="whitespace-pre-wrap text-xs pl-2">
              {`<${tag.type}${serializeAttrs(tag.attrs)}>`}
            </pre>
            <pre className="whitespace-pre-wrap pl-6 text-sm">
              {tag.content}
            </pre>
          </div>
        ))}
      </div>,
    );
  } else {
    for (const [entityId, changes] of Object.entries(update.changes)) {
      if (changes.before.inside !== changes.after.inside) {
        const dest = model.world.getRoom(changes.after.inside);
        if (dest) {
          children.push(
            <div className="pl-4" key={`move-${entityId}`}>
              ==&gt; <span className={dest.color}>{dest.name}</span>
            </div>,
          );
        }
      }
    }
    const room = model.world.getRoom(update.roomId);
    children.push(
      ...update.actions.map((action, i) => {
        if (isStoryDialog(action)) {
          let dest = "";
          let destColor = "";
          if (action.toId) {
            const person = model.world.getEntity(action.toId);
            if (person) {
              dest = person.name;
              destColor = person.color;
            }
          } else if (action.toOther) {
            dest = action.toOther;
            destColor = "font-bold";
          }
          let text: React.ReactNode = action.text;
          if (room) {
            text = renderStoryAction(room, update, action);
          }
          let fromEntity: Person | undefined;
          if (action.id && action.id !== update.id) {
            fromEntity = model.world.getEntity(action.id) as Person;
          }
          return (
            <React.Fragment key={i}>
              {(dest || fromEntity) && (
                <div className="text-xs">
                  {fromEntity && (
                    <>
                      <span className={fromEntity.color}>
                        {fromEntity.name}
                      </span>{" "}
                      says{" "}
                    </>
                  )}
                  {dest && (
                    <>
                      to <span className={destColor}>{dest}</span>
                    </>
                  )}
                </div>
              )}
              <pre className="pl-3 whitespace-pre-wrap -indent-2 mb-2">
                {text}
              </pre>
            </React.Fragment>
          );
        } else if (isStoryDescription(action)) {
          let text: React.ReactNode = action.text;
          if (room) {
            text = renderStoryAction(room, update, action);
          }
          if (typeof text === "string") {
            text = <ColorizedText text={action.text} />;
          }
          return (
            <React.Fragment key={i}>
              {action.subject && (
                <div className="text-xs">examine: {action.subject}</div>
              )}
              <pre className="px-2 mb-2 mx-8 whitespace-pre-wrap text-sm border-x-4 border-gray-600 text-justify bg-gray-700">
                <TimePeriod
                  minutes={action.minutes}
                  limit={5}
                  className="float-right"
                />
                {text}
              </pre>
            </React.Fragment>
          );
        } else if (isStoryActionAttempt(action)) {
          const attempt = <ColorizedText text={action.attempt} />;
          const performedBy = model.world.getEntity(action.id);
          return (
            <React.Fragment key={i}>
              {performedBy?.id !== update.id && (
                <div className={twMerge("text-xs", performedBy?.color)}>
                  {performedBy?.name || "?"}:
                </div>
              )}
              <div
                className={twMerge(
                  "px-2 mb-2 mx-8 whitespace-pre-wrap text-sm border-x-4 text-justify bg-gray-700",
                  action.success ? "border-green-600" : "border-red-600",
                )}
              >
                <TimePeriod
                  minutes={action.minutes}
                  limit={5}
                  className="float-right"
                />
                {attempt}
                <hr className="my-2" />
                <ColorizedText text={action.resolution} />
              </div>
            </React.Fragment>
          );
        } else {
          throw new Error("Unknown action");
        }
      }),
    );
  }
  const entity = model.world.getEntity(update.id);
  return (
    <div
      className={twMerge(
        entity?.color,
        entity?.id === "PLAYER" && "border-l-2 pl-2 border-emerald-300",
      )}
    >
      {entity?.id !== "entity:narrator" && (
        <div className={twMerge("font-bold flex items-center gap-2")}>
          {entity && <EntityAvatar id={entity.id} />}
          <span>{entity?.name}</span>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * A speaker's square face avatar, shown next to their name. Renders nothing for
 * entities without a generated image (the player, the narrator, anyone not yet
 * imaged), so it is safe next to every name.
 */
function EntityAvatar({ id }: { id: string }) {
  const url = imageForEntity(id);
  if (!url) {
    return null;
  }
  return (
    <img
      src={url}
      alt=""
      className="w-6 h-6 rounded object-cover border border-gray-600"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function ChatLogMovement({
  eventPos,
}: {
  eventPos: StoryEventWithPositionsType;
}) {
  useSignals();
  const children: React.ReactNode[] = [];
  const playerPos = eventPos.positions.get("PLAYER");
  for (const [entityId, changes] of Object.entries(eventPos.event.changes)) {
    if (entityId === "PLAYER") {
      continue;
    }
    const before = changes?.before?.inside;
    const after = changes?.after?.inside;
    if (
      before === after ||
      !after ||
      (playerPos !== before && playerPos !== after)
    ) {
      continue;
    }
    const person = model.world.getPerson(entityId);
    if (!person) {
      continue;
    }
    if (before === playerPos) {
      const afterRoom = model.world.getRoom(after);
      if (!afterRoom) {
        console.error("Missing room", after);
        continue;
      }
      children.push(
        <div key={entityId} className="text-xs">
          <span className={person.color}>{person.name}</span> goes to{" "}
          <span className={afterRoom.color}>{afterRoom.name}</span>
        </div>,
      );
    } else {
      const beforeRoom = model.world.getRoom(before);
      if (!beforeRoom) {
        console.error("Missing room", before);
        continue;
      }
      children.push(
        <div key={entityId} className="text-xs">
          <span className={person.color}>{person.name}</span> comes from{" "}
          <span className={beforeRoom.color}>{beforeRoom.name}</span>
        </div>,
      );
    }
  }
  if (children.length) {
    return <div className="mb-2">{children}</div>;
  }
  return null;
}
