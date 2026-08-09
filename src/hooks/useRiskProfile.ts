import { useEffect, useState } from "react";
import type { Answers } from "@/lib/riskProfile";

const KEY = "mf-risk-profile-v1";

interface Stored {
  answers: Answers;
  completed: boolean;
}

function load(): Stored {
  if (typeof window === "undefined") return { answers: {}, completed: false };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : { answers: {}, completed: false };
  } catch {
    return { answers: {}, completed: false };
  }
}

export function useRiskProfile() {
  const [state, setState] = useState<Stored>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  return {
    answers: state.answers,
    completed: state.completed,
    setAnswers: (answers: Answers) => setState((s) => ({ ...s, answers })),
    setCompleted: (completed: boolean) => setState((s) => ({ ...s, completed })),
    reset: () => setState({ answers: {}, completed: false }),
  };
}
