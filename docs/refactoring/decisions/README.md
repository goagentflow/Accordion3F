# 📚 Architecture Decision Records (ADRs)

This directory contains important architectural decisions made during the refactoring process.

## Why Document Decisions?

- **Future Understanding:** Remember why we chose approach A over B
- **Team Alignment:** Everyone understands the reasoning
- **Avoid Revisiting:** Don't waste time reconsidering settled decisions
- **Onboarding:** New developers understand the architecture

---

## Decision Template

When creating a new decision document, use this format:

```markdown
# [Decision Title]

**Date:** [YYYY-MM-DD]
**Status:** [Proposed | Accepted | Rejected | Superseded]
**Author:** [Your name]

## Context
What problem are we solving? What forces are at play?

## Options Considered
1. **Option A:** Description
   - Pros:
   - Cons:

2. **Option B:** Description
   - Pros:
   - Cons:

## Decision
Which option did we choose and why?

## Consequences
- What becomes easier?
- What becomes harder?
- What are the trade-offs?

## Code Example
```javascript
// Show the pattern in practice
```
```

---

## Decisions Log

### Week 1: Architecture
- [ ] Why useReducer over useState
- [ ] State structure design
- [ ] File organization pattern
- [ ] Naming conventions

### Week 2: Persistence
- [ ] LocalStorage vs IndexedDB
- [ ] Excel data format
- [ ] Auto-save frequency

### Week 3: Performance
- [ ] Virtual scrolling library choice
- [ ] Memoization strategy
- [ ] Bundle splitting approach

---

## Example Decision Files

- `001-useReducer-pattern.md` - Why we chose useReducer
- `002-state-structure.md` - How we organized state
- `003-excel-format.md` - Hidden sheet design
- `004-autosave-strategy.md` - LocalStorage approach

---

## Quick Decisions (One-liners)

For small decisions that don't need full documents:

- **Console.log removal:** Using debug() library instead for dev logging
- **Date library:** Sticking with native Date, no moment.js needed
- **CSS approach:** Keeping Tailwind, no changes needed
- **Testing library:** Jest + React Testing Library when we add tests

---

Remember: Document the WHY, not just the WHAT.