import { Button, CheckButton } from "@/components/input";
import LlmLog from "@/components/llmlog";
import ScrollOnUpdate from "@/components/scrollonupdate";
import { model } from "@/lib/model";
import { serializeAttrs } from "@/lib/parsetags";
import { persistentSignal } from "@/lib/persistentsignal";
import {
  EntityInteractionType,
  ExitType,
  isEntityInteraction,
  isStateUpdate,
  RoomType,
  StateUpdateType,
  UpdateStreamType,
} from "@/lib/types";
import { useSignal } from "@preact/signals-react";
import { on } from "events";
import { KeyboardEvent, useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge";

const activeTab = persistentSignal("activeTab", "inv");
const showInternals = persistentSignal("showInternals", false);

export default function Home() {
  useEffect(() => {
    model.checkLaunch();
  }, []);
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-800 text-white p-2 fixed w-full top-0 flex justify-between">
        <span className="">Intra</span>
        <span className="">prefs</span>
      </div>

      <div className="flex flex-1 pt-12 overflow-hidden">
        {" "}
        {/* Add pt-12 to push down the content below the fixed top bar */}
        <div className="w-2/3 flex flex-col p-4 bg-gray-900 text-white">
          {/* Scrollable log */}
          <ScrollOnUpdate
            className="flex-1 overflow-y-auto border-b border-gray-700 p-2"
            watch={model.session.value.updates}
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
      {model.session.value.updates.map((update, i) => (
        <ChatLogItem update={update} key={i} />
      ))}
    </div>
  );
}

function ChatLogItem({ update }: { update: UpdateStreamType }) {
  if (isStateUpdate(update)) {
    return <ChatLogStateUpdate update={update} />;
  } else if (isEntityInteraction(update)) {
    return <ChatLogEntityInteraction update={update} />;
  } else {
    return (
      <pre className="whitespace-pre-wrap text-red-400">
        Unknown update: {"\n"}
        {JSON.stringify(update, null, 2)}
      </pre>
    );
  }
}

function ChatLogStateUpdate({ update }: { update: StateUpdateType }) {
  if (!showInternals.value) {
    return null;
  }
  const lines = [`Update ${update.id}:`];
  for (const [key, value] of Object.entries(update.updates)) {
    lines.push(`  ${key}: ${JSON.stringify(value)}`);
  }
  return (
    <pre className="text-xs whitespace-pre-wrap text-purple-600">
      {lines.join("\n")}
    </pre>
  );
}

