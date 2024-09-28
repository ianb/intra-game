import { Button, CheckButton } from "@/components/input";
import LlmLog from "@/components/llmlog";
import { model } from "@/lib/model";
import { persistentSignal } from "@/lib/persistentsignal";
import { isEntityInteraction, isStateUpdate } from "@/lib/types";
import { useSignal } from "@preact/signals-react";
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
          <div className="flex-1 overflow-y-auto border-b border-gray-700 p-2">
            <ChatLog />
          </div>
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
  const internals = showInternals.value;
  return (
    <div>
      {model.session.value.updates.map((update, i) => {
        if (isStateUpdate(update)) {
          if (!internals) {
            return null;
          }
          const lines = [`Update ${update.id}:`];
          for (const [key, value] of Object.entries(update.updates)) {
            lines.push(`  ${key}: ${JSON.stringify(value)}`);
          }
          return (
            <pre
              className="text-xs whitespace-pre-wrap text-purple-600"
              key={i}
            >
              {lines.join("\n")}
            </pre>
          );
        } else if (isEntityInteraction(update)) {
          const entity = model.entities[update.entityId];
          return (
            <div className="text-green-500" key={i}>
              <div className={twMerge("font-bold", entity.color)}>
                {entity.name}
              </div>
              {internals ? (
                <pre className="pl-1 whitespace-pre-wrap">
                  {update.response}
                </pre>
              ) : (
                update.tags.map((tag, i) => {
                  if (tag.type === "speak") {
                    return (
                      <pre
                        className="pl-3 whitespace-pre-wrap -indent-2"
                        key={i}
                      >
                        &quot;{tag.content}&quot;
                      </pre>
                    );
                  } else if (tag.type === "description") {
                    return (
                      <pre
                        className="pl-2 ml-2 whitespace-pre-wrap border-l-2 border-green-500"
                        key={i}
                      >
                        {tag.content}
                      </pre>
                    );
                  }
                  return null;
                })
              )}
            </div>
          );
        } else {
          return (
            <pre className="whitespace-pre-wrap text-red-400" key={i}>
              Unknown update: {"\n"}
              {JSON.stringify(update, null, 2)}
            </pre>
          );
        }
      })}
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
    if (!textareaRef.current) {
      return;
    }
    const text = textareaRef.current.value;
    running.value = true;
    await model.sendText(text);
    textareaRef.current.value = "";
    running.value = false;
  }
  async function onUndo() {
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
        className="flex-1 resize-none bg-gray-800 text-white border-none p-2"
        placeholder="Type your message..."
        onKeyDown={onKeyDown}
      />
      <div className="flex flex-col ml-2">
        <Button className="bg-green-600" onClick={onSubmit}>
          Send
        </Button>
        <Button className="bg-yellow-500" onClick={onUndo}>
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
        {(showInternals.value || activeTab.value === "log") && (
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
  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="mb-2">Controls</div>
      <CheckButton
        signal={showInternals}
        on="Internals Shown"
        off="Internals Hidden"
      />
      <ul className="space-y-2">
        <li className="cursor-pointer">1. Item 1</li>
        <li className="cursor-pointer">2. Item 2</li>
        <li className="cursor-pointer">3. Item 3</li>
      </ul>
    </div>
  );
}
