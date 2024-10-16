const DIGIT_SEGMENTS = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

export function Clock({
  time,
  className,
  bg,
}: {
  time: string;
  className?: string;
  bg: string;
}) {
  return (
    <span className={className}>
      {Array.from(time).map((c, i) => {
        if (c === ":") {
          return <DigitalColon key={i} className="h-4 w-3 inline-block" />;
        } else if (c === "A" || c === "a") {
          return <DigitalAM key={i} className="h-4 w-3 inline-block" />;
        } else if (c === "P" || c === "p") {
          return <DigitalPM key={i} className="h-4 w-3 inline-block" />;
        } else if (c === "M" || c === "m" || c === " ") {
          return null;
        } else if ((DIGIT_SEGMENTS as any)[c]) {
          return (
            <Digit
              key={i}
              segments={(DIGIT_SEGMENTS as any)[c]}
              bg={bg}
              className="h-4 w-3 inline-block"
            />
          );
        } else {
          console.warn("Unknown digit", c);
          return null;
        }
      })}
    </span>
  );
}

function Digit({
  segments,
  bg,
  ...props
}: { segments: string; bg: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="-1 -1 12 20"
      stroke={bg}
      strokeWidth=".25"
      fill="currentColor"
      {...props}
    >
      {segments.includes("a") && (
        <polygon id="a" points="1, 1  2, 0  8, 0  9, 1  8, 2  2, 2" />
      )}
      {segments.includes("b") && (
        <polygon id="b" points="9, 1 10, 2 10, 8  9, 9  8, 8  8, 2" />
      )}
      {segments.includes("c") && (
        <polygon id="c" points="9, 9 10,10 10,16  9,17  8,16  8,10" />
      )}
      {segments.includes("d") && (
        <polygon id="d" points="9,17  8,18  2,18  1,17  2,16  8,16" />
      )}
      {segments.includes("e") && (
        <polygon id="e" points="1,17  0,16  0,10  1, 9  2,10  2,16" />
      )}
      {segments.includes("f") && (
        <polygon id="f" points="1, 9  0, 8  0, 2  1, 1  2, 2  2, 8" />
      )}
      {segments.includes("g") && (
        <polygon id="g" points="1, 9  2, 8  8, 8  9, 9  8,10  2,10" />
      )}
    </svg>
  );
}

function DigitalColon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-1 -1 12 20"
      strokeWidth="1"
      stroke="currentColor"
      fill="currentColor"
      {...props}
    >
      <circle cx="5" cy="5" r="0.75" />
      <circle cx="5" cy="13" r="0.75" />
    </svg>
  );
}

function DigitalAM({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-1 -1 12 20"
      strokeWidth=".25"
      stroke="currentColor"
      fill="currentColor"
      {...props}
    >
      <text
        x="5"
        y="7"
        fontSize="10"
        textAnchor="middle"
        fontFamily="Helvetica"
      >
        AM
      </text>
    </svg>
  );
}

function DigitalPM({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-1 -1 12 20"
      strokeWidth=".25"
      stroke="currentColor"
      fill="currentColor"
      {...props}
    >
      <text
        x="5"
        y="17"
        fontSize="10"
        textAnchor="middle"
        fontFamily="Helvetica"
      >
        PM
      </text>
    </svg>
  );
}