function ChatLogEntityInteraction({
  update,
}: {
  update: EntityInteractionType;
}) {
  const entity = model.entities[update.entityId];
  let children: React.ReactNode;
  if (showInternals.value) {
    children = (
      <div>
        {update.tags.map((tag, i) => (
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
    children = update.tags
      .map((tag, i) => {
        if (tag.type === "speak") {
          return (
            <pre className="pl-3 whitespace-pre-wrap -indent-2 mb-2" key={i}>
              &quot;{tag.content}&quot;
            </pre>
          );
        } else if (tag.type === "description") {
          return (
            <pre
              className="px-2 mb-2 mx-8 whitespace-pre-wrap text-sm border-x-4 border-gray-600 text-justify bg-gray-700"
              key={i}
            >
              {tag.content}
            </pre>
          );
        } else if (tag.type === "goTo") {
          const dest = model.rooms[tag.content.trim()];
          return (
            <div className="pl-4" key={i}>
              ==&gt; <span className={dest.color}>{dest.name}</span>
            </div>
          );
        }
        return null;
      })
      .filter((x) => x);
    if (!(children as React.ReactNode[]).length) {
      return null;
    }
  }
  return (
    <div className={entity.color}>
      {entity.id !== "entity:narrator" && (
        <div className={twMerge("font-bold")}>{entity.name}</div>
      )}
      {children}
    </div>
  );
}

function Input() {
  const running = useSignal(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    if (running.value) {
      return;
    }
    if (!textareaRef.current) {
      return;
    }
    const text = textareaRef.current.value;
    running.value = true;
    await model.sendText(text);
    textareaRef.current.value = "";
    running.value = false;
    setTimeout(() => {
      textareaRef.current!.focus();
    }, 0);
  }
  async function onUndo() {
    if (running.value) {
      return;
    }
    const lastInput = model.undo();
    if (lastInput) {
      textareaRef.current!.value = lastInput;
    }
  }
  return (
    <div className="flex mt-4">
      <textarea
        ref={textareaRef}
        rows={2}
        className={twMerge(
          "flex-1 resize-none bg-gray-800 text-white border-none p-2",
          running.value && "opacity-50"
        )}
        placeholder="ENTER COMMAND OR INSTRUCTIONS"
        disabled={running.value}
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
  return (
    <div className="flex-1 p-4 border-b border-gray-700 overflow-y-auto">
      <div>
        <span
          onClick={() => {
            activeTab.value = "inv";
          }}
          className={activeTab.value === "inv" ? activeClass : inactiveClass}
        >
          (i)nv
        </span>{" "}
        <span
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
        </span>{" "}
        {(showInternals.value || activeTab.value === "log" || true) && (
          <span
            onClick={() => {
              activeTab.value = "log";
            }}
            className={activeTab.value === "log" ? activeClass : inactiveClass}
          >
            (l)og
          </span>
        )}
      </div>
      <div>
        {activeTab.value === "inv" && <Inventory />}
        {activeTab.value === "access" && <AccessControl />}
        {activeTab.value === "blips" && <Blips />}
        {activeTab.value === "log" && <LlmLog />}
      </div>
    </div>
  );
}

function Inventory() {
  // This is *based* on updates, so I'm using this to keep it updated:
  const updates = model.session.value.updates;
  const player = model.entities["entity:player"];
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Inventory</div>
      {Object.values(player.inventory).map((item, i) => (
        <div key={i}>- {item}</div>
      ))}
      <div>- Key card</div>
    </div>
  );
}

function AccessControl() {
  const updates = model.session.value.updates;
  const player = model.entities["entity:player"];
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Access Control</div>
      {Object.entries(player.roomAccess).map(([roomId, access], i) => {
        const room = model.rooms[roomId];
        return <div key={i}>- {room.name}</div>;
      })}
    </div>
  );
}

function Blips() {
  const updates = model.session.value.updates;
  const player = model.entities["entity:player"];
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Blips</div>
      {Object.entries(player.blipAis).map(([entityId, info], i) => {
        const entity = model.entities[entityId];
        return <div key={i}>- {entity.name}</div>;
      })}
    </div>
  );
}

function Controls() {
  const SKIP_IDS = ["entity:narrator", "entity:player", "entity:ama"];
  const room = model.get(model.player.locationId) as RoomType;
  const folks = model
    .containedIn(model.player.locationId)
    .filter((x) => !SKIP_IDS.includes(x.id));
  async function onGoToRoom(room: RoomType, exit: ExitType) {
    if (!exit.restriction) {
      model.appendUpdate({
        type: "entityInteraction",
        entityId: "entity:player",
        tags: [{ type: "goTo", attrs: {}, content: room.id }],
        response: `<goTo>${room.id}</goTo>`,
      });
      model.goToRoom(exit.roomId);
      return;
    }
    await model.sendText(`Go to ${room.name}`);
  }
  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <CheckButton
        signal={showInternals}
        className="float-right"
        on="Internals Shown"
        off="Internals Hidden"
      />
      <div className="mb-2">Controls</div>
      <div className="border-b border-gray-400">
        Location: <strong className={room.color}>{room.name}</strong>
      </div>
      <div className="flex space-x-4">
        <div className="flex-1">
          Exits:
          <ul>
            {room.exits.map((exit, i) => {
              const targetRoom = model.rooms[exit.roomId];
              return (
                <li key={i}>
                  -{" "}
                  <button
                    className={twMerge("", targetRoom.color)}
                    onClick={() => {
                      onGoToRoom(targetRoom, exit);
                    }}
                  >
                    {exit.name || targetRoom.name}
                  </button>
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
                  - <span className={entity.color}>{entity.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
