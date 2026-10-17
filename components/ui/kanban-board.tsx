"use client";

import * as React from "react";
import { AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  CircleDot,
  FileText,
  Flag,
  GitPullRequest,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  MoreHorizontal,
  Palette,
  Plus,
  Server,
  Smartphone,
} from "lucide-react";

/* ==========================================================================
   KanbanBoard

   A horizontally scrolling board of columns you can drag cards between.

   The drag is built on raw pointer events rather than a drag-and-drop
   library, so the whole gesture is ours to shape: the card lifts out of the
   list into an overlay that tracks the cursor, the gap it left collapses,
   a gap springs open wherever it would land, and every other card slides
   into its new place instead of jumping there.

   The insert position is worked out in a coordinate space that pretends the
   placeholder is not there. Without that the placeholder pushes cards past
   the pointer, which flips the decision back, which moves the placeholder,
   which flips it again. The card would sit and flicker between two slots.

   Everything also works from the keyboard: focus a card, press space to pick
   it up, move it with the arrow keys, space again to drop, escape to put it
   back. Each move is announced to screen readers.

   With `readOnly`, dragging and the column actions are switched off and a
   card with an `href` becomes a plain link — the mode for boards that mirror
   an external source of truth.

   Colours come from the global palette tokens (`primary`, `secondary`,
   `foreground`, `background`) so the board follows the app theme.
   ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** iOS style continuous corners, degrading to a plain radius. */
const SQUIRCLE = "[corner-shape:squircle]";

/** Inherit the app typeface (Geist via `--font-sans`), with a system fallback. */
const FONT_STACK = 'var(--font-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/** One chip. Fixed height and no line box, so the icon and label sit dead centre. */
const CHIP =
  "inline-flex h-[22px] items-center gap-1 rounded-[7px] px-2 text-[11px] leading-none";

/** Vertical space between cards, in px. Needed in maths, not just in CSS. */
const GAP = 8;

const LIFT_SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;
const FLOW_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;

export type Priority = "urgent" | "high" | "normal" | "low";

