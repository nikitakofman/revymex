import { produce, enablePatches, applyPatches, Patch } from "immer";
import { useState, useCallback, useRef } from "react";
import { NodeState } from "../../reducer/nodeDispatcher";

enablePatches();

interface HistoryState {
  past: Patch[][];
  future: Patch[][];
}

interface RecordingSession {
  id: string;
  startState: NodeState;
}

export function useNodeHistory(initialState: NodeState) {
  const [state, setState] = useState<NodeState>(initialState);
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    future: [],
  });

  const isUndoingRef = useRef(false);
  const prevStateRef = useRef(state);
  const currentSessionRef = useRef<RecordingSession | null>(null);

  const hasStyleChanged = (prevStyle: any, nextStyle: any) => {
    const tempStyles = ["transform", "zIndex", "position", "left", "top"];
    const prevStyleFiltered = { ...prevStyle };
    const nextStyleFiltered = { ...nextStyle };

    tempStyles.forEach((style) => {
      delete prevStyleFiltered[style];
      delete nextStyleFiltered[style];
    });

    for (const key in prevStyleFiltered) {
      if (prevStyleFiltered[key] !== nextStyleFiltered[key]) {
        return true;
      }
    }
    for (const key in nextStyleFiltered) {
      if (prevStyleFiltered[key] !== nextStyleFiltered[key]) {
        return true;
      }
    }
    return false;
  };

  const getChanges = (prevState: NodeState, nextState: NodeState) => {
    const prevIds = new Set(
      prevState.nodes.filter((n) => n.type !== "placeholder").map((n) => n.id)
    );
    const nextIds = new Set(
      nextState.nodes.filter((n) => n.type !== "placeholder").map((n) => n.id)
    );

    let positionChanged = false;
    let styleChanged = false;

    for (const id of prevIds) {
      if (!nextIds.has(id)) continue;
      const prevNode = prevState.nodes.find((n) => n.id === id)!;
      const nextNode = nextState.nodes.find((n) => n.id === id)!;

      if (prevNode.parentId !== nextNode.parentId) {
        positionChanged = true;
        break;
      }

      const prevSiblings = prevState.nodes.filter(
        (n) => n.parentId === prevNode.parentId && n.type !== "placeholder"
      );
      const nextSiblings = nextState.nodes.filter(
        (n) => n.parentId === nextNode.parentId && n.type !== "placeholder"
      );

      const prevRelativeIdx = prevSiblings.findIndex((n) => n.id === id);
      const nextRelativeIdx = nextSiblings.findIndex((n) => n.id === id);

      if (prevRelativeIdx !== nextRelativeIdx) {
        positionChanged = true;
        break;
      }

      if (hasStyleChanged(prevNode.style, nextNode.style)) {
        styleChanged = true;
        break;
      }
    }

    return {
      nonPlaceholderChanged:
        positionChanged || prevIds.size !== nextIds.size || styleChanged,
    };
  };

  const startRecording = useCallback(() => {
    // Always use the current state as the starting point
    const sessionId = Math.random().toString(36).substring(7);
    currentSessionRef.current = {
      id: sessionId,
      startState: JSON.parse(JSON.stringify(state)), // Deep clone to prevent reference issues
    };
    return sessionId;
  }, [state]);

  const stopRecording = useCallback(
    (sessionId: string) => {
      const session = currentSessionRef.current;
      if (session?.id !== sessionId) {
        return false;
      }

      const startState = session.startState;
      const finalState = state;

      // Generate patches between start and final state
      let patches: Patch[] = [];
      let inversePatches: Patch[] = [];

      produce(
        startState,
        (draft) => {
          Object.assign(draft, finalState);
        },
        (p, ip) => {
          patches = p;
          inversePatches = ip;
        }
      );

      // Only record if there are actual changes
      if (patches.length > 0) {
        setHistory((h) => ({
          past: [...h.past, inversePatches].slice(-50),
          future: [],
        }));
      }

      currentSessionRef.current = null;
      return true;
    },
    [state]
  );

  const setStateWithHistory = useCallback(
    (updater: React.SetStateAction<NodeState>) => {
      setState((prev) => {
        const nextState =
          typeof updater === "function" ? updater(prev) : updater;

        // Skip history recording if we're in an active session
        if (currentSessionRef.current) {
          prevStateRef.current = nextState;
          return nextState;
        }

        // Only record if not undoing and not in a session
        if (!isUndoingRef.current) {
          const changes = getChanges(prevStateRef.current, nextState);
          if (changes.nonPlaceholderChanged) {
            let patches: Patch[] = [];
            let inversePatches: Patch[] = [];

            produce(
              prevStateRef.current,
              (draft) => {
                Object.assign(draft, nextState);
              },
              (p, ip) => {
                patches = p;
                inversePatches = ip;
              }
            );

            if (patches.length > 0) {
              setHistory((h) => ({
                past: [...h.past, inversePatches].slice(-50),
                future: [],
              }));
            }
          }
        }

        prevStateRef.current = nextState;
        return nextState;
      });
    },
    []
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;

      isUndoingRef.current = true;
      const newPast = [...prev.past];
      const patchesToUndo = newPast.pop()!;

      setState((currentState) =>
        produce(currentState, (draft) => {
          applyPatches(draft, patchesToUndo);
        })
      );

      // Use a microtask instead of setTimeout
      Promise.resolve().then(() => {
        isUndoingRef.current = false;
      });

      return {
        past: newPast,
        future: [patchesToUndo, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;

      isUndoingRef.current = true;
      const [patchesToRedo, ...newFuture] = prev.future;

      setState((currentState) =>
        produce(currentState, (draft) => {
          applyPatches(draft, patchesToRedo);
        })
      );

      Promise.resolve().then(() => {
        isUndoingRef.current = false;
      });

      return {
        past: [...prev.past, patchesToRedo],
        future: newFuture,
      };
    });
  }, []);

  return {
    nodeState: state,
    setNodeState: setStateWithHistory,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    startRecording,
    stopRecording,
  };
}
