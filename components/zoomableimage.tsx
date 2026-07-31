import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { twMerge } from "tailwind-merge";
import { ZoomOverlay } from "./zoom";

/**
 * A thumbnail image that opens a full-size shadowbox when clicked. Used for the
 * room scene viewport and the character avatars. Rendering stays pixelated so
 * the pixel-art images enlarge into crisp blocks rather than a blur.
 */
export function ZoomableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  useSignals();
  const zoomed = useSignal(false);
  return (
    <>
      {zoomed.value && (
        <ZoomOverlay onDone={() => (zoomed.value = false)}>
          {/* Sized in the viewport with object-contain so a small pixel-art
              image scales up to fill the shadowbox (keeping its aspect) rather
              than sitting tiny at its native size. */}
          <img
            src={src}
            alt={alt}
            className="object-contain"
            style={{
              imageRendering: "pixelated",
              width: "92vw",
              height: "88vh",
            }}
          />
        </ZoomOverlay>
      )}
      <img
        src={src}
        alt={alt}
        style={{ imageRendering: "pixelated" }}
        className={twMerge("cursor-zoom-in", className)}
        onClick={() => (zoomed.value = true)}
      />
    </>
  );
}
