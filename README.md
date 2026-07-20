# Hiring Agent

<p align="center"><strong>Resume-to-Score pipeline</strong> that extracts structured data from PDFs, enriches with GitHub signals, and outputs a fair, explainable evaluation — plus a recruiter ATS UI with conversational hiring desk.</p>

<p align="center">
  <a href="https://www.python.org/downloads/release/python-3110/">
    <img alt="Python" src="https://img.shields.io/badge/python-3.11%2B-blue.svg">
  </a>
  <a href="https://github.com/Mayank-013/hiring-agent/blob/main/LICENSE">
    <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-yellow.svg">
  </a>
  <a href="https://github.com/psf/black">
    <img alt="Code style: Black" src="https://img.shields.io/badge/code%20style-Black-000000.svg">
  </a>
</p>

---

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation and Setup](#installation-and-setup)
  - [Prerequisites](#prerequisites)
  - [Quick setup with pip](#quick-setup-with-pip)
  - [Web ATS UI](#web-ats-ui)
  - [Ollama models](#ollama-models)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Scoring categories](#scoring-categories)
- [CLI usage](#cli-usage)
- [API usage](#api-usage)
- [Directory layout](#directory-layout)
- [Provider details](#provider-details)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Hiring Agent parses a resume PDF to Markdown, extracts sectioned JSON using a local or hosted LLM, augments the data with GitHub profile and repository signals, then produces an objective evaluation with category scores, evidence, bonus points, and deductions.

You can run:

- **CLI** — `python score.py path/to/resume.pdf`
- **Recruiter ATS UI** — Next.js frontend + FastAPI backend for batch upload, ranking, parse diagnostics, and dual-scope chat (per-candidate + hiring desk)

Supported LLM backends: **OpenAI**, **Ollama**, and **Google Gemini**.

---

## Architecture

<table>
<tr>
<td>

**Flow**

1. `pymupdf_rag.py` converts PDF pages to Markdown-like text.
2. `pdf.py` calls the LLM per section using Jinja templates under `prompts/templates`, collecting parse diagnostics even when some sections fail.
3. `parse_quality.py` scores ATS / machine-readability from those diagnostics.
4. `github.py` fetches profile and repos, classifies projects, and asks the LLM to select the top 7.
5. `evaluator.py` runs a strict-scored evaluation with fairness constraints (and forces the precomputed `parse_quality` score).
6. `score.py` orchestrates the CLI end to end and writes CSV when development mode is on.
7. `api/` exposes upload, list, detail, and streaming chat for the `web/` ATS UI.

</td>
<td>

**Key modules**

- `models.py` — Pydantic schemas and LLM provider interfaces.
- `llm_utils.py` — Provider initialization and response cleanup.
- `parse_quality.py` — Deterministic parse-quality scoring.
- `transform.py` — Normalization from loose LLM JSON to JSON Resume style.
- `prompts/` — Jinja templates for extraction and scoring.
- `api/` — FastAPI recruiter backend.
- `web/` — Next.js + GSAP frontend.

</td>
</tr>
</table>

---

## Installation and Setup

### Prerequisites

- **Python 3.11+** (repo pins `.python-version` to 3.11.13; 3.12 also works)
- **Node.js 18+** (for the web UI)
- **One LLM backend**

  - **OpenAI** — set `OPENAI_API_KEY` ([API keys](https://platform.openai.com/api-keys))
  - **Ollama** — install from the [official site](https://ollama.com/), then run `ollama serve`
  - **Google Gemini** — set `GEMINI_API_KEY` ([AI Studio](https://aistudio.google.com/api-keys))

### Quick setup with pip

```bash
$ git clone https://github.com/Mayank-013/hiring-agent
$ cd hiring-agent

$ python -m venv .venv
# Linux or macOS
$ source .venv/bin/activate
# Windows
# .venv\Scripts\activate

$ pip install -r requirements.txt
$ cp .env.example .env
# Edit .env and set OPENAI_API_KEY (or another provider)
```

### Web ATS UI

```bash
# Terminal 1 — API (from repo root, venv active)
$ uvicorn api.main:app --reload --port 8000

# Terminal 2 — Frontend
$ cd web
$ cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
$ npm install
$ npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Upload PDFs, watch the ranked pipeline, open a candidate drawer for scores/diagnostics, and use **Hiring desk** (global) or **Candidate chat**.

### Ollama Models

```bash
$ ollama pull gemma3:4b

# Higher / lower system configuration
$ ollama pull gemma3:12b
$ ollama pull gemma3:1b
```

---

## Configuration

```bash
$ cp .env.example .env
```

**Environment variables**

| Variable          | Values                                         | Description                                      |
| ----------------- | ---------------------------------------------- | ------------------------------------------------ |
| `LLM_PROVIDER`    | `openai`, `ollama`, or `gemini`                | Chooses provider. Defaults to OpenAI.            |
| `DEFAULT_MODEL`   | e.g. `gpt-4o-mini`, `gemma3:4b`, `gemini-2.5-pro` | Model name passed to the provider.            |
| `OPENAI_API_KEY`  | string                                         | Required when `LLM_PROVIDER=openai`.             |
| `GEMINI_API_KEY`  | string                                         | Required when `LLM_PROVIDER=gemini`.             |
| `GITHUB_TOKEN`    | optional                                       | Improves GitHub API rate limits.                 |

Frontend:

| Variable                 | Description                          |
| ------------------------ | ------------------------------------ |
| `NEXT_PUBLIC_API_URL`    | FastAPI base URL (default `http://localhost:8000`) |

Provider mapping lives in `prompt.py` and `models.py`. The `config.py` file has a single flag:

```python
# config.py
DEVELOPMENT_MODE = True  # enables caching and CSV export
```

---

## How it works

<details>
<summary><b>1) PDF extraction</b></summary>

- `pymupdf_rag.py` and `pdf.py` read the PDF using PyMuPDF and convert pages to Markdown-like text.
- The `to_markdown` routine handles headings, links, tables, and basic formatting.

</details>

<details>
<summary><b>2) Section parsing with templates</b></summary>

- `prompts/templates/*.jinja` define strict instructions for each section
  Basics, Work, Education, Skills, Projects, Awards.
- `pdf.PDFHandler` calls the LLM per section and assembles a `JSONResume` object.
- Failed sections no longer abort the whole resume; they feed parse diagnostics instead.

</details>

<details>
<summary><b>3) Parse quality</b></summary>

- `parse_quality.py` scores machine-readability from text length, failed/empty sections, schema errors, layout artifacts, and missing profile URLs.
- Suggestions (single-column layout, selectable text, clear headings, explicit GitHub links) are returned for recruiters and candidates.

</details>

<details>
<summary><b>4) GitHub enrichment</b></summary>

- `github.py` extracts a username from the resume profiles, fetches profile and repos, and classifies each project.
- It asks the LLM to select exactly 7 unique projects with a minimum author commit threshold, favoring meaningful contributions.

</details>

<details>
<summary><b>5) Evaluation</b></summary>

- `evaluator.py` uses templates that encode fairness and scoring rules.
- Scores include `open_source`, `self_projects`, `production`, `technical_skills`, and `parse_quality`, plus bonus and deductions.

</details>

<details>
<summary><b>6) Output, CSV, and ATS API</b></summary>

- `score.py` prints a readable summary to stdout.
- When `DEVELOPMENT_MODE=True` it appends to `resume_evaluations.csv` and caches under `cache/`.
- `api/main.py` serves upload + evaluation jobs and SSE chat grounded in evaluation context.

</details>

---

## Scoring categories

| Category            | Max | What it measures                                      |
| ------------------- | --- | ----------------------------------------------------- |
| `open_source`       | 35  | Contributions to others' projects / community work    |
| `self_projects`     | 30  | Complexity and impact of personal / side projects     |
| `production`        | 25  | Real-world / internship / production experience       |
| `technical_skills`  | 10  | Breadth and evidence of technical skills              |
| `parse_quality`     | 10  | How easily the resume can be parsed by an ATS         |
| Bonus               | 20  | GSoC, founder roles, portfolio, blogs, etc.           |

Category total max is **110**; with bonus the overall cap is **130**.

---

## CLI usage

```bash
$ python score.py /path/to/resume.pdf
```

What happens:

1. If development mode is on, PDF extraction is cached to `cache/resumecache_<basename>.json`.
2. If a GitHub profile is found, repositories are fetched and cached to `cache/githubcache_<basename>.json`.
3. The evaluator prints a report (including parse quality) and, in development mode, appends a CSV row.

---

## API usage

With the API running (`uvicorn api.main:app --reload --port 8000`):

| Method | Path                         | Description                                      |
| ------ | ---------------------------- | ------------------------------------------------ |
| `GET`  | `/health`                    | Health check                                     |
| `GET`  | `/api/candidates`            | Ranked candidate list                            |
| `GET`  | `/api/candidates/{id}`       | Full evaluation + parse diagnostics              |
| `POST` | `/api/resumes`               | Multipart PDF upload (`files`) — async evaluate  |
| `POST` | `/api/chat`                  | Streaming SSE chat (`scope`: `candidate` \| `global`) |

---

## Directory layout

```text
.
├── .env.example
├── .python-version
├── api/
│   ├── main.py
│   ├── store.py
│   └── services/
│       ├── chat.py
│       └── pipeline.py
├── config.py
├── evaluator.py
├── github.py
├── llm_utils.py
├── models.py
├── parse_quality.py
├── pdf.py
├── prompt.py
├── prompts/
│   ├── template_manager.py
│   └── templates/
├── pymupdf_rag.py
├── requirements.txt
├── score.py
├── transform.py
└── web/                    # Next.js ATS UI
    ├── package.json
    └── src/
        ├── app/
        ├── components/
        └── lib/
```

---

## Provider details

### OpenAI (default)

- Set `LLM_PROVIDER=openai`
- Set `DEFAULT_MODEL` to e.g. `gpt-4o-mini` or `gpt-4o`
- Provide `OPENAI_API_KEY`
- The wrapper in `models.OpenAIProvider` returns an Ollama-compatible chat shape

### Ollama

- Set `LLM_PROVIDER=ollama`
- Set `DEFAULT_MODEL` to any pulled model, for example `gemma3:4b`
- The provider wrapper in `models.OllamaProvider` calls `ollama.chat`

### Gemini

- Set `LLM_PROVIDER=gemini`
- Set `DEFAULT_MODEL` to a supported Gemini model, for example `gemini-2.0-flash`
- Provide `GEMINI_API_KEY`
- The wrapper in `models.GeminiProvider` adapts responses to a unified format

---

## Contributing

Please read the [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on filing issues, proposing changes, and submitting pull requests. Key principles include:

- Keep prompts declarative and provider-agnostic.
- Validate changes with a couple of real resumes under different providers.
- Add or adjust unit-free smoke tests that call each stage with minimal inputs.

---

## License

[MIT](./LICENSE) © HackerRank