const PRIORITY_STYLES: Record<Priority, string> = {
  urgent: "bg-primary text-white dark:bg-foreground dark:text-background",
  high: "bg-primary/10 text-primary dark:bg-foreground/15 dark:text-foreground",
  normal: "bg-secondary/10 text-secondary dark:bg-foreground/10 dark:text-foreground/80",
  low: "bg-foreground/5 text-foreground/55 dark:bg-foreground/[0.07]",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

/** Accent used by a column's status dot. */
export type Accent = "muted" | "soft" | "secondary" | "primary";

const ACCENT_DOT: Record<Accent, string> = {
  muted: "bg-foreground/30",
  soft: "bg-secondary/50 dark:bg-foreground/50",
  secondary: "bg-secondary dark:bg-foreground/75",
  primary: "bg-primary dark:bg-foreground",
};

export interface KanbanAssignee {
  name: string;
  /** Portrait URL. Falls back to initials on a tint picked from the name. */
  avatar?: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  /** One supporting line under the title. */
  note?: string;
  priority?: Priority;
  /** Short label with an icon, e.g. "Web app". */
  category?: string;
  /** Icon key, or your own node. */
  icon?: IconKey | React.ReactNode;
  assignees?: KanbanAssignee[];
  /** Free text, e.g. "25 Apr" or "Tomorrow". */
  due?: string;
  /** Emphasises the due date. Use it for today, tomorrow and overdue. */
  dueSoon?: boolean;
  /** 0 to 100. Drawn as a ring next to the date. */
  progress?: number;
  /** Where the card leads. Only followed in `readOnly` mode. */
  href?: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  accent?: Accent;
  tasks: KanbanTask[];
}

export interface KanbanBoardProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag" | "onChange"
  > {
  columns: KanbanColumn[];
  /** Fires after every move with the whole board. */
  onChange?: (columns: KanbanColumn[]) => void;
  /** Accessible name for the scrolling region. */
  label?: string;
  /** Disables moving cards and the column actions; cards with `href` become links. */
  readOnly?: boolean;
  /** Shown inside a column that has no cards. */
  emptyLabel?: string;
}

type DragState = {
  taskId: string;
  fromCol: string;
  width: number;
  height: number;
  /** Where inside the card the pointer grabbed it. */
  offsetX: number;
  offsetY: number;
};

type Slot = { col: string; index: number };

export const KanbanBoard = React.forwardRef<HTMLDivElement, KanbanBoardProps>(
  function KanbanBoard(
    {
      columns,
      onChange,
      label = "Project board",
      readOnly = false,
      emptyLabel = "Nothing here yet",
      className,
      style,
      ...props
    },
    ref,
  ) {
    const [cols, setCols] = React.useState<KanbanColumn[]>(columns);
    const [drag, setDrag] = React.useState<DragState | null>(null);
    const [slot, setSlot] = React.useState<Slot | null>(null);
    const [grabbed, setGrabbed] = React.useState<string | null>(null);
    const [announcement, setAnnouncement] = React.useState("");
    const [atStart, setAtStart] = React.useState(true);
    const [atEnd, setAtEnd] = React.useState(true);
    const reduceMotion = useReducedMotion();

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const trackRef = React.useRef<HTMLDivElement>(null);
    const listRefs = React.useRef(new Map<string, HTMLDivElement>());
    const colRefs = React.useRef(new Map<string, HTMLDivElement>());
    const cardRefs = React.useRef(new Map<string, HTMLDivElement>());
    const dragRef = React.useRef<DragState | null>(null);
    const slotRef = React.useRef<Slot | null>(null);
    const autoScroll = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);

    // Adopt new columns from the parent during render rather than in an
    // effect, so a filter change never paints one frame of stale cards.
    const [prevColumns, setPrevColumns] = React.useState(columns);
    if (prevColumns !== columns) {
      setPrevColumns(columns);
      setCols(columns);
    }

    /*
      The track fades into the page background on whichever side still has
      columns hidden past the edge. Each side switches off once you reach it,
      so nothing is ever dimmed for no reason.
    */
    const syncEdges = React.useCallback(() => {
      const el = trackRef.current;
      if (!el) return;
      setAtStart(el.scrollLeft < 8);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
    }, []);

    React.useEffect(() => {
      syncEdges();
      const el = trackRef.current;
      if (!el) return;
      const ro = new ResizeObserver(syncEdges);
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncEdges, cols.length]);

    const fade = "24px";
    const maskStops = [
      `transparent 0%, #000 ${atStart ? "0%" : fade}`,
      `#000 ${atEnd ? "100%" : `calc(100% - ${fade})`}, transparent 100%`,
    ].join(", ");
    const mask =
      atStart && atEnd ? undefined : `linear-gradient(to right, ${maskStops})`;

    /*
      A keyboard move re-mounts the card inside another column, which drops
      focus on the floor and swallows every key after the first. Put it back
      on the card that is still being carried.
    */
    React.useEffect(() => {
      if (!grabbed) return;
      const el = cardRefs.current.get(grabbed);
      if (el && document.activeElement !== el) el.focus({ preventScroll: true });
    }, [cols, grabbed]);

    /* ---------------------------------------------------------------- move */

    const locate = React.useCallback(
      (list: KanbanColumn[], taskId: string) => {
        for (const c of list) {
          const i = c.tasks.findIndex((t) => t.id === taskId);
          if (i > -1) return { col: c.id, index: i, task: c.tasks[i] };
        }
        return null;
      },
      [],
    );

    const move = React.useCallback(
      (taskId: string, to: Slot) => {
        setCols((prev) => {
          const found = locate(prev, taskId);
          if (!found) return prev;
          if (found.col === to.col && found.index === to.index) return prev;

          const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
          const from = next.find((c) => c.id === found.col)!;
          from.tasks.splice(found.index, 1);
          const dest = next.find((c) => c.id === to.col)!;
          dest.tasks.splice(Math.min(to.index, dest.tasks.length), 0, found.task);

          onChange?.(next);
          return next;
        });
      },
      [locate, onChange],
    );

    /* -------------------------------------------------------- hit testing */

    /**
     * Card midpoints per column, measured once at drag start and stored as
     * offsets from the top of each list.
     *
     * Measuring live during the drag looks simpler and is wrong twice over.
     * The cards are mid-spring, so their boxes are somewhere between where
     * they were and where they are going; and the placeholder pushes them
     * past the pointer, which flips the decision, which moves the
     * placeholder, which flips it back. A snapshot of the layout without
     * the dragged card in it has neither problem.
     */
    const snapRef = React.useRef(new Map<string, number[]>());

    const snapshot = React.useCallback((taskId: string, fromCol: string) => {
      const map = new Map<string, number[]>();
      listRefs.current.forEach((list, colId) => {
        const listTop = list.getBoundingClientRect().top;
        const cards = Array.from(list.querySelectorAll<HTMLElement>("[data-kanban-card]"));
        let removed = -1;
        let removedH = 0;
        const rows = cards.map((el, i) => {
          const r = el.getBoundingClientRect();
          const isDragged = colId === fromCol && el.dataset.kanbanCard === taskId;
          if (isDragged) {
            removed = i;
            removedH = r.height;
          }
          return { top: r.top - listTop, h: r.height, isDragged };
        });
        const mids = rows
          .filter((row) => !row.isDragged)
          .map((row, i) => {
            // close the gap the dragged card leaves behind
            const shift = removed > -1 && i >= removed ? removedH + GAP : 0;
            return row.top - shift + row.h / 2;
          });
        map.set(colId, mids);
      });
      snapRef.current = map;
    }, []);

    /** Which slot is the pointer over? */
    const slotAt = React.useCallback((clientX: number, clientY: number): Slot | null => {
      const d = dragRef.current;
      if (!d) return null;

      let inside = "";
      let nearestId = "";
      let nearest = Infinity;
      colRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right) inside = id;
        const dx = Math.abs(clientX - (r.left + r.width / 2));
        if (dx < nearest) {
          nearest = dx;
          nearestId = id;
        }
      });
      const colId = inside || nearestId;
      if (!colId) return null;

      const list = listRefs.current.get(colId);
      if (!list) return { col: colId, index: 0 };

      const listTop = list.getBoundingClientRect().top;
      const mids = snapRef.current.get(colId) ?? [];

      let index = mids.length;
      for (let i = 0; i < mids.length; i++) {
        if (clientY < listTop + mids[i]) {
          index = i;
          break;
        }
      }
      return { col: colId, index };
    }, []);

    /* ------------------------------------------------------ pointer drag */

    const endDrag = React.useCallback(() => {
      const d = dragRef.current;
      const s = slotRef.current;
      if (d && s) move(d.taskId, s);
      dragRef.current = null;
      slotRef.current = null;
      autoScroll.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setDrag(null);
      setSlot(null);
    }, [move]);

    React.useEffect(() => {
      if (!drag) return;

      const onMove = (e: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        x.set(e.clientX - d.offsetX);
        y.set(e.clientY - d.offsetY);

        const next = slotAt(e.clientX, e.clientY);
        const cur = slotRef.current;
        if (next && (!cur || cur.col !== next.col || cur.index !== next.index)) {
          slotRef.current = next;
          setSlot(next);
        }

        // nudge the track along when you drag near either edge
        const track = trackRef.current;
        if (track) {
          const r = track.getBoundingClientRect();
          const edge = 72;
          autoScroll.current =
            e.clientX < r.left + edge ? -14 : e.clientX > r.right - edge ? 14 : 0;
        }
      };

      const onUp = () => endDrag();

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      const tick = () => {
        if (autoScroll.current && trackRef.current) {
          trackRef.current.scrollLeft += autoScroll.current;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [drag, endDrag, slotAt, x, y]);

    const startDrag = (e: React.PointerEvent, task: KanbanTask, colId: string, index: number) => {
      if (readOnly || e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const state: DragState = {
        taskId: task.id,
        fromCol: colId,
        width: r.width,
        height: r.height,
        offsetX: e.clientX - r.left,
        offsetY: e.clientY - r.top,
      };
      x.set(r.left);
      y.set(r.top);
      snapshot(task.id, colId);
      dragRef.current = state;
      slotRef.current = { col: colId, index };
      setDrag(state);
      setSlot({ col: colId, index });
      setGrabbed(null);
    };

    /* ---------------------------------------------------------- keyboard */

    const originRef = React.useRef<Slot | null>(null);

    const onCardKeyDown = (e: React.KeyboardEvent, task: KanbanTask) => {
      if (readOnly) return;
      const isGrabbed = grabbed === task.id;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (isGrabbed) {
          setGrabbed(null);
          const at = locate(cols, task.id);
          setAnnouncement(
            at ? `Dropped ${task.title} in ${colName(cols, at.col)}, position ${at.index + 1}.` : "",
          );
        } else {
          const at = locate(cols, task.id);
          originRef.current = at ? { col: at.col, index: at.index } : null;
          setGrabbed(task.id);
          setAnnouncement(`Picked up ${task.title}. Use the arrow keys to move it.`);
        }
        return;
      }

      if (e.key === "Escape" && isGrabbed) {
        e.preventDefault();
        if (originRef.current) move(task.id, originRef.current);
        setGrabbed(null);
        setAnnouncement(`Cancelled. ${task.title} is back where it started.`);
        return;
      }

      if (!isGrabbed) return;
      const at = locate(cols, task.id);
      if (!at) return;
      const colIndex = cols.findIndex((c) => c.id === at.col);

      let to: Slot | null = null;
      if (e.key === "ArrowUp") to = { col: at.col, index: Math.max(0, at.index - 1) };
      if (e.key === "ArrowDown")
        to = { col: at.col, index: Math.min(cols[colIndex].tasks.length - 1, at.index + 1) };
      if (e.key === "ArrowLeft" && colIndex > 0)
        to = { col: cols[colIndex - 1].id, index: Math.min(at.index, cols[colIndex - 1].tasks.length) };
      if (e.key === "ArrowRight" && colIndex < cols.length - 1)
        to = { col: cols[colIndex + 1].id, index: Math.min(at.index, cols[colIndex + 1].tasks.length) };

      if (to) {
        e.preventDefault();
        move(task.id, to);
        setAnnouncement(
          `${task.title} moved to ${colName(cols, to.col)}, position ${to.index + 1}.`,
        );
      }
    };

    /* ------------------------------------------------------------ render */

    const dragged = drag ? locate(cols, drag.taskId) : null;

    return (
      <div
        ref={ref}
        style={
          {
            "--kanban-font": FONT_STACK,
            fontFamily: "var(--kanban-font)",
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          // a board is dragged, not read: stop drags painting text selection
          "w-full text-foreground antialiased",
          !readOnly && "select-none",
          className,
        )}
        {...props}
      >
        <div
          ref={trackRef}
          role="group"
          aria-label={label}
          onScroll={syncEdges}
          style={
            mask
              ? ({ maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties)
              : undefined
          }
          className={cn(
            "flex items-start gap-3 overflow-x-auto pb-1",
            // the native bar is hidden; ScrollRail below draws our own
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          <LayoutGroup>
            {cols.map((col) => {
              const isTarget = slot?.col === col.id && !!drag;
              return (
                <div
                  key={col.id}
                  data-kanban-column={col.id}
                  ref={(el) => {
                    if (el) colRefs.current.set(col.id, el);
                    else colRefs.current.delete(col.id);
                  }}
                  className={cn(
                    "group/col w-[286px] shrink-0 rounded-[16px] p-3 transition-colors duration-200",
                    "bg-foreground/[0.04] dark:bg-foreground/[0.05]",
                    isTarget && "bg-primary/[0.08] dark:bg-foreground/[0.09]",
                    SQUIRCLE,
                  )}
                >
                  <ColumnHeader
                    col={col}
                    readOnly={readOnly}
                    /* while a card is in the air the counts show where it
                       would land, not where it came from */
                    count={
                      col.tasks.length -
                      (drag && drag.fromCol === col.id ? 1 : 0) +
                      (drag && slot?.col === col.id ? 1 : 0)
                    }
                  />

                  <div
                    ref={(el) => {
                      if (el) listRefs.current.set(col.id, el);
                      else listRefs.current.delete(col.id);
                    }}
                    className="mt-3 flex flex-col gap-2"
                  >
                    {/*
                      The card in the air is taken out of the list, so the
                      placeholder has to be placed against the list without
                      it. Measuring in one index space and rendering in the
                      other is what makes same-column reordering quietly do
                      nothing.
                    */}
                    {col.tasks
                      .filter((t) => t.id !== drag?.taskId)
                      .map((task, i) => {
                      return (
                        <React.Fragment key={task.id}>
                          {isTarget && slot!.index === i && (
                            <Placeholder height={drag!.height} />
                          )}
                          {readOnly ? (
                            <StaticCard task={task} />
                          ) : (
                            <Card
                              task={task}
                              grabbed={grabbed === task.id}
                              reduceMotion={!!reduceMotion}
                              elRef={(el) => {
                                if (el) cardRefs.current.set(task.id, el);
                                else cardRefs.current.delete(task.id);
                              }}
                              onPointerDown={(e) => startDrag(e, task, col.id, i)}
                              onKeyDown={(e) => onCardKeyDown(e, task)}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                    {isTarget &&
                      slot!.index >=
                        col.tasks.filter((t) => t.id !== drag?.taskId).length && (
                        <Placeholder height={drag!.height} />
                      )}
                    {col.tasks.length === 0 && !isTarget && (
                      <p
                        className={cn(
                          "m-0 rounded-[12px] border border-dashed border-foreground/15 px-3 py-6 text-center text-[12px] text-foreground/50",
                          SQUIRCLE,
                        )}
                      >
                        {emptyLabel}
                      </p>
                    )}
                  </div>

                  {!readOnly && (
                    <button
                      type="button"
                      className={cn(
                        "mt-2 flex w-full items-center gap-1.5 rounded-[10px] px-2 py-2 text-[12.5px] font-medium",
                        "text-foreground/55 transition-colors hover:bg-foreground/[0.05] hover:text-foreground",
                        SQUIRCLE,
                      )}
                    >
                      <Plus aria-hidden className="h-3.5 w-3.5" />
                      Add task
                    </button>
                  )}
                </div>
              );
            })}
          </LayoutGroup>
        </div>

        <ScrollRail trackRef={trackRef} />

        {/* the card riding the cursor */}
        <AnimatePresence>
          {drag && dragged && (
            <motion.div
              style={{ x, y, width: drag.width }}
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: reduceMotion ? 1 : 1.03, rotate: reduceMotion ? 0 : 1.6 }}
              exit={{ scale: 1, rotate: 0, opacity: 0 }}
              transition={LIFT_SPRING}
              className="pointer-events-none fixed left-0 top-0 z-50 origin-top-left"
            >
              <CardShell task={dragged.task} floating />
            </motion.div>
          )}
        </AnimatePresence>

        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    );
  },
);

function colName(cols: KanbanColumn[], id: string) {
  return cols.find((c) => c.id === id)?.name ?? id;
}

/* ------------------------------------------------------------------ parts */

/**
 * Our own horizontal scrollbar.
 *
 * The native one is no help here: on macOS, and in most headless browsers,
 * it is an overlay that stays hidden until you are already scrolling, which
 * is the one moment you no longer need to be told the board scrolls. This
 * one is always visible while there is somewhere to go, and you can drag it.
 */
function ScrollRail({ trackRef }: { trackRef: React.RefObject<HTMLDivElement | null> }) {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [geom, setGeom] = React.useState({ ratio: 1, offset: 0 });
  const [held, setHeld] = React.useState(false);

  const sync = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const ratio = el.clientWidth / el.scrollWidth;
    const max = el.scrollWidth - el.clientWidth;
    setGeom({ ratio, offset: max > 0 ? el.scrollLeft / max : 0 });
  }, [trackRef]);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync, trackRef]);

  const scrollTo = React.useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      const el = trackRef.current;
      if (!rail || !el) return;
      const r = rail.getBoundingClientRect();
      const thumbW = r.width * geom.ratio;
      const p = (clientX - r.left - thumbW / 2) / (r.width - thumbW);
      el.scrollLeft = Math.max(0, Math.min(1, p)) * (el.scrollWidth - el.clientWidth);
    },
    [geom.ratio, trackRef],
  );

  React.useEffect(() => {
    if (!held) return;
    const onMove = (e: PointerEvent) => scrollTo(e.clientX);
    const onUp = () => setHeld(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [held, scrollTo]);

  if (geom.ratio >= 0.999) return null;

  return (
    <div
      ref={railRef}
      onPointerDown={(e) => {
        setHeld(true);
        scrollTo(e.clientX);
      }}
      className="mt-3 h-[6px] w-full cursor-pointer rounded-full bg-foreground/[0.06]"
    >
      <div
        style={{
          width: `${geom.ratio * 100}%`,
          marginLeft: `${geom.offset * (100 - geom.ratio * 100)}%`,
        }}
        className={cn(
          "h-full rounded-full transition-colors",
          held ? "bg-primary/60 dark:bg-foreground/50" : "bg-foreground/20 hover:bg-foreground/30",
        )}
      />
    </div>
  );
}

function ColumnHeader({
  col,
  count,
  readOnly,
}: {
  col: KanbanColumn;
  count: number;
  readOnly: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", ACCENT_DOT[col.accent ?? "muted"])} />
      <h3 className="m-0 truncate text-[13px] font-medium tracking-[-0.005em]">{col.name}</h3>
      <motion.span
        key={count}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={FLOW_SPRING}
        className={cn(
          "grid h-[18px] min-w-[18px] place-items-center rounded-[6px] px-1 text-[11px] font-medium tabular-nums",
          "bg-foreground/[0.07] text-foreground/60",
          SQUIRCLE,
        )}
      >
        {count}
      </motion.span>
      {/* only one way to add a task, and it lives at the foot of the column */}
      {!readOnly && (
        <span className="ml-auto flex items-center">
          <IconButton label={`More options for ${col.name}`}>
            <MoreHorizontal aria-hidden className="h-3.5 w-3.5" />
          </IconButton>
        </span>
      )}
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        // always there, quiet until you reach for it
        "grid h-6 w-6 place-items-center rounded-[7px] transition-colors duration-150",
        "text-foreground/45 hover:bg-foreground/[0.07] hover:text-foreground active:bg-foreground/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        SQUIRCLE,
      )}
    >
      {children}
    </button>
  );
}

function Placeholder({ height }: { height: number }) {
  return (
    <motion.div
      layout
      data-kanban-placeholder
      initial={{ opacity: 0, scaleY: 0.7 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.7 }}
      transition={FLOW_SPRING}
      style={{ height }}
      className={cn(
        "origin-top rounded-[12px] border border-dashed",
        "border-primary/30 bg-primary/[0.03] dark:border-foreground/20 dark:bg-foreground/[0.03]",
        SQUIRCLE,
      )}
    />
  );
}

function Card({
  task,
  grabbed,
  reduceMotion,
  elRef,
  onPointerDown,
  onKeyDown,
}: {
  task: KanbanTask;
  grabbed: boolean;
  reduceMotion: boolean;
  elRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <motion.div
      ref={elRef}
      layout
      data-kanban-card={task.id}
      tabIndex={0}
      role="button"
      aria-roledescription="Draggable card"
      aria-grabbed={grabbed}
      aria-label={`${task.title}. Press space to pick up.`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      transition={reduceMotion ? { duration: 0 } : FLOW_SPRING}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      className={cn(
        "cursor-grab touch-none active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        grabbed && "ring-2 ring-primary/60 dark:ring-foreground/50",
        "rounded-[12px]",
        SQUIRCLE,
      )}
    >
      <CardShell task={task} />
    </motion.div>
  );
}

/** A card in a read-only board: a link when it has somewhere to go. */
function StaticCard({ task }: { task: KanbanTask }) {
  const ring =
    "block rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  if (!task.href) {
    return (
      <div data-kanban-card={task.id} className={cn(ring, SQUIRCLE)}>
        <CardShell task={task} />
      </div>
    );
  }

  return (
    <a
      href={task.href}
      target="_blank"
      rel="noopener noreferrer"
      data-kanban-card={task.id}
      className={cn(
        ring,
        "transition-transform duration-150 hover:-translate-y-px motion-reduce:hover:translate-y-0",
        SQUIRCLE,
      )}
    >
      <CardShell task={task} />
    </a>
  );
}

function CardShell({ task, floating }: { task: KanbanTask; floating?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border p-3",
        "border-foreground/[0.07] bg-background dark:border-foreground/10",
        floating
          ? "shadow-[0_16px_32px_-12px_rgb(0_0_0/0.28)]"
          : "shadow-[0_1px_2px_rgb(0_0_0/0.05)]",
        SQUIRCLE,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {task.priority && (
          <span className={cn(CHIP, "font-medium", PRIORITY_STYLES[task.priority], SQUIRCLE)}>
            <Flag aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
            <span>{PRIORITY_LABELS[task.priority]}</span>
          </span>
        )}
        {task.category && (
          <span
            className={cn(
              CHIP,
              "min-w-0 font-normal",
              "bg-foreground/5 text-foreground/70 dark:bg-foreground/[0.07]",
              SQUIRCLE,
            )}
          >
            <TaskIcon icon={task.icon} />
            <span className="truncate">{task.category}</span>
          </span>
        )}
      </div>

      <p className="m-0 mt-2.5 text-[14px] font-medium leading-snug tracking-[-0.005em]">
        {task.title}
      </p>

      {task.note && (
        <p className="m-0 mt-1 text-[12px] font-normal leading-snug text-foreground/55">
          {task.note}
        </p>
      )}

      {(task.assignees?.length || task.due || task.progress != null) && (
        <>
          <div className="mt-3 h-px bg-foreground/[0.07]" />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {task.due && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11.5px] tabular-nums",
                    task.dueSoon
                      ? "font-semibold text-primary dark:text-foreground"
                      : "font-normal text-foreground/55",
                  )}
                >
                  <CalendarDays aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                  {task.due}
                </span>
              )}
              {task.progress != null && <ProgressRing value={task.progress} />}
            </div>
            <AvatarStack people={task.assignees ?? []} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A callout that points at whatever it is wrapped around, on hover or focus.
 * The tail is a rotated square sitting half outside the bubble, so it reads
 * as one shape rather than a label floating nearby.
 */
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const skin = "bg-neutral dark:bg-foreground";
  return (
    <span className="group/tip relative flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2",
          "translate-y-1 opacity-0 transition-[opacity,transform] duration-150 ease-out",
          "group-hover/tip:translate-y-0 group-hover/tip:opacity-100",
          "group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100",
        )}
      >
        <span
          className={cn(
            "block whitespace-nowrap rounded-[7px] px-2 py-1 text-[11px] font-medium leading-none",
            "text-white dark:text-background",
            skin,
            "shadow-[0_6px_16px_-4px_rgb(0_0_0/0.3)]",
            SQUIRCLE,
          )}
        >
          {label}
        </span>
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-full h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1.5px]",
            skin,
          )}
        />
      </span>
    </span>
  );
}

