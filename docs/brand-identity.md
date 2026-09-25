# RepBunny — brand identity

## The idea

**RepBunny is a small, good-looking place to record strength training.** It helps you keep track of what you lifted, repeat the routines you care about, and see the progress that comes from showing up. It is cute enough to feel welcoming, cool enough to feel at home in the gym, and quick enough to use between sets.

**Brand promise:** Your training, clearly recorded, with a little delight and no extra work.

**Tagline:** Small wins. Stronger every set.

## Who it is for

RepBunny is a private app for its two invited users. It is built for people who want a reliable record of their own lifting: exercises, sets, reps, weight, reusable workout templates, and past sessions. The phone is often in one hand, the workout is already underway, and attention belongs to the training rather than the app.

## What we are — and what we are not

| We are | We are not |
| --- | --- |
| A focused strength workout log | An all-in-one health or lifestyle platform |
| A way to repeat routines and compare them over time | A coach that prescribes training plans or judges performance |
| A private record of your own work | A social feed, competition, or public profile |
| A fast tool for the gym floor | A dashboard that asks for constant attention |
| Encouraging when a real milestone happens | A streak machine that manufactures urgency or guilt |

Nutrition, calories, sleep, step counts, community features, and endless metrics are outside the product's purpose. New features should earn their place by making strength training easier to record, repeat, or understand. “Could a fitness app have this?” is not enough.

## Personality

**Cute, with restraint.** The bunny, rounded shapes, and warm pink make the app friendly. The charm should show up at entry points, rest, and genuine wins; it should not crowd every form field.

**Cool, without posing.** Dark plum surfaces, clear typography, and compact data make RepBunny feel composed. It can be playful without sounding childish or trying to perform gym culture.

**Efficient by default.** The next useful action should be obvious. Reuse what the user has already entered, keep optional detail optional, and make it easy to get back to a set. Every extra tap needs a reason.

**Quietly encouraging.** A personal record deserves a moment. An ordinary set needs a clear confirmation and a path forward. Progress is shown as evidence, not as pressure.

## Voice and copy

- Write like a helpful training partner: warm, brief, specific, and confident.
- Lead with the action or the fact. Use plain labels such as **Start workout**, **Add set**, **Finish workout**, **History**, and **Templates**.
- Use bunny language sparingly. “Let's hop in” works as an invitation; “hop” in every instruction would get in the way.
- Celebrate what actually happened. Show the exercise and numbers behind a record. Avoid generic superlatives for routine actions.
- Never shame someone for a missed day, a lighter set, or an unfinished workout. Do not imply that the app knows what their body needs.
- Keep errors useful: say what failed and what the person can do next. Keep confirmation of destructive actions explicit.

**Good examples:** “Last time,” “Add set,” “New record,” “Back to workout.”

**Avoid:** “Crush your goals every day,” “You fell behind,” “Optimize your entire wellness journey,” or a joke where a clear button label should be.

## Visual identity

The current product uses a dark, phone-first interface. A deep plum background lets the workout data lead; Bunny Pink calls attention to the primary action. Lavender, gold, and green are supporting notes for variety, highlights, and positive progress. Pink is an accent, not a wall-to-wall fill.

| Role | Current token | Color |
| --- | --- | --- |
| Background | `--bg` | `#17111c` |
| Main surface | `--surface` | `#211829` |
| Raised surface | `--surface-2` | `#241a2c` |
| Primary accent, Bunny Pink | `--accent` | `#f2879c` |
| Supporting lavender | `--secondary` | `#b79cf0` |
| Highlight gold | `--highlight` | `#f2c069` |
| Progress green | `--success` | `#a9cb8d` |
| Main text | `--text` | `#f5edf2` |

Baloo 2 gives the name and display moments their rounded character. Manrope keeps labels, numbers, and longer text legible. Use the bunny and dumbbell mark as the recognizable signature; reserve larger mascot art and motion for onboarding, rest, and record celebrations. The mascot should support the moment, while the set data stays readable.

Cards, pills, and rounded controls make the interface soft to touch. Keep the hierarchy firm: one obvious primary action, quieter secondary actions, readable contrast, and enough space for a thumb. Show a number or label alongside color when it carries meaning.

## Product decisions through the brand lens

Before adding a feature or changing a screen, ask:

1. Does it help someone record a lift, repeat a routine, or understand their strength progress?
2. Can it be used quickly in the middle of a workout?
3. Does it remove thought or taps from the core flow?
4. Is any celebration tied to a real event, and easy to leave?
5. Will it still feel like a private, focused tool when the novelty wears off?

If the answer is no, simplify it or leave it out. RepBunny's confidence comes from doing a few useful things very well.

## Grounding in the current app

This identity reflects the shipped app's onboarding, sign-in, Home logging, History, Templates, Exercises, rest timer, and record celebration screens as of September 2026. The visual tokens and type are defined in `src/style.css`; the product and privacy boundaries are described in `docs/architecture.md`. Future brand work should preserve the same balance of warmth, clarity, and speed.
