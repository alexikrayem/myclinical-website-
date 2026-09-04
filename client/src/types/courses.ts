/**
 * Shared course domain types.
 *
 * This is the single source of truth for all types that are consumed by
 * multiple course-related components (CourseDetailPage, SecureVideoPlayer,
 * AttentionCheckModal). Import from here — do NOT redeclare locally.
 */

// ---------------------------------------------------------------------------
// Playback types
// ---------------------------------------------------------------------------

export interface MuxTokens {
    playback: string;
    thumbnail: string;
    storyboard: string;
}

export type PlaybackDescriptor =
    | { type: 'vdocipher'; otp: string; playbackInfo: string }
    | { type: 'hls'; manifestUrl: string; expiresAt?: string }
    | { type: 'mux'; playbackId: string; tokens: MuxTokens | null; expiresAt?: string }
    | { type: 'youtube'; url: string }
    | { type: 'mp4'; url: string };

// ---------------------------------------------------------------------------
// Attention-check / challenge types
// ---------------------------------------------------------------------------

export interface ColorOption {
    id: string;
    hex: string;
}

/** Display-level data carried by a challenge (type-discriminated at runtime). */
export interface ChallengeData {
    /** Prompt shown to the user (Arabic). */
    question: string;
    /** Optional English version of the prompt. */
    questionEn?: string;
    /** Color swatch options — only present for challenges of type "color". */
    options?: ColorOption[];
}

/** A single attention-check challenge as returned by the backend. */
export interface Challenge {
    id: string;
    type: 'color' | 'math';
    data: ChallengeData;
    trigger_at_seconds: number;
    timeout_seconds: number;
}