function AvatarStack({ people }: { people: KanbanAssignee[] }) {
  const shown = people.slice(0, 3);
  const rest = people.slice(3);
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.name + i} className={cn(i > 0 && "-ml-1.5")}>
          <Tooltip label={p.name}>
            <span
              tabIndex={0}
              aria-label={p.name}
              className={cn(
                "grid h-[22px] w-[22px] place-items-center overflow-hidden rounded-full",
                "ring-2 ring-background",
                "focus-visible:outline-none focus-visible:ring-primary",
              )}
            >
              {p.avatar ? (
                // Remote avatars at 22px gain nothing from next/image optimisation.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <Initials name={p.name} />
              )}
            </span>
          </Tooltip>
        </span>
      ))}
      {rest.length > 0 && (
        <span className="-ml-1.5">
          <Tooltip label={rest.map((p) => p.name).join(", ")}>
            <span
              tabIndex={0}
              className={cn(
                "grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-medium",
                "bg-foreground/10 text-foreground/70 ring-2 ring-background",
                "focus-visible:outline-none focus-visible:ring-primary",
              )}
            >
              +{rest.length}
            </span>
          </Tooltip>
        </span>
      )}
    </div>
  );
}

const INITIAL_TINTS = ["bg-primary", "bg-secondary", "bg-neutral", "bg-primary/80", "bg-secondary/80"];

