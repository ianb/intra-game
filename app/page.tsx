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
        {/* Left side (Chat interface) */}
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
  return (
    <div className="flex mt-4">
      <textarea
        rows={2}
        className="flex-1 resize-none bg-gray-800 text-white border-none p-2"
        placeholder="Type your message..."
      />
      <div className="flex flex-col ml-2">
        <button className="bg-green-600 text-white p-2 mb-2">Send</button>
        <button className="bg-red-600 text-white p-2">Undo</button>
      </div>
    </div>
  );
}

function HeadsUpDisplay() {
  return (
    <div className="flex-1 p-4 border-b border-gray-700">
      <ul className="space-y-2">
        <li className="cursor-pointer">Inventory</li>
        <li className="cursor-pointer">Access Control</li>
        <li className="cursor-pointer">Blip AIs</li>
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
