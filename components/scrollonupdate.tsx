import React, { useRef, useEffect } from "react";
import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";

type ScrollOnUpdateProps = {
  children: React.ReactNode;
  watch: any;
  // Must be a better way, but a list will change every time...
  watch2?: any;
  watch3?: any;
} & React.HTMLProps<HTMLDivElement>;

export default function ScrollOnUpdate({
  children,
  watch,
  watch2,
  watch3,
  ...props
}: ScrollOnUpdateProps) {
  useSignals();
  const firstScroll = useSignal(true);
  const ref = useRef<HTMLDivElement>(null);
  function scrollDown() {
    if (ref.current) {
      if (firstScroll.value) {
        firstScroll.value = false;
        ref.current.scrollTop = ref.current.scrollHeight;
      } else {
        ref.current.scrollTo({
          top: ref.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }
  // useEffect(() => {
  //   if (ref.current) {
  //     ref.current.scrollTop = ref.current.scrollHeight;
  //   }
  // }, [ref.current]);
  useEffect(() => {
    if (ref.current) {
      scrollDown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, watch2, watch3, ref.current]);
  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
