import { tmpl } from "../template";
import { CommandType } from "../types";

export const commands: CommandType[] = [
  {
    id: "setName",
    example: tmpl`
    Used to set the player's name during the introduction
    phase, like:

    <setName>Alice</setName>
    `,
  },
];
