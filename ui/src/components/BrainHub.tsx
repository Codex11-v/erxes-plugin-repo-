import { Link } from "react-router";
import {
  IconArrowDownRight as ArrowDownRight,
  IconArrowUpRight as ArrowUpRight,
  IconMicrophone as AudioLines,
  IconBook as BookOpen,
  IconScan as ScanLine,
} from "@tabler/icons-react";
import { useState } from "react";

// Stable SVG attributes across server and browser math implementations.
const coordinate = (value: number) => Number(value.toFixed(3));
const rays = Array.from({ length: 88 }, (_, i) => {
  const angle = (i * Math.PI * 2) / 88;
  const inner = 177 + (i % 4 === 0 ? 4 : 0);
  const outer = i % 11 === 0 ? 340 : i % 3 === 0 ? 315 : 280 + (i % 4) * 9;
  return {
    x1: coordinate(400 + Math.cos(angle) * inner),
    y1: coordinate(346 + Math.sin(angle) * inner),
    x2: coordinate(400 + Math.cos(angle) * outer),
    y2: coordinate(346 + Math.sin(angle) * outer),
    dot: i % 7 === 0,
  };
});
const folds = [
  "M152 46C130 34 116 47 122 67C104 58 86 69 91 87C72 82 61 95 68 111C49 114 47 135 62 143",
  "M147 68C126 71 130 89 117 98C107 105 94 100 87 113C80 125 90 136 80 145",
  "M142 93C155 107 143 120 130 119C115 117 107 132 117 144C123 151 118 164 104 165",
  "M61 153C78 146 93 157 91 171C89 186 72 186 71 200",
  "M143 143C154 150 144 169 131 168C116 168 113 181 122 191C131 203 117 220 103 210",
  "M82 211C89 224 100 229 114 224C128 219 139 232 145 241",
  "M70 128C78 132 78 142 73 149",
  "M107 53C96 55 98 67 100 74",
  "M52 164C42 173 49 190 62 191",
  "M129 39C139 47 135 57 145 61",
  "M78 79C93 75 101 84 98 97",
  "M49 119C59 123 70 116 73 105",
  "M97 138C101 148 96 155 102 165",
  "M54 179C67 173 78 183 82 193",
  "M138 182C146 190 140 203 146 214",
  "M110 202C101 199 95 203 93 213",
  "M112 81C120 85 117 95 124 102",
];
export function BrainArtwork() {
  return (
    <svg viewBox="0 0 320 280" fill="none" aria-hidden="true" className="edusmart:brain-artwork">
      <defs>
        <radialGradient id="brain-ember" cx=".23" cy=".55" r=".9">
          <stop stopColor="#ffc575" />
          <stop offset=".35" stopColor="#f46a2f" />
          <stop offset=".68" stopColor="#79351e" />
          <stop offset="1" stopColor="#242a27" />
        </radialGradient>
        <filter id="brain-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#402517" floodOpacity=".18" />
        </filter>
        <filter id="neuron-glow">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <g filter="url(#brain-shadow)">
        <path
          d="M145 213C149 228 143 239 144 249C148 257 172 257 177 249C176 238 171 227 176 213Z"
          fill="#8d492c"
          stroke="#e89855"
          strokeWidth="1"
        />
        {[false, true].map((right) => (
          <g key={String(right)} transform={right ? "translate(320 0) scale(-1 1)" : undefined}>
            <path
              d="M158 36C147 18 128 23 119 33C99 25 81 40 82 55C60 54 47 72 51 90C31 98 28 118 38 131C22 148 26 170 39 179C33 199 44 215 61 219C63 239 83 250 100 242C119 254 145 247 155 231C161 209 158 187 159 166L158 36Z"
              fill="url(#brain-ember)"
              stroke="#7c3b25"
              strokeWidth="1.5"
            />
            <path
              d="M151 38C137 24 120 35 120 46M81 62C59 69 59 91 66 96M39 139C32 156 43 167 48 169M44 193C41 209 58 219 70 216M75 235C89 245 102 231 103 226"
              stroke="#ffd599"
              strokeWidth="2"
              strokeLinecap="round"
              opacity=".9"
            />
            {folds.map((d, i) => (
              <path
                key={i}
                d={d}
                stroke="#f3c596"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity={i % 3 === 0 ? 0.85 : 0.5}
              />
            ))}
            <path
              d="M134 48C149 81 119 101 130 127C146 159 118 174 135 203"
              stroke="#ffc889"
              strokeWidth="4"
              filter="url(#neuron-glow)"
              opacity=".5"
            />
          </g>
        ))}
        <path d="M160 37V233" stroke="#ddd2ba" strokeWidth="1" opacity=".65" />
      </g>
    </svg>
  );
}
export function BrainHub() {
  const [active, setActive] = useState<string | null>(null);
  const actions = [
    {
      to: "/edusmart/voice",
      key: "voice",
      name: "Voice → Report",
      caption: "Turn voice notes into a clear report.",
      kind: "VOICE NOTES",
      detail: "Recording → Transcript → Reviewed report",
      number: "01",
      icon: AudioLines,
    },
    {
      to: "/edusmart/lessons",
      key: "lessons",
      name: "Lesson & Slides",
      caption: "Turn a topic into a lesson plan and slides.",
      kind: "LESSON PLANNING",
      detail: "Topic → AI lesson plan → Slides",
      number: "02",
      icon: BookOpen,
    },
    {
      to: "/edusmart/ocr",
      key: "ocr",
      name: "Image → Excel",
      caption: "Convert a paper class journal into an editable table.",
      kind: "IMAGE RECOGNITION",
      detail: "Image → Editable table → Excel",
      number: "03",
      icon: ScanLine,
    },
  ] as const;
  const selected = actions.find((action) => action.key === active);
  return (
    <section
      className={`edusmart:brain-hub ${active ? `edusmart:hub-active-${active}` : ""}`}
      aria-labelledby="brain-hub-title"
    >
      <header className="edusmart:hub-heading">
        <span className="edusmart:hub-kicker">
          <i />
          YOUR EVERYDAY AI ASSISTANT
        </span>
        <h1 id="brain-hub-title">
          Your ideas.
          <br />
          <span>More possibilities.</span>
        </h1>
        <p>
          Spend less time on paperwork,
          <br />
          and more time teaching.
        </p>
        <span className="edusmart:hub-edition">
          SUPPORTS CREATIVE THINKING
          <br />
          AI WITH TEACHER REVIEW
        </span>
      </header>
      <div className="edusmart:hub-stage">
        <svg viewBox="0 0 800 730" className="edusmart:hub-radial" aria-hidden="true">
          <defs>
            <marker
              id="ray-tip"
              viewBox="0 0 5 5"
              refX="4"
              refY="2.5"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <path d="M0 0L5 2.5L0 5Z" fill="currentColor" />
            </marker>
          </defs>
          <circle className="edusmart:hub-disc" cx="400" cy="346" r="170" />
          <g className="edusmart:hub-rays">
            {rays.map((r, i) => (
              <g key={i}>
                <line
                  x1={r.x1}
                  y1={r.y1}
                  x2={r.x2}
                  y2={r.y2}
                  markerEnd={i % 3 === 0 ? "url(#ray-tip)" : undefined}
                />
                {r.dot && <circle cx={r.x1} cy={r.y1} r="2" />}
              </g>
            ))}
          </g>
          <g className="edusmart:hub-connectors">
            <path className="edusmart:connector-voice" d="M0 346H230" />
            <path className="edusmart:connector-ocr" d="M570 346H800" />
            <path className="edusmart:connector-lessons" d="M400 516V580" />
            <circle cx="6" cy="346" r="5" />
            <circle cx="794" cy="346" r="5" />
            <circle cx="400" cy="580" r="5" />
          </g>
          <circle className="edusmart:hub-orbit-track" cx="400" cy="346" r="201" />
          <path className="edusmart:hub-orbit-accent" d="M400 145A201 201 0 0 1 601 346" />
          <circle className="edusmart:hub-orbit-satellite" cx="400" cy="145" r="4" />
        </svg>
        <div className="edusmart:hub-brain">
          <span className="edusmart:hub-brain-halo" />
          <BrainArtwork />
          <span className="edusmart:hub-core-label">
            <i />
            {selected ? selected.kind : "YOUR AI HUB"}
          </span>
          <span className="edusmart:hub-brain-caption">
            {selected ? "Select a tool to get started" : "Turn ideas into action"}
          </span>
        </div>
        {actions.map((action) => (
          <Link
            key={action.key}
            to={action.to}
            className={`edusmart:hub-action edusmart:hub-action-${action.key}`}
            onPointerDown={() => setActive(action.key)}
            onMouseEnter={() => setActive(action.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(action.key)}
            onBlur={() => setActive(null)}
            aria-label={`${action.name} — ${action.caption}`}
          >
            <span className="edusmart:hub-action-top">
              <span className="edusmart:hub-action-index">
                {action.number} <i /> {action.kind}
              </span>
              <ArrowUpRight className="edusmart:hub-action-arrow" size={19} />
            </span>
            <div className="edusmart:hub-action-title">
              <span className="edusmart:hub-action-icon">
                <action.icon size={23} strokeWidth={1.4} />
              </span>
              <strong
                style={{ viewTransitionName: active === action.key ? "compass-feature" : "none" }}
              >
                {action.name}
              </strong>
            </div>
            <span className="edusmart:hub-action-caption">{action.caption}</span>
            <span className="edusmart:hub-action-open">
              Open tool <ArrowUpRight size={13} />
            </span>
          </Link>
        ))}
        <span className="edusmart:hub-coordinate edusmart:coord-left">
          IDEAS · CRAFT · POSSIBILITY
        </span>
        <span className="edusmart:hub-coordinate edusmart:coord-right">THOUGHTFUL AI</span>
      </div>
      <footer className="edusmart:hub-footer">
        <p>
          <span>Three tools.</span> More time to teach.
        </p>
        <span className="edusmart:hub-footer-note">
          <ArrowDownRight size={17} />
          {selected ? selected.detail : "Your next step starts here"}
        </span>
        <span className="edusmart:hub-footer-mark">AI / TEACHER REVIEW</span>
      </footer>
    </section>
  );
}
