// Backlog item 38: pool of mascot image + phrase pairs for the record
// celebration screen. Seeded with the two pieces of art supplied for this
// feature; combos are picked as a fixed pair (not image/phrase
// independently) so every result stays curated. Add more pairs here any
// time more art shows up.
export interface CelebrationVariant {
  image: string
  phrase: string
}

export const celebrationPool: CelebrationVariant[] = [
  { image: '/celebration-bunny.png', phrase: 'Certified strong today.' },
  { image: '/celebration-bear.png', phrase: "That's a PR. No notes." },
]

export function pickCelebration(random: () => number = Math.random): CelebrationVariant {
  return celebrationPool[Math.floor(random() * celebrationPool.length)]
}
