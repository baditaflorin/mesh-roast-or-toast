/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import {
  ConfettiLayer,
  createClockSync,
  Leaderboard,
  useConfetti,
  useDeadline,
  useFairRng,
  useFlashOnChange,
  useNamedPeer,
  usePhase,
  useRotatingTurn,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
const SLOT_MS = 30_000;

export function Feature({ room, config }: Props) {
  if (!room)
    return (
      <div className="roast-screen">
        <h1>roast or toast</h1>
        <p>Connecting…</p>
      </div>
    );
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf, myName } = useNamedPeer(config, room);
  const clock = useMemo(() => createClockSync(room.provider), [room]);
  useEffect(() => () => clock.destroy(), [clock]);

  useFairRng(room, "roast-salts");
  const phase = usePhase<"lobby" | "hot-seat" | "done">(room, "phase", "lobby");
  const turn = useRotatingTurn(room, clock, { slotMs: SLOT_MS, order: "shuffle" });
  const state = room.doc.getMap<number>("state");
  const baselineSlot = state.get("baselineSlot") ?? 0;
  const roundN = phase.phase === "lobby" ? 0 : Math.max(0, turn.slotId - baselineSlot);

  // tally: Y.Map<`${round}|${peerId}|${'fire'|'rose'}`, count>
  const tally = room.doc.getMap<number>("tally");
  const [, rerender] = useState(0);
  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    tally.observe(cb);
    return () => tally.unobserve(cb);
  }, [tally]);
  const tallyOf = (r: number, p: string, k: "fire" | "rose") => tally.get(`${r}|${p}|${k}`) ?? 0;

  const cumulative: Record<string, { fire: number; rose: number }> = {};
  tally.forEach((count, key) => {
    const [, peer, kind] = key.split("|");
    if (peer && (kind === "fire" || kind === "rose")) {
      const s = (cumulative[peer] ??= { fire: 0, rose: 0 });
      s[kind] += count;
    }
  });
  const deadline = useDeadline(phase.phase === "hot-seat" ? Date.now() + turn.msToNextTurn : null);

  const hotSeatId = turn.currentPeerId;
  const hotSeatName = hotSeatId ? (nameOf(hotSeatId) ?? `peer-${hotSeatId.slice(0, 4)}`) : "—";
  const fire = hotSeatId ? tallyOf(roundN, hotSeatId, "fire") : 0;
  const rose = hotSeatId ? tallyOf(roundN, hotSeatId, "rose") : 0;
  const total = fire + rose;
  const firePct = total > 0 ? Math.round((fire / total) * 100) : 0;
  const iAmHotSeat = hotSeatId === room.peerId;
  const canTap = phase.phase === "hot-seat" && !iAmHotSeat && !!hotSeatId;

  useFlashOnChange(`${roundN}:${hotSeatId}`);
  const { burst } = useConfetti();
  useEffect(() => {
    if (phase.phase === "hot-seat" && roundN > 0)
      burst({ origin: "top", count: 60, hueRange: [330, 360] });
  }, [roundN]);

  const start = () => {
    room.doc.transact(() => state.set("baselineSlot", turn.slotId));
    phase.transition("hot-seat", { from: "lobby" });
  };
  const tap = (kind: "fire" | "rose") => {
    if (!canTap || !hotSeatId) return;
    const k = `${roundN}|${hotSeatId}|${kind}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  };
  const board = Object.entries(cumulative)
    .map(([id, c]) => ({
      id,
      name: nameOf(id) ?? `peer-${id.slice(0, 4)}`,
      score: c.fire,
      sub: `${c.fire}🔥 / ${c.rose}🌹`,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="roast-screen">
      <ConfettiLayer />
      <header className="roast-header">
        <h1>roast or toast</h1>
        <p className="roast-status">
          {room.peerCount + 1} peers · round {roundN + 1} · {phase.phase}
        </p>
      </header>
      <input
        className="roast-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        aria-label="your name"
        maxLength={32}
      />
      {phase.phase === "lobby" && (
        <button
          type="button"
          className="roast-start"
          onClick={start}
          aria-label="start"
          disabled={!name.trim()}
        >
          start
        </button>
      )}
      {phase.phase === "hot-seat" && (
        <div className="roast-current">
          <span className="roast-current-name">{hotSeatName}</span>
          <span className="roast-current-sub">
            in the hot seat — {deadline.fmt || "—"} left{iAmHotSeat && " (you!)"}
          </span>
        </div>
      )}
      <div className="roast-tap-row">
        <button
          type="button"
          className="roast-fire"
          onClick={() => tap("fire")}
          aria-label="ROAST"
          disabled={!canTap}
        >
          ROAST 🔥
        </button>
        <button
          type="button"
          className="roast-rose"
          onClick={() => tap("rose")}
          aria-label="TOAST"
          disabled={!canTap}
        >
          TOAST 🌹
        </button>
      </div>
      <div className="roast-ratio" data-fire={fire} data-rose={rose}>
        <div className="roast-ratio-fire" style={{ width: `${firePct}%` }} />
        <div className="roast-ratio-rose" style={{ width: `${100 - firePct}%` }} />
        <span className="roast-ratio-label">
          {fire} 🔥 · {rose} 🌹
        </span>
      </div>
      {total > 0 && (
        <p className="roast-chip">
          {hotSeatName} at {firePct}% roast
        </p>
      )}
      <Leaderboard
        items={board}
        highlightId={room.peerId}
        title="most roasted"
        emptyText="no taps yet"
      />
      <p className="roast-myname" aria-hidden="true">
        you are {myName}
      </p>
    </div>
  );
}
