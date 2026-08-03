import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import type React from "react";
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
  caption,
}: {
  src: string;
  alt: string;
  className?: string;
  /**
   * Rendered under the zoomed image, inside the shadowbox — the character
   * card with its meters. Clicks on it don't close the overlay.
   */
  caption?: React.ReactNode;
}) {
  useSignals();
  const zoomed = useSignal(false);
  return (
    <>
      {zoomed.value && (
        <ZoomOverlay onDone={() => (zoomed.value = false)}>
          {/* Sized in the viewport with object-contain so a small pixel-art
              image scales up to fill the shadowbox (keeping its aspect) rather
              than sitting tiny at its native size. The image element covers most
              of the screen, so clicking it also closes — otherwise only the thin
              margins outside it would, since the overlay stops content clicks. */}
          <div className="flex flex-col items-center gap-3">
            <img
              src={src}
              alt={alt}
              className="cursor-zoom-out object-contain"
              style={{
                imageRendering: "pixelated",
                width: "92vw",
                height: caption ? "72vh" : "88vh",
              }}
              onClick={() => (zoomed.value = false)}
            />
            {caption}
          </div>
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
