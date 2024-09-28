"use client";
import dynamic from "next/dynamic";

const HomeApp = dynamic(() => import("./application"), {
  ssr: false,
});

export default HomeApp;
