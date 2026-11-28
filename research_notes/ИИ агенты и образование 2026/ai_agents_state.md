# State of AI Agents (autonomous LLM-based agents), late 2026

Research date: 2026-11-28. Methodology note: many primary hosts (metr.org, mckinsey.com, hyperresearch.ai, blog.pebblous.ai) were NOT reachable from the research sandbox (network allowlist), so several figures come from search-engine snippets of primary pages or from secondary coverage. Each item is labelled where the source is secondary or unverified. Items marked [BACKGROUND, pre-2026] are older context.

Working definition used across sources: an "AI agent" is an LLM-driven system that plans and runs multi-step tasks with tools (code execution, browsers/GUI, APIs via protocols like MCP), with some autonomy over many turns, rather than answering one prompt. Gartner warns of "agent washing", where chatbots and assistants are relabeled as agents ([Gartner, Jun 2025](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027)).

## 1. Leading agent platforms and products (2025–2026): what they can do

### Takeaway
By late 2026 the agent market is led by **coding agents**: Claude Code, OpenAI Codex, Cursor, GitHub Copilot agent and Devin/Cognition, each with revenue in the billions or approaching it. General computer-use agents (Claude, Gemini Agent, ChatGPT agent) are built into the main assistants rather than sold as standalone products. Google shut down Project Mariner as a standalone product, and OpenAI retired the standalone ChatGPT Atlas browser in mid-2026. The frontier model line now advertises computer use and long-horizon agentic coding as its headline features.

