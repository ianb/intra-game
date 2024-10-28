import { A, Button, CheckButton } from "@/components/input";
import LlmLog, { clearLogs } from "@/components/llmlog";
import ScrollOnUpdate from "@/components/scrollonupdate";
import { Entity, Exit, Person, Room } from "@/lib/game/classes";
import {
  isPerson,
  isStoryActionAttempt,
  isStoryDescription,
  isStoryDialog,
  PersonScheduledEventType,
  PersonScheduleType,
  StoryEventWithPositionsType,
} from "@/lib/types";
import { StoryEventType } from "@/lib/types";
import { model, SaveListType } from "@/lib/game/model";
import { parseTags, serializeAttrs } from "@/lib/parsetags";
import { persistentSignal } from "@/lib/persistentsignal";
import { effect, signal, useSignal } from "@preact/signals-react";
import compare from "just-compare";
import sortBy from "just-sort-by";
import React from "react";
import { KeyboardEvent, useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge";
import { ZoomOverlay } from "@/components/zoom";
import { Clock } from "@/components/digitalnumerals";
import { scheduleForTime, timeAsString } from "@/lib/game/scheduler";
import { ModelSelector, ModelType } from "@/components/modelselector";
import { customEndpoint, lastLlmError, openrouterModel } from "@/lib/llm";
import { openrouterCode, OpenRouterConnect } from "@/components/openrouter";
import { CalculatingThrobber } from "@/components/throbber";

const activeTab = persistentSignal("activeTab", "map");
const showInternals = persistentSignal("showInternals", false);
const revealMap = persistentSignal("revealMap", false);
const seenHelp = persistentSignal("seenHelp", false);
const soundOn = signal(false);

effect(() => {
  const s = soundOn.value;
  if (s) {
    model.soundtrackPlayer.unpause();
  } else {
    model.soundtrackPlayer.pause();
  }
});

let textareaRef: React.RefObject<HTMLTextAreaElement>;

export default function Home() {
  useEffect(() => {
    model.checkLaunch();
  }, []);
  const openHelp = useSignal(!seenHelp.value);
  const openSettings = useSignal(false);
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-800 text-white p-2 fixed w-full top-0 flex justify-between">
        <span className="flex-shrink">
          Intra
          <span className="text-gray-500 text-sm hidden md:inline">
            {" "}
            !alpha: save games will break periodically
          </span>
          <span className="text-gray-500 text-sm md:hidden"> !alpha</span>
        </span>
        <span className="whitespace-nowrap bg-gray-800">
          <Time />
          <Button
            className="bg-inherit border border-green-300 rounded-full py-0 px-3 ml-4 hover:bg-green-600"
            onClick={() => {
              openHelp.value = false;
              openSettings.value = !openSettings.value;
            }}
          >
            ⚙
          </Button>
          <Button
            className={twMerge(
              "bg-inherit py-0 ml-4 px-1 hover:text-cyan-300",
              soundOn.value ? "" : "opacity-25"
            )}
            onClick={() => {
              soundOn.value = !soundOn.value;
            }}
          >
            🔊
          </Button>
          <Button
            className="bg-inherit border border-green-300 rounded-full py-0 px-3 ml-4 hover:bg-green-600"
            onClick={() => {
              openSettings.value = false;
              openHelp.value = !openHelp.value;
            }}
          >
            ?
          </Button>
        </span>
      </div>

      {openHelp.value && (
        <ZoomOverlay
          className="w-3/4 h-3/4"
          onDone={() => {
            openHelp.value = false;
            seenHelp.value = true;
          }}
        >
          <Help />
        </ZoomOverlay>
      )}

      {openSettings.value && (
        <ZoomOverlay
          className="w-3/4 h-3/4"
          onDone={() => {
            openSettings.value = false;
          }}
        >
          <Settings />
        </ZoomOverlay>
      )}

      <div className="flex flex-1 pt-12 md:overflow-hidden flex-col md:flex-row">
        <div className="w-full md:w-2/3 flex flex-col p-4 bg-gray-900 text-white">
          <ScrollOnUpdate
            className="flex-1 overflow-y-auto p-2"
            watch={model.updates.value}
            watch2={lastLlmError.value}
            watch3={model.runningSignal.value}
          >
            <ChatLog />
          </ScrollOnUpdate>
          <Input />
        </div>
        <div className="w-full md:w-1/3 flex flex-col bg-gray-800 text-white h-full">
          <HeadsUpDisplay />
          <Controls />
        </div>
      </div>
    </div>
  );
}

