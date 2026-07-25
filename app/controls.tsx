/**
 * The button panel beside the transcript: moving between rooms, and the
 * save/load menus.
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
import {
  listSavedGames,
  loadGame,
  proposeSaveTitle,
  removeSavedGame,
  saveGame,
  type SaveListType,
} from "./saves";
import { A, Button, CheckButton } from "@/components/input";
import { Entity, Exit, Person, Room } from "@/lib/game/classes";
import { effect, signal, useSignal } from "@preact/signals-react";
import { initSession, playTurn } from "./session";
import { model } from "./model";
import { composer, showInternals } from "./uistate";
import { twMerge } from "tailwind-merge";
import { useSignals } from "@preact/signals-react/runtime";

export function Controls() {
  useSignals();
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
  useSignals();
  const room = model.world.entityRoom("PLAYER")!;
  // FIXME: actually collect the people:
  const folks: Person[] = model.world
    .entitiesInRoom(room)
    .filter((x) => isPerson(x))
    .filter((x) => !x.invisible && x.id !== "PLAYER");
  function onConverse(entity: Person) {
    if (!composer.ref?.current) {
      return;
    }
    if (composer.ref!.current.value.includes(`${entity.name}:`)) {
      composer.ref!.current.focus();
      return;
    }
    if (composer.ref!.current.value) {
      composer.ref!.current.value += "\n";
    }
    composer.ref!.current.value += `${entity.name}: `;
    composer.ref!.current.focus();
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
                        entity.color,
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
  useSignals();
  function checkText(cond: boolean) {
    return cond ? "[x]" : "[ ]";
  }
  function extraCheck(cond: boolean) {
    return cond ? " ✓" : "";
  }
  // Dependency thing...
  const _u = model.updates.value;
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
  useSignals();
  async function onGoToRoom(room: Room, exit: Exit) {
    if (model.runningSignal.value) {
      return;
    }
    await playTurn(`Go to ${room.name}`);
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
                  targetRoom.color,
                )}
                onClick={() => {
                  return onGoToRoom(targetRoom, exit);
                }}
                disabled={model.runningSignal.value}
              >
                {exit.name || targetRoom.name}
                {exit.restriction ? "*" : ""}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SaveControls({ onDone }: { onDone: () => void }) {
  useSignals();
  const proposedTitle = useSignal("");
  useEffect(() => {
    Promise.resolve(proposeSaveTitle()).then((title) => {
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
          saveGame(proposedTitle.value);
          onDone();
        }}
      >
        Save
      </Button>
    </div>
  );
}

function LoadControls({ onDone }: { onDone: () => void }) {
  useSignals();
  const saves = useSignal<SaveListType[]>([]);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function refresh() {
    Promise.resolve(listSavedGames()).then((loadedSaves) => {
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
                  loadGame(save.slug);
                  onDone();
                }}
              >
                {save.title} ({save.date})
              </Button>
              <Button
                className="text-xs bg-red-800 text-white hover:bg-red-600"
                onClick={async () => {
                  removeSavedGame(save.slug);
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
