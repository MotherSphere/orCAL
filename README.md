# orCAL

orCAL is a Rust calculator with a Tauri interface. The web UI is served by Tauri and calls the Rust calculation engine.

## Features

- Operations: addition, subtraction, multiplication, division
- Parentheses and decimal numbers
- Error handling (incomplete expression, division by zero, invalid token)

## Prerequisites

- Rust (stable toolchain) and Cargo installed
- System dependencies for Tauri (see the Tauri documentation for your OS)

## Installation

```bash
cargo build -p orcal-tauri
```

## Usage

To start the Tauri app in development mode:

```bash
cargo run -p orcal-tauri
```

## Development

- `cargo run -p orcal-tauri` to run the Tauri app
- `cargo build -p orcal-tauri --release` to compile in release mode

## Structure

- `crates/orcal-core`: parsing and evaluation logic
- `src-tauri`: Tauri application
- `ui/`: HTML/CSS/JS interface
- `tasks/`: future instructions and work plan
- `docs/`: documentation and compliance