function ChatLog() {
  return (
    <div>
      {model.updatesWithPositions.value.map((eventPos, i) => (
        <ChatLogItem eventPos={eventPos} key={i} />
      ))}
      {lastLlmError.value && (
        <div className="bg-red-900 text-white mx-8">
          <button
            className="float-right text-xs"
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
      {model.runningSignal.value && <CalculatingThrobber />}
    </div>
  );
}

function ChatLogItem({ eventPos }: { eventPos: StoryEventWithPositionsType }) {
  const update = eventPos.event;
  return (
    <>
      {Object.keys(update?.changes || {}).length > 0 && (
        <ChatLogStateUpdate update={update} />
      )}
      {update.actions.length > 0 && (
        <ChatLogEntityInteraction update={update} />
      )}
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

function ChatLogStateUpdate({ update }: { update: StoryEventType }) {
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
  const children: React.ReactNode[] = [];
  if (showInternals.value && update.llmResponse) {
    const tags = parseTags(update.llmResponse);
    children.push(
      <div key="states">
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
      </div>
    );
  } else {
    for (const [entityId, changes] of Object.entries(update.changes)) {
      if (changes.before.inside !== changes.after.inside) {
        const dest = model.world.getRoom(changes.after.inside);
        if (dest) {
          children.push(
            <div className="pl-4" key={`move-${entityId}`}>
              ==&gt; <span className={dest.color}>{dest.name}</span>
            </div>
          );
        }
      }
    }
    const room = model.world.getRoom(update.roomId);
    children.push(
      ...update.actions.map((action, i) => {
        if (isStoryDialog(action)) {
          // Should also use id, toId, toOther
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
            text = room.formatStoryAction(update, action);
          }
          return (
            <React.Fragment key={i}>
              {dest && (
                <div className="text-xs">
                  to <span className={destColor}>{dest}</span>
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
            text = room.formatStoryAction(update, action);
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
                  action.success ? "border-green-600" : "border-red-600"
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
      })
    );
  }
  const entity = model.world.getEntity(update.id);
  return (
    <div className={entity?.color}>
      {entity?.id !== "entity:narrator" && (
        <div className={twMerge("font-bold")}>{entity?.name}</div>
      )}
      {children}
    </div>
  );
}

function ChatLogMovement({
  eventPos,
}: {
  eventPos: StoryEventWithPositionsType;
}) {
  const children: React.ReactNode[] = [];
  const playerPos = eventPos.positions.get("player");
  for (const [entityId, changes] of Object.entries(eventPos.event.changes)) {
    if (entityId === "player") {
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
        </div>
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
        </div>
      );
    }
  }
  if (children.length) {
    return <div className="mb-2">{children}</div>;
  }
  return null;
}

function Input() {
  // FIX for a lack of using a signal for model.lastSuggestions
  const v = model.updates.value;
  textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current && !model.runningSignal.value) {
      textareaRef.current.focus();
    }
  }, [model.runningSignal.value]);
  async function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  }
  async function onSubmit() {
    if (model.runningSignal.value) {
      return;
    }
    if (!textareaRef.current) {
      return;
    }
    const text = textareaRef.current.value;
    if (!text) {
      return;
    }
    if (text === "/reset") {
      model.reset();
    } else {
      await model.sendText(text);
    }
    textareaRef.current.value = "";
    setTimeout(() => {
      textareaRef.current!.focus();
    }, 0);
  }
  async function onUndo(event: React.MouseEvent<HTMLButtonElement>) {
    if (model.runningSignal.value) {
      return;
    }
    if (event.shiftKey) {
      // Perform the special behavior for shift-click
      await model.redo();
      return;
    }
    const lastInput = model.undo();
    if (lastInput) {
      textareaRef.current!.value = lastInput;
    }
    textareaRef.current!.focus();
  }
  let placeholder = "Waiting...";
  if (!model.runningSignal.value) {
    placeholder =
      model.world.lastSuggestions || "ENTER COMMAND OR INSTRUCTIONS";
    if (model.updates.value.length < 7) {
      placeholder =
        "These are just SUGGESTIONS, you can type anything...\n" + placeholder;
    }
  }
  return (
    <div className="flex mt-4">
      <textarea
        ref={textareaRef}
        rows={2}
        className={twMerge(
          "flex-1 resize-none bg-gray-800 text-white border-none p-2",
          model.runningSignal.value && "opacity-50 bg-gray-600"
        )}
        placeholder={placeholder}
        disabled={model.runningSignal.value}
        onKeyDown={onKeyDown}
      />
      <div className="flex flex-col ml-2">
        <Button className="bg-green-600 text-green-100" onClick={onSubmit}>
          Send
        </Button>
        <Button className="bg-yellow-500 text-yellow-900" onClick={onUndo}>
          Undo
        </Button>
      </div>
    </div>
  );
}

function HeadsUpDisplay() {
  const activeClass = "text-black bg-gray-100 cursor-pointer";
  const inactiveClass = "cursor-pointer";
  const showLogs = true; // Could be based on showInternals or something, but I don't want it to be
  return (
    <div className="h-2/3 p-4 border-b border-gray-700 overflow-y-auto">
      <div>
        {activeTab.value === "log" && (
          <span className="float-right z-50 pl-4 pr-1">
            <Button
              className="bg-red-800 text-xs p-1 opacity-50 hover:opacity-100"
              onClick={clearLogs}
            >
              clear
            </Button>
          </span>
        )}
        {activeTab.value === "map" && (
          <span className="float-right">
            <Button
              className="bg-teal-800 text-xs p-1 opacity-50 hover:opacity-100"
              onClick={() => {
                revealMap.value = !revealMap.value;
              }}
            >
              {revealMap.value ? "revealed" : "normal"}
            </Button>
          </span>
        )}
        <span
          onClick={() => {
            activeTab.value = "inv";
          }}
          className={activeTab.value === "inv" ? activeClass : inactiveClass}
        >
          inv
        </span>{" "}
        {/* <span
          onClick={() => {
            activeTab.value = "access";
          }}
          className={activeTab.value === "access" ? activeClass : inactiveClass}
        >
          (a)ccess
        </span>{" "}
        <span
          onClick={() => {
            activeTab.value = "blips";
          }}
          className={activeTab.value === "blips" ? activeClass : inactiveClass}
        >
          (b)lips
        </span>{" "} */}
        {(showLogs || activeTab.value === "map") && (
          <span
            onClick={() => {
              activeTab.value = "map";
            }}
            className={activeTab.value === "map" ? activeClass : inactiveClass}
          >
            map
          </span>
        )}{" "}
        {(showLogs || activeTab.value === "log") && (
          <span
            onClick={() => {
              activeTab.value = "log";
            }}
            className={activeTab.value === "log" ? activeClass : inactiveClass}
          >
            log
          </span>
        )}{" "}
        {(showLogs || activeTab.value === "objs") && (
          <span
            onClick={() => {
              activeTab.value = "objs";
            }}
            className={activeTab.value === "objs" ? activeClass : inactiveClass}
          >
            objs
          </span>
        )}
      </div>
      <div>
        {activeTab.value === "inv" && <Inventory />}
        {activeTab.value === "access" && <AccessControl />}
        {activeTab.value === "blips" && <Blips />}
        {activeTab.value === "map" && <Map />}
        {activeTab.value === "log" && <LlmLog />}
        {activeTab.value === "objs" && <ViewObjects />}
      </div>
    </div>
  );
}

function Inventory() {
  // This is *based* on updates, so I'm using this to keep it updated:
  const updates = model.updates.value;
  const player = model.world.entities.player;
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Inventory</div>
      (no inventory implemented)
      <div>- Key card</div>
    </div>
  );
}

function AccessControl() {
  const updates = model.updates.value;
  const player = model.world.entities.player;
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Access Control</div>
      (no access control implemented)
    </div>
  );
}

