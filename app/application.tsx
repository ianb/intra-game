import LlmLog from "@/components/llmlog";
import { model } from "@/lib/model";
import { persistentSignal } from "@/lib/persistentsignal";
import { useSignal } from "@preact/signals-react";
import { KeyboardEvent } from "react";

const activeTab = persistentSignal("activeTab", "inv");

export default function Home() {
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-800 text-white p-2 fixed w-full top-0 flex justify-between">
        <span className="">Intra</span>
        <span className="">prefs</span>
      </div>

      <div className="flex flex-1 pt-12">
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
        <div className="w-1/3 flex flex-col bg-gray-800 text-white">
          <HeadsUpDisplay />
          <Controls />
        </div>
      </div>
    </div>
  );
}

function ChatLog() {
  return <div className="">[Chat Log will go here]</div>;
}

function Input() {
  async function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      console.log("Enter key pressed");
      const text = (event.target as HTMLTextAreaElement).value;
      await model.sendText(text);
      (event.target as HTMLTextAreaElement).value = "";
    }
  }
  return (
    <div className="flex mt-4">
      <textarea
        rows={2}
        className="flex-1 resize-none bg-gray-800 text-white border-none p-2"
        placeholder="Type your message..."
        onKeyDown={onKeyDown}
      />
      <div className="flex flex-col ml-2">
        <button className="bg-green-600 text-white p-2 mb-2">Send</button>
        <button className="bg-red-600 text-white p-2">Undo</button>
      </div>
    </div>
  );
}

function HeadsUpDisplay() {
  const activeClass = "text-black bg-gray-100 cursor-pointer";
  const inactiveClass = "cursor-pointer";
  return (
    <div className="flex-1 p-4 border-b border-gray-700 h-1/2">
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
        <span
          onClick={() => {
            activeTab.value = "log";
          }}
          className={activeTab.value === "log" ? activeClass : inactiveClass}
        >
          (l)og
        </span>
      </div>
      {activeTab.value === "inv" && <Inventory />}
      {activeTab.value === "access" && <AccessControl />}
      {activeTab.value === "blips" && <Blips />}
      {activeTab.value === "log" && <LlmLog />}
    </div>
  );
}

function Inventory() {
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Inventory</div>
      <ul className="space-y-2">
        <li>1. Item 1</li>
        <li>2. Item 2</li>
        <li>3. Item 3</li>
      </ul>
    </div>
  );
}

function AccessControl() {
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Access Control</div>
      <ul className="space-y-2">
        <li>1. Code XYZ</li>
        <li>2. Code ABC</li>
        <li>3. Code 123</li>
      </ul>
    </div>
  );
}

function Blips() {
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Blips</div>
      <ul className="space-y-2">
        <li>1. Helpertron</li>
        <li>2. Fitz</li>
      </ul>
    </div>
  );
}

function Controls() {
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Controls</div>
      <ul className="space-y-2">
        <li className="cursor-pointer">1. Item 1</li>
        <li className="cursor-pointer">2. Item 2</li>
        <li className="cursor-pointer">3. Item 3</li>
      </ul>
    </div>
  );
}
