"use client";

import { useCallback, useMemo, useReducer } from "react";
import type { RoundResult, Song } from "@/types";
import { DECK_SIZE, STAGE_DURATIONS, STAGE_POINTS } from "@/lib/constants";
import { shuffle } from "@/lib/shuffle";

export type GamePhase = "setup" | "stage" | "feedback" | "results";

export type GuessAttempt = { text: string; correct: boolean };

const TIER_COUNT = STAGE_DURATIONS.length;

function emptyGuesses(): (GuessAttempt | null)[] {
  return Array<GuessAttempt | null>(TIER_COUNT).fill(null);
}

type State = {
  phase: GamePhase;
  deck: Song[];
  currentIndex: number;
  stageIndex: number;
  guesses: (GuessAttempt | null)[];
  results: RoundResult[];
  lastGuessCorrect: boolean | null;
  shakeToken: number;
};

type Action =
  | { type: "START_GAME"; deck: Song[] }
  | { type: "SKIP" }
  | { type: "SUBMIT_GUESS"; songId: string | null; text: string }
  | { type: "GIVE_UP" }
  | { type: "NEXT_SONG" }
  | { type: "RESTART" };

function makeInitialState(): State {
  return {
    phase: "setup",
    deck: [],
    currentIndex: 0,
    stageIndex: 0,
    guesses: emptyGuesses(),
    results: [],
    lastGuessCorrect: null,
    shakeToken: 0,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_GAME":
      return {
        ...makeInitialState(),
        phase: "stage",
        deck: action.deck,
      };
    case "SKIP":
      // Move to a longer clip without spending a guess on this tier.
      return {
        ...state,
        stageIndex: Math.min(state.stageIndex + 1, TIER_COUNT - 1),
      };
    case "SUBMIT_GUESS": {
      const current = state.deck[state.currentIndex];
      if (!current) return state;

      const correct = action.songId !== null && action.songId === current.id;
      const guesses = [...state.guesses];
      guesses[state.stageIndex] = { text: action.text, correct };

      if (correct) {
        const result: RoundResult = {
          song: current,
          correct: true,
          gaveUp: false,
          stageIndex: state.stageIndex,
          points: STAGE_POINTS[state.stageIndex],
        };
        return {
          ...state,
          guesses,
          phase: "feedback",
          results: [...state.results, result],
          lastGuessCorrect: true,
        };
      }

      // Wrong guess: each guess consumes its tier and pushes the player to
      // the next (longer) one. Out of tiers on the last one reveals it.
      const isLastTier = state.stageIndex >= TIER_COUNT - 1;
      if (isLastTier) {
        const result: RoundResult = {
          song: current,
          correct: false,
          gaveUp: false,
          stageIndex: state.stageIndex,
          points: 0,
        };
        return {
          ...state,
          guesses,
          phase: "feedback",
          results: [...state.results, result],
          lastGuessCorrect: false,
          shakeToken: state.shakeToken + 1,
        };
      }

      return {
        ...state,
        guesses,
        stageIndex: state.stageIndex + 1,
        lastGuessCorrect: false,
        shakeToken: state.shakeToken + 1,
      };
    }
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
        guesses: emptyGuesses(),
        lastGuessCorrect: null,
      };
    }
    case "RESTART":
      return makeInitialState();
    default:
      return state;
  }
}

export function useGame(allSongs: Song[]) {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);

  const startGame = useCallback(() => {
    const deck = shuffle(allSongs).slice(0, DECK_SIZE);
    dispatch({ type: "START_GAME", deck });
  }, [allSongs]);

  const skip = useCallback(() => dispatch({ type: "SKIP" }), []);

  const submitGuess = useCallback((guessedSongId: string | null, guessText: string) => {
    dispatch({ type: "SUBMIT_GUESS", songId: guessedSongId, text: guessText });
  }, []);

  const giveUp = useCallback(() => dispatch({ type: "GIVE_UP" }), []);
  const nextSong = useCallback(() => dispatch({ type: "NEXT_SONG" }), []);
  const restart = useCallback(() => dispatch({ type: "RESTART" }), []);

  const currentSong = state.deck[state.currentIndex] ?? null;
  const isLastSong = state.currentIndex === state.deck.length - 1;
  const totalScore = useMemo(() => state.results.reduce((sum, r) => sum + r.points, 0), [state.results]);
  const stageDuration = STAGE_DURATIONS[state.stageIndex];
  const canSkip = state.stageIndex < TIER_COUNT - 1;

  return {
    phase: state.phase,
    deck: state.deck,
    currentIndex: state.currentIndex,
    currentSong,
    stageIndex: state.stageIndex,
    stageDuration,
    tierCount: TIER_COUNT,
    guesses: state.guesses,
    canSkip,
    results: state.results,
    lastGuessCorrect: state.lastGuessCorrect,
    shakeToken: state.shakeToken,
    isLastSong,
    totalScore,
    startGame,
    skip,
    submitGuess,
    giveUp,
    nextSong,
    restart,
  };
}