function Blips() {
  const updates = model.updates.value;
  const player = model.world.entities.player;
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Blips</div>
      (no blips implemented)
    </div>
  );
}

function Controls() {
  const showSave = useSignal(false);
  const showLoad = useSignal(false);
  return (
    <div className="h-1/3 p-4 overflow-y-auto">
      <div className="float-right text-xs">
        {!showLoad.value && (
          <CheckButton
            signal={showSave}
            on="Cancel"
            off="💾"
            className="mr-1"
          />
        )}
        {!showSave.value && (
          <CheckButton
            signal={showLoad}
            on="Cancel"
            off="📂"
            className="mr-1"
          />
        )}
        {!showSave.value && !showLoad.value && (
          <CheckButton
            signal={showInternals}
            on="Internals (Spoilers)"
            off="Normal Mode"
          />
        )}
      </div>
      {!showSave.value && !showLoad.value && <NormalControls />}
      {showSave.value && (
        <SaveControls
          onDone={() => {
            showSave.value = false;
          }}
        />
      )}
      {showLoad.value && (
        <LoadControls
          onDone={() => {
            showLoad.value = false;
          }}
        />
      )}
    </div>
  );
}

function NormalControls() {
  const room = model.world.entityRoom("player")!;
  // FIXME: actually collect the people:
  const folks: Person[] = model.world
    .entitiesInRoom(room)
    .filter((x) => isPerson(x))
    .filter((x) => !x.invisible && x.id !== "player");
  function onConverse(entity: Person) {
    if (!textareaRef?.current) {
      return;
    }
    if (textareaRef.current.value.includes(`${entity.name}:`)) {
      textareaRef.current.focus();
      return;
    }
    if (textareaRef.current.value) {
      textareaRef.current.value += "\n";
    }
    textareaRef.current.value += `${entity.name}: `;
    textareaRef.current.focus();
  }
  return (
    <>
      <div className="mb-2">Controls</div>
      <div className="border-b border-gray-400">
        Location:{" "}
        <strong className={room?.color}>{room?.name || "In the void"}</strong>
      </div>
      {room && (
        <div className="flex space-x-4">
          {model.world.entities.Ama.personality === "intro" ? (
            <IntroList />
          ) : (
            <ExitList room={room} />
          )}
          {folks.length > 0 && (
            <div className="flex-1">
              People:
              <ul className="list-dash ml-4">
                {folks.map((entity, i) => (
                  <li key={i}>
                    <Button
                      className={twMerge(
                        "p-0 bg-inherit hover:bg-gray-700",
                        entity.color
                      )}
                      onClick={() => {
                        return onConverse(entity);
                      }}
                    >
                      {entity.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function IntroList() {
  function checkText(cond: boolean) {
    return cond ? "[x]" : "[ ]";
  }
  function extraCheck(cond: boolean) {
    return cond ? " ✓" : "";
  }
  // Dependency thing...
  const u = model.updates.value;
  const ama = model.world.entities.Ama;
  return (
    <div className="flex-1">
      Welcome to Intra!
      <ul>
        <li>1. {checkText(ama.sharedSelf)} Meet Ama</li>
        <li>2. {checkText(ama.sharedIntra)} Meet Intra</li>
        <li>
          3. {checkText(ama.knowsPlayerName)} Name?
          {extraCheck(ama.knowsPlayerPronouns)}
        </li>
        <li>4. {checkText(ama.knowsPlayerProfession)} Profession?</li>
        <li>
          5. {checkText(ama.sharedDisassociation && ama.sharedPlayerAge)} Know
          about yourself?{extraCheck(ama.sharedDisassociation)}
          {extraCheck(ama.sharedPlayerAge)}
        </li>
      </ul>
    </div>
  );
}

function ExitList({ room }: { room: Room }) {
  async function onGoToRoom(room: Room, exit: Exit) {
    if (model.runningSignal.value) {
      return;
    }
    await model.sendText(`Go to ${room.name}`);
  }
  return (
    <div className="flex-1">
      Exits:
      <ul className="list-dash ml-4">
        {room!.exits.map((exit, i) => {
          const targetRoom = model.world.getRoom(exit.roomId);
          if (!targetRoom) {
            return <li key={i}>- Missing exit: {exit.roomId}</li>;
          }
          return (
            <li key={i}>
              <Button
                className={twMerge(
                  "p-0 bg-inherit hover:bg-gray-700",
                  targetRoom.color
                )}
                onClick={() => {
                  return onGoToRoom(targetRoom, exit);
                }}
                disabled={model.runningSignal.value}
              >
                {exit.name || targetRoom.name}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SaveControls({ onDone }: { onDone: () => void }) {
  const proposedTitle = useSignal("");
  useEffect(() => {
    model.proposeTitle().then((title) => {
      proposedTitle.value = title;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.updates.value]);
  return (
    <div>
      <div>Save</div>
      <input
        type="text"
        className="bg-gray-800 text-white p-2 border mr-1"
        value={proposedTitle.value}
        onInput={(e) =>
          (proposedTitle.value = (e.target as HTMLInputElement).value)
        }
      />
      <Button
        onClick={async () => {
          await model.save(proposedTitle.value);
          onDone();
        }}
      >
        Save
      </Button>
    </div>
  );
}

function LoadControls({ onDone }: { onDone: () => void }) {
  const saves = useSignal<SaveListType[]>([]);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function refresh() {
    model.listSaves().then((loadedSaves) => {
      saves.value = loadedSaves;
    });
  }
  return (
    <div>
      <div>Load</div>
      <div>
        <div className="mb-1">
          <Button
            className="text-sm mr-1 bg-gray-900 hover:bg-gray-700 text-white"
            onClick={async () => {
              model.reset();
              onDone();
            }}
          >
            New Game
          </Button>
        </div>

        {saves.value.map((save) => {
          return (
            <div key={save.slug} className="mb-1">
              <Button
                className="text-sm mr-1 bg-gray-900 hover:bg-gray-700 text-white"
                onClick={async () => {
                  await model.load(save.slug);
                  onDone();
                }}
              >
                {save.title} ({save.date})
              </Button>
              <Button
                className="text-xs bg-red-800 text-white hover:bg-red-600"
                onClick={async () => {
                  await model.removeSave(save.slug);
                  refresh();
                }}
              >
                🗑️
              </Button>
            </div>
          );
        })}
      </div>
      {saves.value.length === 0 && <div>No saves found</div>}
    </div>
  );
}

function Map() {
  const zoomed = useSignal(false);
  const g = model.world.asGraphviz(revealMap.value);
  const url = `https://quickchart.io/graphviz?graph=${encodeURIComponent(g)}`;
  return (
    <div className="flex justify-center mt-1">
      {zoomed.value && (
        <ZoomOverlay
          onDone={() => {
            zoomed.value = false;
          }}
        >
          <a href={url} target="_blank" rel="noopener">
            <img
              className="rounded h-full max-h-screen border-2 border-gray-400"
              src={url}
              alt="Map"
            />
          </a>
        </ZoomOverlay>
      )}
      <img
        className="rounded cursor-zoom-in"
        src={url}
        alt="Map"
        onClick={() => {
          zoomed.value = !zoomed.value;
        }}
      />
    </div>
  );
}

function ViewObjects() {
  const idList = model.updates.value
    .map((update) => Object.keys(update.changes))
    .flat();
  const unsortedEntities = Object.values(model.world.entities);
  const entities = sortBy(unsortedEntities, (entity) => {
    let index = idList.lastIndexOf(entity.id);
    index = idList.length - index;
    index *= 1000;
    index += unsortedEntities.indexOf(entity);
    return index;
  });
  return (
    <div>
      <div className="text-xs text-gray-300 mx-2">
        Below is a list of all objects, and the edits made to those objects over
        the course of the game
      </div>
      {entities.map((entity) => {
        return (
          <ViewObject
            key={entity.id}
            id={entity.id}
            entity={entity}
            updates={model.updates.value}
          />
        );
      })}
    </div>
  );
}

function ViewObject({
  id,
  entity,
  updates,
}: {
  id: string;
  entity: Entity;
  updates: StoryEventType[];
}) {
  const hide = useSignal(true);
  const lines = [];
  for (const [key, value] of Object.entries(entity)) {
    if (key === "world") {
      continue;
    }
    if (key === "todaysSchedule") {
      lines.push(`todaysSchedule:`);
      for (const item of value as PersonScheduledEventType[]) {
        const schedule = scheduleForTime(entity as Person, item.time);
        lines.push(
          `  ${timeAsString(item.time)}-${timeAsString(item.time + item.minuteLength)}: ${schedule?.activity || item.scheduleId}${schedule?.attentive ? " (attentive)" : ""}`
        );
        if (schedule?.secret) {
          lines.push(`    secret: ${schedule?.secretReason}`);
        }
      }
      continue;
    }
    if (!compare(value, (model.world.original as any)[id][key])) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  return (
    <div className="p-2 text-xs">
      <div
        className="bg-blue-900 text-white p-1 cursor-default"
        onClick={() => {
          hide.value = !hide.value;
        }}
      >
        {entity.id} {entity.name !== entity.id ? entity.name : ""}{" "}
        {lines.length > 0 && `(${lines.length})`}
      </div>
      {!hide.value && (
        <>
          <pre className="whitespace-pre-wrap text-white bg-gray-900 pl-1">
            {lines.join("\n")}
          </pre>
        </>
      )}
    </div>
  );
}

function Time() {
  // To declare its dependent on this...
  const v = model.updates.value;
  return (
    <Clock className="text-red-500" time={model.world.timeOfDay} bg="#1f2937" />
  );
}

function TimePeriod({
  minutes,
  limit,
  className,
}: {
  minutes?: number;
  limit?: number;
  className?: string;
}) {
  if (minutes === undefined) {
    return null;
  }
  let timeChar = "";
  if (minutes && minutes >= 10) {
    const timePeriod = Math.min(Math.round(minutes / 5), 11);
    timeChar = (CLOCK_CHARS as any)[timePeriod.toString()] || CLOCK_CHARS["11"];
  }
  if (limit !== undefined && minutes < limit) {
    return null;
  }
  return (
    <div
      className={twMerge("cursor-help opacity-50 hover:opacity-100", className)}
      title={`${minutes} minutes passed`}
    >
      {timeChar}
    </div>
  );
}

function Help() {
  return (
    <div className="w-full h-full bg-blue-900 text-white py-4 px-8 border-white border-8 overflow-scroll">
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1 text-left text-sm">
          <a
            className="text-cyan-300 hover:underline"
            href="https://github.com/ianb/intra-game"
            target="_blank"
            rel="noopener"
          >
            github
          </a>
        </div>
        <div className="flex-1 text-center">░░▒▒▓▓ Intra ▓▓▒▒░░</div>
        <div className="flex-1 text-right text-sm">
          <a
            className="text-cyan-300 hover:underline"
            href="https://ianbicking.org"
            target="_blank"
            rel="noopener"
          >
            by Ian Bicking
          </a>
        </div>
      </div>
      <div className="mb-4">
        Welcome to the Intra Complex! Everything here is just perfect. No need
        to worry about a thing... except figuring out where you are. But don't
        worry, you're in good hands.
      </div>
      <div className="mb-4">
        You will play a character from a time not unlike today, except maybe
        with more smart fridges that talk back. You decide your name and
        profession - don't overthink it, just pick something and keep an eye out
        for suspiciously friendly fridges.
      </div>
      <div className="mb-4">
        This is a text adventure (or as it's now more fashionably called,
        "interactive fiction"). Whether you're exploring strange rooms,
        questioning fellow citizens, or trying to outwit the AI, type whatever
        comes to mind. The system is smart enough to figure it out (most of the
        time).
      </div>
      <div className="flex justify-center mb-4">
        <pre>
          {"+-------------------------+\n"}
          {"| story         | map     |\n"}
          {"| ...           |         |\n"}
          {"| ...           |         |\n"}
          {"| ...           +---------|\n"}
          {"+---------------+ rooms & |\n"}
          {"| TYPE HERE     | people  |\n"}
          {"+---------------+---------+\n"}
        </pre>
      </div>
      <div className="flex justify-center">
        <span className="done bg-green-800 hover:bg-green-600 cursor-pointer px-4">
          DONE
        </span>
      </div>
    </div>
  );
}

function Settings() {
  return (
    <div className="w-full h-full bg-blue-900 text-white py-4 px-8 border-white border-8 overflow-scroll flex flex-col">
      <div className="flex justify-center mb-4">Settings</div>
      <div className="flex-1 overflow-y-auto">
        <div>
          Choose a model:
          <br />
          <ModelSelector
            signal={openrouterModel}
            freeOnly={!openrouterCode.value}
          />
        </div>
        <div className="mt-4">
          {openrouterCode.value ? (
            <>
              You have a code from{" "}
              <A href="https://openrouter.ai/keys" blank>
                OpenRouter.ai
              </A>
              : <br />
              <code>
                {openrouterCode.value.slice(0, 12)}...
                {openrouterCode.value.slice(-3)}
              </code>
              <Button
                className="ml-4"
                onClick={() => {
                  openrouterCode.value = null;
                }}
              >
                Remove code
              </Button>
            </>
          ) : (
            <>
              <div className="mb-4">
                To have access to paid models you can get a code from
                <A href="https://openrouter.ai/" blank>
                  OpenRouter.ai
                </A>
              </div>
              <div>
                <OpenRouterConnect />
              </div>
            </>
          )}
          <div className="mt-4">
            Set a custom endpoint: <br />
            <input
              type="text"
              className="bg-gray-800 text-white p-2 w-2/3"
              value={customEndpoint.value || ""}
              onInput={(e) => {
                customEndpoint.value = (e.target as HTMLInputElement).value;
              }}
              placeholder="http://localhost:5001/v1"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        <span className="done bg-green-800 hover:bg-green-600 cursor-pointer px-4">
          DONE
        </span>
      </div>
    </div>
  );
}

const CLOCK_CHARS = {
  "12": "🕛",
  "1": "🕐",
  "2": "🕑",
  "3": "🕒",
  "4": "🕓",
  "5": "🕔",
  "6": "🕕",
  "7": "🕖",
  "8": "🕗",
  "9": "🕘",
  "10": "🕙",
  "11": "🕚",
};

function ColorizedText({ text }: { text: string }) {
  if (!text) {
    return null;
  }
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const nameRegex = model.world.nameRegex;
  const matches = text.matchAll(nameRegex);
  for (const match of Array.from(matches)) {
    const matchedWord = match[2]; // This is the captured word from the group
    const matchIndex = match.index! + match[1].length; // Adjust index to start of the word

    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    const ent = model.world.getEntity(matchedWord);
    parts.push(
      <span className={ent?.color} key={matchIndex}>
        {matchedWord}
      </span>
    );

    lastIndex = matchIndex + matchedWord.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return <>{parts}</>;
}