function Initials({ name }: { name: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "grid h-full w-full place-items-center text-[9.5px] font-medium text-white",
        INITIAL_TINTS[h % INITIAL_TINTS.length],
      )}
    >
      {initials}
    </span>
  );
}

function ProgressRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <span className="inline-flex items-center gap-1">
      <svg viewBox="0 0 16 16" aria-hidden className="h-[14px] w-[14px] -rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="stroke-foreground/10" />
        <motion.circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c - (c * v) / 100 }}
          transition={FLOW_SPRING}
          className="stroke-primary dark:stroke-foreground"
        />
      </svg>
      <span className="text-[11.5px] font-normal tabular-nums text-foreground/55">{v}%</span>
    </span>
  );
}

/* ------------------------------------------------------------------ icons */

export type IconKey = "web" | "dashboard" | "mobile" | "brand" | "infra" | "docs" | "issue" | "pull-request";

/** Category icons, from lucide, each with the tint it wears in the chip. */
const CATEGORY_ICONS: Record<IconKey, { Icon: LucideIcon; tint: string }> = {
  web: { Icon: Monitor, tint: "text-primary dark:text-foreground" },
  dashboard: { Icon: LayoutDashboard, tint: "text-secondary dark:text-foreground/80" },
  mobile: { Icon: Smartphone, tint: "text-primary dark:text-foreground" },
  brand: { Icon: Palette, tint: "text-secondary dark:text-foreground/80" },
  infra: { Icon: Server, tint: "text-primary dark:text-foreground" },
  docs: { Icon: FileText, tint: "text-secondary dark:text-foreground/80" },
  issue: { Icon: CircleDot, tint: "text-secondary dark:text-foreground/80" },
  "pull-request": { Icon: GitPullRequest, tint: "text-primary dark:text-foreground" },
};

function TaskIcon({ icon }: { icon?: IconKey | React.ReactNode }) {
  if (icon && typeof icon !== "string") return <>{icon}</>;
  const { Icon, tint } = CATEGORY_ICONS[(icon as IconKey) ?? "web"] ?? CATEGORY_ICONS.web;
  // lucide strokes are sized for 24px; nudge them up so they hold at 12px
  return <Icon aria-hidden className={cn("h-3 w-3 shrink-0", tint)} strokeWidth={2.25} />;
}

export default KanbanBoard;

export { KanbanBoard as Component };
