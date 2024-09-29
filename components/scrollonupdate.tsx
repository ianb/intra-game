import React, { useRef, useEffect } from "react";
import { useSignal } from "@preact/signals-react";

type ScrollOnUpdateProps = {
  children: React.ReactNode;
  watch: any;
} & React.HTMLProps<HTMLDivElement>;

export default function ScrollOnUpdate({
  children,
  watch,
  ...props
}: ScrollOnUpdateProps) {
  const firstScroll = useSignal(true);
  const ref = useRef<HTMLDivElement>(null);
  console.log("watch on", firstScroll.value, ref.current, watch);
  function scrollDown() {
    if (ref.current) {
      if (firstScroll.value) {
        firstScroll.value = false;
        ref.current.scrollTop = ref.current.scrollHeight;
        console.log(
          "set scrolltop to",
          ref.current.scrollTop,
          ref.current.scrollHeight
        );
      } else {
        ref.current.scrollTo({
          top: ref.current.scrollHeight,
          behavior: "smooth",
        });
        console.log("smooth scroll down", ref.current.scrollHeight);
      }
    }
  }
  // useEffect(() => {
  //   if (ref.current) {
  //     ref.current.scrollTop = ref.current.scrollHeight;
  //   }
  // }, [ref.current]);
  useEffect(() => {
    console.log("scroll hit", ref.current);
    if (ref.current) {
      scrollDown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, ref.current]);
  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
