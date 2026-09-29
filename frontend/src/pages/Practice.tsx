import { useState } from "react";
import Listen from "../components/Listen";
import Scramble from "../components/Scramble";
import Speak from "../components/Speak";
import Spell from "../components/Spell";

const TABS = [
  { key: "listen", name: "听音辨词", en: "LISTEN" },
  { key: "spell", name: "拼写默写", en: "WRITE" },
  { key: "scramble", name: "句子重组", en: "READ" },
  { key: "speak", name: "跟读评分", en: "SPEAK" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Practice() {
  const [tab, setTab] = useState<TabKey>("listen");

  return (
    <>
      <div className="page-head">
        <h2 className="page-title">专项练习</h2>
        <span className="page-note">四种模式对应听说读写，做错的题会进入复习队列</span>
      </div>
      <div className="card">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={"tab" + (tab === t.key ? " on" : "")}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.name}
              <span className="en">{t.en}</span>
            </button>
          ))}
        </div>
        <div className="pane">
          {tab === "listen" && <Listen key={"listen"} />}
          {tab === "spell" && <Spell key={"spell"} />}
          {tab === "scramble" && <Scramble key={"scramble"} />}
          {tab === "speak" && <Speak key={"speak"} />}
        </div>
      </div>
    </>
  );
}
