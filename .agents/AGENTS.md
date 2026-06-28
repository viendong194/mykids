# Development Rules & AI Collaboration - Toddler World

## Rule 1: Task Scope
Do not modify code outside the scope of the assigned task. If refactoring is needed, ask the user first.

## Rule 2: Code Duplication
Do not duplicate code. Extract similar logic into shared components or services.

## Rule 3: Config-Driven (No Hardcoding)
All data must be read from JSON or configurations. This includes text, images, audio, levels, animations, and rewards.

## Rule 4: Domain-Agnostic Engines
Game engines must be completely unaware of specific educational categories (e.g., Animals, Numbers, Math, Languages). Engines should only handle:
- Question
- Choices
- Answer
- Animation
- Result

## Rule 5: File & Component Size Limits
Keep files small and maintainable:
- Maximum lines per file: 300 lines.
- Maximum lines per component: 200 lines.
If a file or component exceeds these limits, split it.

## Rule 6: Single-Task Pull Requests
Each task/PR must solve exactly one objective. Do not add out-of-scope features.

## Rule 7: Self-Review Checklist
Before completing a task, review:
- Is there duplicate code?
- Are there memory leaks (listeners un-subscribed, timers cleared)?
- Is code reusable?
- Is it fully responsive?
- Does it run correctly on mobile devices?
- Does it compile and run on Cloudflare Pages?

## Rule 8: Engine Extension Over Creation
Do not create a new game engine if an existing engine can be extended to support the gameplay.

## Rule 9: Unified Engine Interface
All engines must share a common interface. No engine may define custom APIs:
```typescript
interface GameEngine {
  initialize(): void;
  load(): void;
  render(): void;
  checkAnswer(): void;
  showResult(): void;
  destroy(): void;
}
```

## Rule 10: Centralized Assets
All assets must be managed centrally via `AssetManager`. No ad-hoc imports.

## Rule 11: Unified AudioManager
Audio playback must go through `AudioManager`. Do not invoke audio components directly.

## Rule 12: Unified AnimationManager
Animations must be managed via `AnimationManager`. Do not scatter animation logic.

## Rule 13: Universal Control Support
All games must support Touch, Mouse, Tablet, Desktop, and Mobile form factors.

## Rule 14: Localization (Multi-language)
All games must support Vietnamese, English, Chinese, and Japanese. Do not hardcode strings.

## Rule 15: Architecture Suggestions
If you discover architectural improvements, suggest them at the end of your response. Do not modify the architecture without approval.

## Rule 16: Mandatory Response Template
Every response after a task must use the template defined in Rule 16.
