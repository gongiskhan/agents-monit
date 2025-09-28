<!-- Sync Impact Report
Version change: N/A → 1.0.0
New principles established:
- I. Library-First Architecture
- II. CLI Interface Protocol  
- III. Test-First Development
- IV. Integration Testing Focus
- V. Observability & Monitoring
Added sections:
- Core Principles (5 principles)
- Development Constraints
- Quality Standards
- Governance
Templates requiring updates: 
✅ plan-template.md - Constitution Check references aligned
✅ spec-template.md - Scope/requirements alignment verified
✅ tasks-template.md - Task categorization reflects principles
✅ agent-file-template.md - No outdated references found
Follow-up TODOs: 
- RATIFICATION_DATE to be confirmed with project initiator
-->

# Agents Monitor Constitution

## Core Principles

### I. Library-First Architecture
Every monitoring capability MUST start as a standalone library with clear boundaries. Libraries MUST be self-contained, independently testable, and documented. Each library MUST have a single, well-defined purpose - no organizational-only libraries allowed. This ensures modularity and reusability across different agent monitoring contexts.

### II. CLI Interface Protocol  
Every library MUST expose its functionality via command-line interface following strict text I/O protocol: stdin/arguments for input, stdout for results, stderr for errors. MUST support both JSON and human-readable output formats. This enables consistent integration and automation across monitoring pipelines.

### III. Test-First Development
Test-Driven Development is MANDATORY for all features. The cycle MUST be: write tests first, get user approval, verify tests fail, then implement. The Red-Green-Refactor cycle MUST be strictly enforced. No implementation may begin until tests are written and failing.

### IV. Integration Testing Focus
Integration tests are REQUIRED for: new library contracts, contract modifications, inter-service communication, shared monitoring schemas, and agent communication protocols. Every monitoring endpoint MUST have contract tests validating request/response schemas.

### V. Observability & Monitoring
All components MUST emit structured logs following OpenTelemetry standards. Metrics collection MUST be built-in from the start. Text I/O ensures debuggability at every layer. Performance metrics MUST be collected for all agent interactions.

## Development Constraints

**Technology Stack**: Language-agnostic with preference for statically-typed languages. REST/GraphQL for APIs. Standard POSIX CLI conventions.

**Architecture Rules**: Maximum 3 levels of abstraction. No circular dependencies between libraries. Shared code only through explicit library interfaces.

**Performance Requirements**: Agent health checks MUST complete within 100ms. Monitoring data ingestion MUST handle 1000 events/second per agent. Dashboard updates MUST render within 200ms.

## Quality Standards

**Code Coverage**: Minimum 80% test coverage for libraries, 100% for public APIs.

**Documentation**: Every public function MUST have docstrings. Every library MUST have README with examples. Architecture decisions MUST be documented in ADRs.

**Review Process**: All PRs require approval from maintainer. Breaking changes require migration plan. Performance impact must be measured for data path changes.

## Governance

The Constitution supersedes all other development practices and guidelines. 

**Amendment Process**: Proposed amendments MUST include rationale, impact analysis, and migration plan. Amendments require documentation in constitution PR with 3-day comment period.

**Compliance**: All PRs and code reviews MUST verify constitutional compliance. Complexity beyond constitutional limits MUST be justified in writing. Use project-specific agent files (CLAUDE.md, AGENTS.md, etc.) for runtime development guidance.

**Versioning Policy**: Semantic versioning applies to this constitution:
- MAJOR: Removing principles or backward-incompatible governance changes
- MINOR: Adding new principles or sections  
- PATCH: Clarifications, wording improvements, typo fixes

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): Awaiting project initiator confirmation | **Last Amended**: 2025-01-27