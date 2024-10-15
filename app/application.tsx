import { Button, CheckButton } from "@/components/input";
import LlmLog, { clearLogs } from "@/components/llmlog";
import ScrollOnUpdate from "@/components/scrollonupdate";
import { Entity, Exit, Person, Room } from "@/lib/game/classes";
import { isPerson, isStoryDescription, isStoryDialog } from "@/lib/types";
import { StoryEventType } from "@/lib/types";
import { model, SaveListType } from "@/lib/game/model";
import { parseTags, serializeAttrs } from "@/lib/parsetags";
import { persistentSignal } from "@/lib/persistentsignal";
import { useSignal } from "@preact/signals-react";
import compare from "just-compare";
import sortBy from "just-sort-by";
import React from "react";
import { KeyboardEvent, useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge";
import { on } from "events";
import { ZoomOverlay } from "@/components/zoom";

const activeTab = persistentSignal("activeTab", "inv");
const showInternals = persistentSignal("showInternals", false);
const revealMap = persistentSignal("revealMap", false);

let textareaRef: React.RefObject<HTMLTextAreaElement>;

export default function Home() {
  useEffect(() => {
    model.checkLaunch();
  }, []);
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-800 text-white p-2 fixed w-full top-0 flex justify-between">
        <span className="">Intra</span>
        <span className=""></span>
      </div>

      <div className="flex flex-1 pt-12 overflow-hidden">
        {" "}
        {/* Add pt-12 to push down the content below the fixed top bar */}
        <div className="w-2/3 flex flex-col p-4 bg-gray-900 text-white">
          {/* Scrollable log */}
          <ScrollOnUpdate
            className="flex-1 overflow-y-auto p-2"
            watch={model.updates.value}
          >
            <ChatLog />
          </ScrollOnUpdate>
          <Input />
        </div>
        {/* Right side (Tabs and Controls) */}
        <div className="w-1/3 flex flex-col bg-gray-800 text-white h-full">
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
      {model.updates.value.map((update, i) => (
        <ChatLogItem update={update} key={i} />
      ))}
    </div>
  );
}

function ChatLogItem({ update }: { update: StoryEventType }) {
  return (
    <>
      {Object.keys(update?.changes || {}).length > 0 && (
        <ChatLogStateUpdate update={update} />
      )}
      {update.actions.length > 0 && (
        <ChatLogEntityInteraction update={update} />
      )}
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
  if (!showInternals.value) {
    return null;
  }
  const lines = [`Update ${update.id}:`];
  for (const [entityId, changes] of Object.entries(update.changes)) {
    for (const attr of Object.keys(changes.after || {})) {
      const before = changes.before ? changes.before[attr] : null;
      const after = changes.after ? changes.after[attr] : null;
      lines.push(`  ${entityId}.${attr}: ${before} => ${after}`);
    }
  }
  return (
    <pre className="text-xs whitespace-pre-wrap text-purple-600">
      {lines.join("\n")}
    </pre>
  );
}

function ChatLogEntityInteraction({ update }: { update: StoryEventType }) {
  let children: React.ReactNode[];
  if (showInternals.value && update.llmResponse) {
    const tags = parseTags(update.llmResponse);
    children = [
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
      </div>,
    ];
  } else {
    const room = model.world.getRoom(update.roomId);
    children = update.actions.map((action, i) => {
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
        return (
          <pre
            className="px-2 mb-2 mx-8 whitespace-pre-wrap text-sm border-x-4 border-gray-600 text-justify bg-gray-700"
            key={i}
          >
            {text}
          </pre>
        );
      } else {
        throw new Error("Unknown action");
      }
    });
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
  }
  let placeholder = "Waiting...";
  if (!model.runningSignal.value) {
    placeholder =
      model.world.lastSuggestions || "ENTER COMMAND OR INSTRUCTIONS";
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
          <span className="float-right">
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
          (i)nv
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
            (m)ap
          </span>
        )}{" "}
        {(showLogs || activeTab.value === "log") && (
          <span
            onClick={() => {
              activeTab.value = "log";
            }}
            className={activeTab.value === "log" ? activeClass : inactiveClass}
          >
            (l)og
          </span>
        )}{" "}
        {(showLogs || activeTab.value === "objs") && (
          <span
            onClick={() => {
              activeTab.value = "objs";
            }}
            className={activeTab.value === "objs" ? activeClass : inactiveClass}
          >
            (o)bjs
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
  async function onGoToRoom(room: Room, exit: Exit) {
    await model.sendText(`Go to ${room.name}`);
  }
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
          <div className="flex-1">
            Exits:
            <ul>
              {room!.exits.map((exit, i) => {
                const targetRoom = model.world.getRoom(exit.roomId);
                if (!targetRoom) {
                  return <li key={i}>- Missing exit: {exit.roomId}</li>;
                }
                return (
                  <li key={i}>
                    -{" "}
                    <Button
                      className={twMerge(
                        "p-0 bg-inherit hover:bg-gray-700",
                        targetRoom.color
                      )}
                      onClick={() => {
                        return onGoToRoom(targetRoom, exit);
                      }}
                    >
                      {exit.name || targetRoom.name}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
          {folks.length > 0 && (
            <div className="flex-1">
              People:
              <ul>
                {folks.map((entity, i) => (
                  <li key={i}>
                    -{" "}
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
