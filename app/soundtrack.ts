import { effect } from "@preact/signals-react";
import { model } from "./model";
import { SoundtrackPlayer } from "./soundtrackplayer";

// Soundtrack playback is a pure view/browser concern, so it lives here rather
// than in the engine (lib/game/model.ts). This module owns the player and the
// effect that plays the current room's soundtrack whenever the story stream
// changes; importing it once (from the app UI) wires everything up.
export const soundtrackPlayer = new SoundtrackPlayer();

effect(() => {
  // Touch the update stream so this effect re-runs on every story change.
  void model.updates.value;
  setTimeout(() => {
    const currentRoom = model.world.getRoom(model.world.entities.PLAYER.inside);
    const url = currentRoom?.soundtrack?.url;
    soundtrackPlayer.playUrl(url ? convertSoundtrackUrl(url) : null);
  });
});

function convertSoundtrackUrl(url: string) {
  if (url.startsWith("http") || url.startsWith("/")) {
    return url;
  }
  return `https://assets.playintra.win/soundtrack/${url}`;
}
