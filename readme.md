# Asura 

> README-driven development

This is mostly intended as research and experimenting with programming languages 
with advanced type and effect systems, WebAssembly + WASI, editing experiences, 
interpreters + REPLs, type-checking algorithms, parsing strategies, concurrency 
+ scheduling, syntax, diagnostics, distributed systems, debuggers, and probably 
more too.

The goal is to start entirely in TypeScript and then hopefully boostrap later on.

This will probably never become much of anything, but if you're interested in any 
of the random things I'm experimenting with feel free to reach out!

## High-level goals

- High-quality developer experience
- TypeScript-esque syntax
- Structural Type System
- Higher-kinded Types
- Algebraic Effects
- Fiber-based structured concurrency
- Horizontally scalable by default
- Compile to WASM + TypeScript definitions
- Maybe support for HTML/CSS/JS output types for web
- Bootstrap the language

## Inspirations

- TypeScript for its syntax and capability
- Haskell for its type system and ADTs w/ derivation
- Koka for its effect system
- Elm for its error messages
- Unison for its effects (Abilities)
- Unison Cloud for providing a distributed by default runtime.
- Golem Cloud for WASM deployments
- More to come I'm sure

## Current Ideas for exploration

### User-friendly error messages

First and foremost error messages that are ACTUALLY helpful are of keen interest to me.

#### Open Questions
- [ ] What context do we need?
- [ ] How do we manage partial parsing of invalid syntax?
- [ ] How to best show this in a CLI in 2025?
- [ ] How does this integrate into the type-checker?
- [ ] How to integrate with Language Server Protocol?
- [ ] Debug/Productions mode for storing more/less information in stack traces?

### Higher-Kinded Types (HKTs)

Higher-kinded types are functions for your type system. Similar to how generics allow
you to express functions that work with any type, we extend this capability to types.

#### Open Questions
- [ ] How to implement in a type-checker?
- [ ] How do they interact with effects?

### Multi-prompt algebraic effects and handlers

Algebraic effects are like interfaces in most languages. They allow you to specify 
the "shape" of something without implementing. This allows you to potentially implement
it in serveral ways, like one for production and another for testing. 

#### Open Questions
- [ ] Runtime?
- [ ] Remote Execution?
- [ ] What are the performance implications of multi-prompt effects?
- [ ] How do we integrate effects with the type system?

### Fiber-based structured concurrency

Fibers are like lightweight threads that make it easier to handle multiple things happening 
at once. Typically when a Fiber reaches an asynchronous operation, it will suspend or stop, and 
some kind of scheduler selects another fiber with work to perform to do so up until a point it 
reaches an asynchronous operation and the process continues indefinitely.

#### Open Questions
- [ ] How to keep stack traces useful?
- [ ] How to spawn fibers on remote machines?

### Serialization/Deserialization + Remote closures

I want ALL of the language to be serializable. All the data structures. Even the 
functions and effects. It should be possible to run 100 machines, some mechanism 
defined in which they can communicate, maybe UDP/TCP or something, and then you have a 
horizontally scaled system. There should be no experience of - "feature X works in context A 
but not in context B".

#### Open Questions
- [ ] HOOOWWW?? :smile:

### WebAssembly

I dunno I've felt like Webassmebly is the future for a long time and I'm really just
curious to learn about how it actually works and the ecosystem building around it.

#### Open Questions
- [ ] How to compile to it
- [ ] Component Model?
- [ ] Threads?
- [ ] Garbage Collection or compile-time reference counting ?????
- [ ] Linear Types?
- [ ] Capability Types?