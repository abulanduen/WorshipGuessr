"use client";

import { useCallback, useMemo, useReducer } from "react";
import type { RoundResult, Song } from "@/types";
import { DECK_SIZE, STAGE_DURATIONS, STAGE_POINTS } from "@/lib/constants";
import { shuffle } from "@/lib/shuffle";

export type GamePhase = "setup" | "stage" | "feedback" | "results";

type State = {
  phase: GamePhase;
  deck: Song[];
  currentIndex: number;
  stageIndex: number;
  results: RoundResult[];
  lastGuessCorrect: boolean | null;
  shakeToken: number;
};

type Action =
  | { type: "START_GAME"; deck: Song[] }
  | { type: "ADVANCE_STAGE" }
  | { type: "CORRECT_GUESS" }
  | { type: "WRONG_GUESS" }
  | { type: "GIVE_UP" }
  | { type: "NEXT_SONG" }
  | { type: "RESTART" };

const initialState: State = {
  phase: "setup",
  deck: [],
  currentIndex: 0,
  stageIndex: 0,
  results: [],
  lastGuessCorrect: null,
  shakeToken: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_GAME":
      return {
        ...initialState,
        phase: "stage",
        deck: action.deck,
      };
    case "ADVANCE_STAGE":
      return {
        ...state,
        stageIndex: Math.min(state.stageIndex + 1, STAGE_DURATIONS.length - 1),
      };
    case "CORRECT_GUESS": {
      const song = state.deck[state.currentIndex];
      const result: RoundResult = {
        song,
        correct: true,
        gaveUp: false,
        stageIndex: state.stageIndex,
        points: STAGE_POINTS[state.stageIndex],
      };
      return {
        ...state,
        phase: "feedback",
        results: [...state.results, result],
        lastGuessCorrect: true,
      };
    }
    case "WRONG_GUESS":
      return { ...state, lastGuessCorrect: false, shakeToken: state.shakeToken + 1 };
    case "GIVE_UP": {
      const song = state.deck[state.currentIndex];
      const result: RoundResult = {
        song,
        correct: false,
        gaveUp: true,
        stageIndex: state.stageIndex,
        points: 0,
      };
      return {
        ...state,
        phase: "feedback",
        results: [...state.results, result],
        lastGuessCorrect: false,
      };
    }
    case "NEXT_SONG": {
      const nextIndex = state.currentIndex + 1;
      if (nextIndex >= state.deck.length) {
        return { ...state, phase: "results" };
      }
      return {
        ...state,
        phase: "stage",
        currentIndex: nextIndex,
        stageIndex: 0,
        lastGuessCorrect: null,
      };
    }
    case "RESTART":
      return initialState;
    default:
      return state;
  }
}

export function useGame(allSongs: Song[]) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const startGame = useCallback(() => {
    const deck = shuffle(allSongs).slice(0, DECK_SIZE);
    dispatch({ type: "START_GAME", deck });
  }, [allSongs]);

  const advanceStage = useCallback(() => dispatch({ type: "ADVANCE_STAGE" }), []);

  const submitGuess = useCallback(
    (guessedSongId: string | null) => {
      const current = state.deck[state.currentIndex];
      if (!current) return;
      if (guessedSongId && guessedSongId === current.id) {
        dispatch({ type: "CORRECT_GUESS" });
      } else {
        dispatch({ type: "WRONG_GUESS" });
      }
    },
    [state.deck, state.currentIndex]
  );

  const giveUp = useCallback(() => dispatch({ type: "GIVE_UP" }), []);
  const nextSong = useCallback(() => dispatch({ type: "NEXT_SONG" }), []);
  const restart = useCallback(() => dispatch({ type: "RESTART" }), []);

  const currentSong = state.deck[state.currentIndex] ?? null;
  const isLastSong = state.currentIndex === state.deck.length - 1;
  const totalScore = useMemo(() => state.results.reduce((sum, r) => sum + r.points, 0), [state.results]);
  const stageDuration = STAGE_DURATIONS[state.stageIndex];
  const canAdvanceStage = state.stageIndex < STAGE_DURATIONS.length - 1;

  return {
    phase: state.phase,
    deck: state.deck,
    currentIndex: state.currentIndex,
    currentSong,
    stageIndex: state.stageIndex,
    stageDuration,
    canAdvanceStage,
    results: state.results,
    lastGuessCorrect: state.lastGuessCorrect,
    shakeToken: state.shakeToken,
    isLastSong,
    totalScore,
    startGame,
    advanceStage,
    submitGuess,
    giveUp,
    nextSong,
    restart,
  };
}
