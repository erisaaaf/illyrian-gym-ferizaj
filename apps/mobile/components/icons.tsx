import Svg, { Circle, Ellipse, Line, Path, Polyline, Rect } from "react-native-svg";
import { ColorValue } from "react-native";

// Lucide icons (ISC licence, https://lucide.dev), the same family the staff web app uses. The few paths the phone
// needs are inlined and drawn with react-native-svg, so the app does not ship the whole icon package.
type Node = [string, Record<string, string>];

const ICONS = {
  "Home": [
    [
      "path",
      {
        "d": "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
      }
    ],
    [
      "path",
      {
        "d": "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      }
    ]
  ],
  "QrCode": [
    [
      "rect",
      {
        "width": "5",
        "height": "5",
        "x": "3",
        "y": "3",
        "rx": "1"
      }
    ],
    [
      "rect",
      {
        "width": "5",
        "height": "5",
        "x": "16",
        "y": "3",
        "rx": "1"
      }
    ],
    [
      "rect",
      {
        "width": "5",
        "height": "5",
        "x": "3",
        "y": "16",
        "rx": "1"
      }
    ],
    [
      "path",
      {
        "d": "M21 16h-3a2 2 0 0 0-2 2v3"
      }
    ],
    [
      "path",
      {
        "d": "M21 21v.01"
      }
    ],
    [
      "path",
      {
        "d": "M12 7v3a2 2 0 0 1-2 2H7"
      }
    ],
    [
      "path",
      {
        "d": "M3 12h.01"
      }
    ],
    [
      "path",
      {
        "d": "M12 3h.01"
      }
    ],
    [
      "path",
      {
        "d": "M12 16v.01"
      }
    ],
    [
      "path",
      {
        "d": "M16 12h1"
      }
    ],
    [
      "path",
      {
        "d": "M21 12v.01"
      }
    ],
    [
      "path",
      {
        "d": "M12 21v-1"
      }
    ]
  ],
  "Contact": [
    [
      "path",
      {
        "d": "M16 2v2"
      }
    ],
    [
      "path",
      {
        "d": "M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"
      }
    ],
    [
      "path",
      {
        "d": "M8 2v2"
      }
    ],
    [
      "circle",
      {
        "cx": "12",
        "cy": "11",
        "r": "3"
      }
    ],
    [
      "rect",
      {
        "x": "3",
        "y": "4",
        "width": "18",
        "height": "18",
        "rx": "2"
      }
    ]
  ],
  "CalendarDays": [
    [
      "path",
      {
        "d": "M8 2v4"
      }
    ],
    [
      "path",
      {
        "d": "M16 2v4"
      }
    ],
    [
      "rect",
      {
        "width": "18",
        "height": "18",
        "x": "3",
        "y": "4",
        "rx": "2"
      }
    ],
    [
      "path",
      {
        "d": "M3 10h18"
      }
    ],
    [
      "path",
      {
        "d": "M8 14h.01"
      }
    ],
    [
      "path",
      {
        "d": "M12 14h.01"
      }
    ],
    [
      "path",
      {
        "d": "M16 14h.01"
      }
    ],
    [
      "path",
      {
        "d": "M8 18h.01"
      }
    ],
    [
      "path",
      {
        "d": "M12 18h.01"
      }
    ],
    [
      "path",
      {
        "d": "M16 18h.01"
      }
    ]
  ],
  "Flame": [
    [
      "path",
      {
        "d": "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
      }
    ]
  ],
  "TrendingUp": [
    [
      "polyline",
      {
        "points": "22 7 13.5 15.5 8.5 10.5 2 17"
      }
    ],
    [
      "polyline",
      {
        "points": "16 7 22 7 22 13"
      }
    ]
  ],
  "Bot": [
    [
      "path",
      {
        "d": "M12 8V4H8"
      }
    ],
    [
      "rect",
      {
        "width": "16",
        "height": "12",
        "x": "4",
        "y": "8",
        "rx": "2"
      }
    ],
    [
      "path",
      {
        "d": "M2 14h2"
      }
    ],
    [
      "path",
      {
        "d": "M20 14h2"
      }
    ],
    [
      "path",
      {
        "d": "M15 13v2"
      }
    ],
    [
      "path",
      {
        "d": "M9 13v2"
      }
    ]
  ],
  "User": [
    [
      "path",
      {
        "d": "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
      }
    ],
    [
      "circle",
      {
        "cx": "12",
        "cy": "7",
        "r": "4"
      }
    ]
  ]
} as const satisfies Record<string, ReadonlyArray<Node | readonly [string, Record<string, string>]>>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color, strokeWidth = 2 }: { name: IconName; size?: number; color: ColorValue; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color as string} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {(ICONS[name] as ReadonlyArray<readonly [string, Record<string, string>]>).map(([tag, p], i) => {
        if (tag === "path") return <Path key={i} d={p.d} />;
        if (tag === "rect") return <Rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} />;
        if (tag === "circle") return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} />;
        if (tag === "ellipse") return <Ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} />;
        if (tag === "line") return <Line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />;
        if (tag === "polyline") return <Polyline key={i} points={p.points} />;
        return null;
      })}
    </Svg>
  );
}