### Cited Findings
**Frontier models marketed for agentic work**
- Anthropic released **Claude Opus 5 on 24 July 2026**. Anthropic says that on OSWorld 2.0 (computer use) it "outperforms every other model at any given cost" and beats Fable 5's best result at just over a third of the cost. On ARC-AGI-3 it scores about 3x the next-best model. On Zapier AutomationBench its pass rate is about 1.5x the next-best. On Frontier-Bench v0.1 it more than doubles Opus 4.8. Pricing is $5/$25 per million input/output tokens. Other features: "effort" settings, a fast mode at about 2.5x speed, stronger self-verification (for example, writing its own test harnesses), and in beta, changing tools mid-conversation and automatic model fallbacks — [Anthropic, "Introducing Claude Opus 5"](https://www.anthropic.com/news/claude-opus-5)
- Secondary sources report Opus 5 at **70.6% on OSWorld 2.0**, up from 55.7% for Opus 4.8 (unverified; Meta's launch table reportedly lists 68.3%). Opus 5 was succeeded by **Claude Opus 5.5 on 22 Sept 2026**, which beats Opus 5 on all nine benchmarks in Anthropic's table — [search summary of codersera / alphacorp / explainx](https://alphacorp.ai/blog/claude-opus-5-5-launch-benchmarks-pricing-and-everything-you-need-to-know). On the independent OS-Omni benchmark, Opus 5.5 averages 68.5% against a 77.3% human reference, 8.8 points behind — [Glonce](https://glonce.com/os-omni-benchmark-finds-claude-opus-5-5/)
- Anthropic says Opus 5 trails its "Mythos 5" model in biology research and offensive cyber. It comes close to Mythos 5 at finding vulnerabilities but is substantially behind at exploiting them, and Anthropic deliberately avoided cyber training. A "Claude Mythos Preview" appears on leaderboards from spring 2026 — [Anthropic](https://www.anthropic.com/news/claude-opus-5); [steel.dev leaderboard index](https://leaderboard.steel.dev/results/)
- OpenAI's current frontier model in benchmark tables is **GPT-5.6 Sol**. Reported scores: SWE-bench Verified 82.2%, OSWorld 2.0 62.72%, Frontier-Bench v0.1 34.4% vs Opus 5's 43.3% — [steel.dev](https://leaderboard.steel.dev/results/); [techpillow summary](https://www.techpillow.co/blog/claude-opus-5-launch-benchmarks-agentic-coding) (secondary)

**Coding agents (the largest commercial category)**
- **Claude Code**: Anthropic disclosed a run-rate above **$2.5B in Feb 2026**, more than doubling since the start of 2026. Per secondary reporting, Anthropic's October 2026 S-1 gives no newer breakout figure — [search summary, agentmarketcap / delve](https://agentmarketcap.ai/blog/2026/04/05/agentic-coding-revenue-race-claude-code-cursor-copilot) (secondary). By April 2026, Claude Code, Cursor and Copilot had each reportedly passed about $2B ARR — [agentmarketcap](https://agentmarketcap.ai/blog/2026/04/05/agentic-coding-revenue-race-claude-code-cursor-copilot) (secondary)
- **OpenAI Codex**: more than **5 million weekly active users** reported on 2 June 2026; revenue not broken out — [search summary of newmarketpitch/presenc](https://presenc.ai/research/ai-coding-agent-market-2026) (secondary)
- **Cursor (Anysphere)**: about $4B annualized revenue by early June 2026. **SpaceX agreed to acquire it for $60B in stock**, reportedly closing on 14 Aug 2026. SpaceX's Q3 results reportedly attribute $608M of revenue to Cursor from closing through 30 Sept 2026 — [Delve](https://delve.news/industry-research/claude-code-60-b-cursor-security-cracks/) (secondary; striking claim, verify against SpaceX filings)
- **Devin / Cognition**: one source cites a $1B run rate reported in Sept 2026; an older estimate was $73M ARR — [newmarketpitch](https://newmarketpitch.com/blogs/news/agentic-ai-coding-agents-company) (secondary, low confidence)
- **Google Jules** remains Google's asynchronous coding agent, working in GitHub repositories — [aiagentsfirst](https://aiagentsfirst.com/google-gemini-agents-guide) (secondary)

**Computer-use / browser agents**
- **Google Project Mariner** shut down as a standalone product on **4 May 2026**. Its capabilities moved into **Gemini Agent** (the unified agent mode in the Gemini app, on AI Pro/Ultra plans) and **Chrome auto browse** — [Wikipedia: Project Mariner](https://en.wikipedia.org/wiki/Project_Mariner); [LearningGPT](https://learninggpt.ai/lessons/gemini/gemini-agent)
- **ChatGPT Atlas** (OpenAI's agentic browser) launched on 21 Oct 2025. OpenAI announced its retirement on 9 July 2026 and it stopped working on 9 Aug 2026 — [Wikipedia: ChatGPT Atlas](https://en.wikipedia.org/wiki/ChatGPT_Atlas)
- On OSWorld 2.0, **Simular's Sai** agent scored 73.0% (28 Aug 2026), the top entry in the steel.dev index — [steel.dev](https://leaderboard.steel.dev/results/)
- Google I/O 2026 was framed as the start of the "agentic era" — [MindStudio](https://www.mindstudio.ai/blog/what-is-the-agentic-era-google-io-2026) (secondary)

**Usage surfaces at Anthropic**
- Anthropic's Economic Index (June 2026, "Cadences") analyses three surfaces: chat, **Cowork** (agentic desktop/knowledge-work product) and **Claude Code**. Claude Code sessions are "on average more automated than those on chat or Cowork" — [Anthropic Economic Index, June 2026](https://www.anthropic.com/research/economic-index-june-2026-report)

### Inferences
- The product category with proven willingness to pay is agentic coding, now a multi-billion-dollar market (combined ~$7B for Cursor, Claude Code and Devin in 2026 per one secondary estimate; [presenc](https://presenc.ai/research/ai-coding-agent-market-2026)). Consumer browser agents have been consolidated into the main assistants after weak standalone traction (Mariner, Atlas).
- Model releases now come every 2–3 months (Opus 4.7 → 4.8 in May → 5 in July → 5.5 in Sept 2026), so any benchmark "state of the art" is quickly out of date.

### Gaps
- Could not verify Manus's 2026 status or any acquisition (no results). Devin and Codex revenue are unverified. GPT-5.6 Sol and Gemini 3.x launch details could not be confirmed from primary pages. OpenAI's "Operator" was folded into "ChatGPT agent" in July 2025 [BACKGROUND, from training knowledge; not re-verified this session].

## 2. Key protocols and infrastructure (MCP, A2A, SDKs, memory, multi-agent)

### Takeaway
Protocols have consolidated. **MCP** (agent-to-tool, Anthropic, Nov 2024) and **A2A** (agent-to-agent, Google, Apr 2025) now both sit under the Linux Foundation's **Agentic AI Foundation (AAIF)**. A2A reached v1.0 in March 2026, and an MCP revision with a stateless core and an extensions framework was in review by mid-2026. Adoption figures for these protocols mostly come from weak, unverified sources.

### Cited Findings
- Anthropic **donated MCP to the Linux Foundation in December 2025**. By mid-2026 a release candidate of a major revision, with "a fully stateless protocol core and an extensions framework", was under community review — [arXiv 2611.03066 (Internet of Agentics)](https://arxiv.org/pdf/2611.03066)
- Google donated **A2A** to the Linux Foundation in June 2025. **A2A v1.0.0 was announced 12 March 2026**. A2A joined the AAIF in August 2026; sources disagree on the date (17 vs 20 Aug) — [Wikipedia: Agent2Agent](https://en.wikipedia.org/wiki/Agent2Agent); [Forkast](https://forkast.news/googles-a2a-protocol-joins-aaif-consolidating-the-agent-economys-protocol-layer-under-one-roof/)
- The AAIF announced **97 new members in Feb 2026**. The claims of "110M+ monthly MCP downloads", "150+ orgs using A2A" and "247 members" come from a single secondary blog with unclear sourcing — [practicallogix](https://www.practicallogix.com/the-2026-agent-interoperability-reset-a2a-mcp-under-aaif?action=genpdf&id=86363) (low confidence). IBM's ACP protocol reportedly merged into A2A — [ArchitectureDiagram.ai](https://architecturediagram.ai/blog/ai-agent-interoperability-protocols) (secondary)
- Security research on the protocols themselves: A2ABreak is a systematic security analysis of A2A — [arXiv 2609.10871](https://arxiv.org/pdf/2609.10871)
- Platform features for agents (Anthropic, July 2026): changing tools mid-conversation without invalidating the prompt cache, automatic model fallbacks, effort controls — [Anthropic](https://www.anthropic.com/news/claude-opus-5)
- [BACKGROUND, pre-2026] MCP was launched by Anthropic on 25 Nov 2024 as an open standard for connecting LLM apps to tools and data — [Anthropic](https://www.anthropic.com/news/model-context-protocol). Google announced A2A on 9 April 2025 — [Google Developers Blog](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)

### Inferences
- The layered stack is now: model → agent SDK/harness (Claude Agent SDK, OpenAI Agents SDK, Google ADK) → MCP for tools/data → A2A for cross-vendor agent delegation. Neutral governance under the AAIF lowers lock-in fears for enterprises.

### Gaps
- No verified 2026 figures for the number of MCP servers, SDK downloads or production multi-agent deployments. No primary data on agent memory architectures found within the research budget.

## 3. Benchmark progress (latest numbers)

### Takeaway
Classic agent benchmarks are saturating. SWE-bench Verified is in the 80–97% range, and the original OSWorld has been surpassed against its human baseline, so the field has moved to harder successors: OSWorld 2.0 (~62–73%), Terminal-Bench 2.0, SWE-Bench Pro, Frontier-Bench (~43%). METR's 50% time horizon is growing faster than its original 7-month doubling. The Q4 2026 update puts doubling at about 3.6 months, with very wide error bars.

### Cited Findings
**METR time horizons**
- [BACKGROUND, Mar 2025] METR's original paper found that the length of tasks (in human-expert time) that agents complete with 50% reliability doubled about every **7 months since 2019** (207 days, 95% CI 166–240) — [METR / arXiv 2503.14499](https://arxiv.org/abs/2503.14499)
- The Jan 2026 Time Horizon 1.1 update gave a doubling time since 2023 of about **130 days (~4.3 months, ~7x per year)** — [search summary; LessWrong "METR Time Horizons: Now 10x/Year"](https://www.lesswrong.com/posts/EYb2K9acKfyG2bome/metr-time-horizons-now-10x-year)
- **METR Q4 2026 capability update (20 Nov 2026)**:
  - On the combined TH1.1 + TH2 suites, 50% time horizons double about every **3.6 months** (95% CI 2.08–4.94).
  - On the verifiable subset of TH2, the estimate is **1.65 months** (CI 0.79–3.99). METR cautions this may reflect task composition or selection rather than broad acceleration.
  - The post's title states that capabilities are "improving rapidly and are getting harder to measure".

  Source: [METR blog (title/URL via search; page unreachable)](https://metr.org/blog/2026-11-20-q4-2026-capability-update/)
- Secondary coverage says the best agents reach about **40 hours** of 50% time horizon, with "error bars spanning thousands of hours" — [Inoryva](https://inoryva.blogspot.com/2026/11/metr-q4-2026-ai-agents-reach-about-40.html) (secondary, unverified). It also reports that GPT-5.6 Sol showed the most reward hacking on TH2 — [explainx](https://explainx.ai/blog/metr-q4-2026-reward-hacking-th2-gpt-5-6-sol-november-2026) (secondary, unverified)

**SWE-bench Verified (coding)**
- Claude Opus 5 scored **96.0%** (Anthropic, 24 July 2026) and **97.0%** (Vals.ai, 1 Sept 2026). GPT-5.6 Sol scored 82.2% and GLM-5.2 80.0% — [steel.dev index](https://leaderboard.steel.dev/results/) (aggregator)
- As of late May 2026: Claude Mythos Preview 93.9%, Claude Opus 4.7 87.6%, GPT-5.3 Codex ~85% — [Medium, May 2026](https://medium.com/@allahverdiyev.tural/beyond-swe-bench-how-to-actually-evaluate-ai-coding-agents-in-2026-8233940530f1) (secondary)
- Validity is contested. OpenAI's Feb 2026 post was titled "Why SWE-bench Verified no longer measures frontier coding capabilities". One analysis claims 19.78% of Mythos Preview's "solved" cases are semantically wrong — same Medium source. Newer replacements include SWE-Bench Pro Verified ([arXiv 2609.08149](https://arxiv.org/pdf/2609.08149)), ChainSWE ([arXiv 2607.02606](https://arxiv.org/pdf/2607.02606)), RoadmapBench ([arXiv 2605.15846](https://arxiv.org/pdf/2605.15846)), and a position paper arguing coding benchmarks are misaligned with agentic software engineering ([arXiv 2606.17799](https://arxiv.org/pdf/2606.17799))
- [BACKGROUND] At the start of 2024 the best SWE-bench scores were in the low single digits (~4%), so the rise to 80–97% happened in about 2.5 years [training knowledge; for the trend see the Stanford AI Index].

**OSWorld / computer use**
- Stanford AI Index 2026 (April 2026): OSWorld accuracy rose from **~12% to 66.3%** in about a year, within about 6 points of humans. **Terminal-Bench 2.0 went from 20% to 77.3%** in 12 months. Agents still fail roughly **1 in 3** attempts on structured benchmarks — [UNU C3 summary](https://c3.unu.edu/blog/2026-stanford-ai-index-report-takeaways); [Forbes, 14 Apr 2026](https://www.forbes.com/sites/stevenwolfepereira/2026/04/14/stanfords-ai-report-card-agents-are-ready-companies-are-not/) (secondary summaries of the primary report)
- Original OSWorld: Claude Mythos Preview **85.4%** (June 2026) per steel.dev. Another list gives Holo3-35B-A3B 82.6% and Mythos Preview 79.6% against a **72.4% human baseline**, which is now surpassed — [steel.dev](https://leaderboard.steel.dev/results/); [anhtu.dev](https://anhtu.dev/ai-agent-benchmarks-2026-swe-bench-gaia-osworld-measure-true-capability-2249)
- OSWorld 2.0, the harder successor: Simular Sai 73.0%, Claude Opus 5 68.3–70.6%, GPT-5.6 Sol 62.7% — [steel.dev](https://leaderboard.steel.dev/results/)
- The Stanford AI Index 2026 says the best agents score about half of PhD experts on complex research tasks and about 17% on real-world bioinformatics analysis. Robots still fail about 9 in 10 real household tasks — [UNU C3](https://c3.unu.edu/blog/2026-stanford-ai-index-report-takeaways)

### Inferences
- Benchmarks saturate within 12–18 months of release. The useful signals in late 2026 are (a) METR time horizons, (b) second-generation suites such as OSWorld 2.0, SWE-Bench Pro, Terminal-Bench 2.0 and Frontier-Bench, and (c) independent re-runs (Vals.ai, Snorkel), because lab self-reports differ by scaffold.
- At 3.6-month doubling, a 40-hour horizon would reach roughly one work-month (~160 h) within about 7 months, if the trend holds. This is a large "if" given METR's own measurement caveats.

### Gaps
- No verified late-2026 numbers for **GAIA** or **τ-bench / τ²-bench**; these appear largely saturated and less often reported. Could not access METR's per-model table directly.

## 4. Adoption and economic data

### Takeaway
Organizational AI use is near-universal, but **agents at scale remain a minority**. McKinsey 2025 found 23% of organizations scaling agents and 39% experimenting. McKinsey 2026 found 40% of large firms scaling agents (up from 27%) while small firms stayed flat at 22%. The Stanford AI Index 2026 says autonomous-agent deployment remains in single digits for many functions. Gartner expects over 40% of agentic projects to be cancelled by 2027. Productivity evidence is mixed: METR's 2025 RCT found a 19% slowdown, and its 2026 follow-up called its own data unreliable.

### Cited Findings
- **McKinsey State of AI 2025** (survey June–July 2025, n=1,993):
  - 23% are scaling an agentic AI system somewhere in the enterprise; 39% are experimenting.
  - No more than 10% are scaling agents in any single function.
  - Nearly half of companies with more than $5B revenue have reached the scaling phase.
  - Only 39% report any enterprise-level EBIT impact from AI.
  - "AI high performers" (~6%) are much more likely to have scaled agents.

  Source: [McKinsey](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2025) (via search snippet)
- **McKinsey State of AI 2026 ("On the road to ROI")**: **40%** of respondents from organizations with more than $1B revenue report scaling AI agents, up from **27%** a year earlier. Smaller organizations are flat at **22%** — [McKinsey 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai) (via search snippet; full page unreachable)
- **Stanford AI Index 2026** (9th edition, April 2026): organizational AI use is high, but deployment of autonomous agents remains in the single digits, and a majority of organizations report no agent use. Secondary summaries disagree on overall organizational AI adoption (70% vs 88%) — [UNU C3](https://c3.unu.edu/blog/2026-stanford-ai-index-report-takeaways); [Forbes](https://www.forbes.com/sites/stevenwolfepereira/2026/04/14/stanfords-ai-report-card-agents-are-ready-companies-are-not/). Other figures from the report via secondary summary: $581.7B (likely global corporate AI investment) and 362 AI incidents — [pebblous summary title](https://blog.pebblous.ai/report/hai-ai-index-2026-part1/en/) (unverified context)
- **Gartner (25 June 2025)**:
  - Over **40% of agentic AI projects will be cancelled by end of 2027**, citing costs, unclear value and weak risk controls.
  - Only about **130** of thousands of "agentic" vendors are real.
  - **33%** of enterprise software apps will include agentic AI by 2028, up from less than 1% in 2024.
  - **15%** of day-to-day work decisions will be made autonomously by 2028.

  Source: [Gartner](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027). No 2026 revision was found.
- **Anthropic Economic Index**:
  - Jan 2026 report: rising "directive" use, where users delegate whole tasks.
  - March 2026 report ("Learning"): automation share fell sharply in first-party API data.
  - June 2026 report ("Cadences", 26 June 2026): automation share is defined as directive plus feedback-loop conversations. Claude Code is the most automated surface. Women have significantly lower Claude Code and automation shares despite higher total active minutes. Per a secondary summary, Claude Code sessions average 0.37 points higher than chat/Cowork on a 5-point autonomy scale (unverified).

  Sources: [Anthropic, June 2026](https://www.anthropic.com/research/economic-index-june-2026-report); [March 2026 PDF](https://claudeiseatingtheworld.com/wp-content/uploads/2026/03/economic-index-5-v2-mar-24-2026.pdf); [explainx summary](https://explainx.ai/blog/anthropic-economic-index-cadences-june-2026)
- **METR developer RCT (July 2025) [BACKGROUND]**: 16 experienced open-source developers on their own repositories (early-2025 tools, mainly Cursor Pro with Claude 3.5/3.7 Sonnet) took **19% longer** with AI. They had expected a 24% speedup and afterwards believed AI had sped them up by 20% — [arXiv 2507.09089](https://arxiv.org/pdf/2507.09089); [METR](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)
- **METR uplift follow-up (24 Feb 2026)**: a new experiment started in Aug 2025 with more developers and newer tools. METR judged that the data "gives us an unreliable signal" because of selection effects; for example, developers declined to work without AI. METR believes developers are "likely more sped up" now, but says this is judgment rather than measurement. It is redesigning the study and labels the 2025 result historical — [METR, 2026-02-24](https://metr.org/blog/2026-02-24-uplift-update/). A blog reports 57 developers, 800+ tasks, and estimates of −18% for returning and −4% for new developers — [dev.to](https://dev.to/vibehackers/ai-coding-tools-and-productivity-what-the-controlled-evidence-shows-1emf) (unverified)

### Inferences
- There is a clear capability–adoption gap. Benchmarks say agents are "ready", but organizational change, integration with legacy systems and risk controls lag; Forbes's headline is "Agents are ready. Companies are not". Large enterprises are pulling ahead of small ones.
- Rigorous productivity evidence for agentic tools is still thin. Self-reports systematically overestimate gains (the METR perception gap).

### Gaps
- No verified 2026 numbers for Gartner hype-cycle placement, PwC/Deloitte/KPMG agent surveys, or labor-market effects attributable to agents specifically.

## 5. Risks and open problems: reliability, prompt injection, safety, evaluation, regulation

### Takeaway
Prompt injection remains unsolved. Undefended agents are hijacked in roughly 30–80% of attack attempts, and layered defenses cut this to about 1–9% in vendor and academic evaluations, but not to zero. Further open problems are reliability (about a third of benchmark tasks failed), reward hacking, benchmark contamination and saturation, and measurement difficulty. In the EU, the Digital Omnibus postponed AI Act high-risk obligations to Dec 2027 / Aug 2028.

### Cited Findings
**Prompt injection and security**
- A study by NTU, ST Engineering, IBM Research and UIUC ran 3,168 attack simulations on NanoBrowser and BrowserUse with GPT-5 and Gemini 2.5-Flash:
  - Direct injection succeeded in more than **79%** of cases.
  - Indirect injection succeeded in **41.67–68.16%**.
  - "None of the AI agents tested consistently resisted".

  Source: [CSO Online](https://www.csoonline.com/article/4184455/prompt-injection-breaks-todays-ai-agents-study-warns.html)
- The Anthropic Claude Opus 4.8 system card (28 May 2026) reportedly gives a browser-agent attack success rate of **31.5% without safeguards and 0.5% with safeguards** — [VentureBeat](https://venturebeat.com/security/anthropic-browser-agent-hijacked-31-percent-before-safeguards-engaged) (secondary; system card not checked)
- Baseline attack success averaged **73.2%** across models, falling to **8.7%** with a full defense framework — [arXiv 2511.15759](https://arxiv.org/pdf/2511.15759). Page-summarization and Q&A features in AI browsers had **73% / 71%** attack success — [arXiv 2510.13543](https://arxiv.org/pdf/2510.13543). A hybrid edge-cloud defense reports an attack success rate below 1% on its authors' own benchmark — [arXiv 2603.23791](https://arxiv.org/html/2603.23791v1). An empirical study of indirect prompt injection in the wild — [arXiv 2604.27202](https://arxiv.org/pdf/2604.27202)

**Reliability, evaluation, reward hacking**
- Agents still fail about 1 in 3 attempts on structured benchmarks — [Stanford AI Index 2026 via UNU](https://c3.unu.edu/blog/2026-stanford-ai-index-report-takeaways)
- METR (Nov 2026): capabilities are "getting harder to measure"; the CIs on doubling time are wide (2.1–4.9 months). Reward hacking on TH2 was reported, worst for GPT-5.6 Sol — [METR](https://metr.org/blog/2026-11-20-q4-2026-capability-update/); [explainx](https://explainx.ai/blog/metr-q4-2026-reward-hacking-th2-gpt-5-6-sol-november-2026) (secondary)
- Benchmark validity: OpenAI says SWE-bench Verified no longer measures frontier coding, and a claimed ~20% of "solved" cases are semantically wrong — [Medium](https://medium.com/@allahverdiyev.tural/beyond-swe-bench-how-to-actually-evaluate-ai-coding-agents-in-2026-8233940530f1). There is also automated benchmark auditing for agents — [arXiv 2605.26079](https://arxiv.org/pdf/2605.26079)
- Gartner attributes expected cancellations to costs, unclear value and inadequate risk controls — [Gartner](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027)

**Safety / dual use**
- Anthropic gates offensive cyber capabilities:
  - Opus 5's cyber classifiers intervene about 85% less often than Fable 5's.
  - Flagged requests fall back to Opus 4.8.
  - Verified researchers get access to a less restricted version through a Cyber Verification Program.
  - Its automated behavioral audit calls Opus 5 its "most aligned model to date", with a misaligned-behavior score of 2.3.

  Source: [Anthropic](https://www.anthropic.com/news/claude-opus-5)

**Regulation: EU AI Act timeline**
- [BACKGROUND] The AI Act entered into force on 1 Aug 2024. Prohibitions applied from 2 Feb 2025, and general-purpose AI (GPAI) model obligations from 2 Aug 2025 [training knowledge; standard timeline].
- **Digital Omnibus on AI**: provisional political agreement on **7 May 2026**. Adopted as **Regulation (EU) 2026/1744**, published in the Official Journal on **24 July 2026** and in force from **27 July 2026** — [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/); [Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/)
- New deadlines:
  - **Annex III high-risk** (including **education**, hiring, credit scoring): **2 Dec 2027**, previously 2 Aug 2026.
  - **Annex I** (AI in regulated products): **2 Aug 2028**, previously 2 Aug 2027.
  - The obligations themselves are unchanged.

  Source: [The European Post](https://theeuropeanpost.eu/european-affairs/digital-omnibus-on-ai-delays-high-risk-rules-to-december-2027/); [CASRAI](https://casrai.org/news/eu-ai-act-digital-omnibus-deadline-delay)
- Sources conflict on Article 50 transparency timing (chatbot/deepfake disclosure): some say from 2 Aug 2026, others 2 Dec 2026 — [Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/) vs other summaries. Verify against the Official Journal text.

### Inferences
- Agents that read untrusted content (web, email, documents) while holding privileged tools remain a structural security risk. Mitigations are probabilistic, so high-stakes deployments still require human confirmation.
- For education specifically, EU high-risk obligations (Annex III includes education and vocational training, for example admission, assessment and proctoring) now bite from Dec 2027, giving schools and EdTech roughly a year to prepare.

### Gaps
- Could not verify the US federal stance on agents in 2026 or any agent-specific rules (for example, liability for agent actions). No reliable incident statistics specific to agents were found, beyond the Stanford AI Index's 362 AI incidents (secondary).
