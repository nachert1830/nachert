# Frontier of academic AI research for education and learning science (as of late Nov 2026)

Method note: all findings come from web search results (titles, abstracts and snippets). Direct fetches of arxiv.org and services.google.com were blocked in this session, so several numbers are from search summaries of the primary paper, not a full-text read. Status labels: [PEER] peer-reviewed venue, [PRE] preprint / tech report, [PRESS] press or secondary source.

## 1. Pedagogical LLMs, tutor benchmarks, and RL for teaching ability

### Takeaway
The field has moved from "prompt a strong model to act as a tutor" (2024) to "treat pedagogy as a trainable, measurable objective": Google's LearnLM line (tech reports + arena evaluation + classroom RCTs), standardized pedagogy taxonomies and benchmarks (MRBench, MathTutorBench, MMTutorBench), and multi-turn RL with simulated students that lets a 7B open model approach LearnLM. The central finding repeated across benchmarks: solving ability does not equal teaching ability.

### Cited Findings
**Google LearnLM line (newest first)**
- Oct 2026 follow-up (Google/Eedi document dated 2026-10-29): pre-registered expanded RCT, N=1,179 students, 10 UK state secondary schools, 10 weeks; students who received tutoring of any kind (AI or human) answered similar follow-up questions correctly 56–58% of the time vs 43% after standard remediation; human tutors approved 94.7% of AI draft messages without changes [PRE/PRESS; known only via search summary, full text not read] — [Google PDF](https://services.google.com/fh/files/misc/learnlm_oct26.pdf); [The 74](https://www.the74million.org/article/five-things-you-should-know-about-new-ai-tutor-study/)
- "AI tutoring can safely and effectively support students: An exploratory RCT in UK classrooms" (arXiv 2512.23633, Dec 2025) [PRE]: N=165 students, Year 9–10, five UK secondary schools, May–June 2025, Eedi maths platform; expert tutors supervised LearnLM and could edit every message; students supported by LearnLM were 5.5 pp more likely to solve novel problems on later topics (66.2% vs 60.7% for human tutors alone); tutors approved 82.3% of AI drafts with zero or minimal (1–2 character) edits — [arXiv](https://arxiv.org/abs/2512.23633v1); [Eedi press release](https://www.eedi.com/news/new-exploratory-research-from-eedi-and-google-deepmind-reveals-human-in-the-loop-ai-tutoring-outperforms-human-only-support); [Stanford SCALE repository](https://scale.stanford.edu/ai/repository/ai-tutoring-can-safely-and-effectively-support-students-exploratory-rct-uk-classrooms)
- Same study, contrasting framing: on the standardized test (Star Maths), among 916 students who took both tests, AI-tutored students scored about the same as the "static practice" group; Eedi's chief impact officer called human-in-the-loop "not a scalable solution" — [The 74](https://www.the74million.org/article/five-things-you-should-know-about-new-ai-tutor-study/)
- "Evaluating Gemini in an Arena for Learning" (arXiv 2505.24477, May 2025) [PRE]: educators and pedagogy experts did blind, multi-turn head-to-head comparisons; excluding ties, experts preferred Gemini 2.5 Pro in 73.2% of match-ups, ranking it first; it outperformed other models in every category of the pedagogy rubric — [arXiv](https://arxiv.org/abs/2505.24477v1)
- "LearnLM: Improving Gemini for Learning" (arXiv 2412.16429, v3 Aug 2025) [PRE]: reframes pedagogy as *instruction following* — teachers/developers specify desired pedagogical behaviour in system-level instructions rather than a fixed definition of "good pedagogy"; experts preferred LearnLM over contemporaneous flagship models (as of 2024-10-01) — [arXiv](https://arxiv.org/html/2412.16429v3)
- "Towards Responsible Development of Generative AI for Education: An Evaluation-Driven Approach" (arXiv 2407.12687, May 2024; v2 Nov 2025) [PRE]: LearnLM-Tutor; seven pedagogical evaluation benchmarks (quantitative, qualitative, automatic and human); educators preferred LearnLM-Tutor over prompted Gemini 1.0 on most pedagogical attributes — [arXiv](https://arxiv.org/html/2407.12687v4)

**Evaluation taxonomies and benchmarks**
- Maurya, Srivatsa, Petukhova, Kochmar (MBZUAI), "Unifying AI Tutor Evaluation: An Evaluation Taxonomy for Pedagogical Ability Assessment of LLM-Powered AI Tutors", NAACL 2025 long paper (pp. 1234–1251) [PEER]: eight pedagogical dimensions around student-mistake remediation (incl. mistake identification, mistake location, providing guidance, actionability); releases MRBench — 192 conversations, 1,596 responses from seven LLM and human tutors, built from MathDial and Bridge, with gold annotations — [ACL Anthology](https://aclanthology.org/2025.naacl-long.57); [arXiv](https://arxiv.org/abs/2412.09416)
- A follow-up shared task automated evaluation of four of these dimensions (mistake identification, location, guidance, actionability); a 2026 paper "Towards Reward Modeling for AI Tutors in Math Mistake Remediation" (arXiv 2603.24375) builds reward models on this line [PRE] — [arXiv](https://arxiv.org/pdf/2603.24375)
- MathTutorBench (Macina et al., ETH Zurich / TU Darmstadt, arXiv 2502.18940, 2025): open-source benchmark covering math expertise, student understanding and pedagogy; includes a reward model that scores scaffolding vs answer-giving; key finding: subject expertise (solving ability) does not automatically translate into good teaching — [arXiv](https://arxiv.org/abs/2502.18940); [alphaXiv overview](https://alphaxiv.org/overview/2502.18940v2). An ACL 2026 long-paper PDF also surfaced for this search (aclanthology 2026.acl-long.1068), but I could not confirm whether it is MathTutorBench's peer-reviewed version — [ACL Anthology PDF](https://aclanthology.org/2026.acl-long.1068.pdf)
- MMTutorBench (Yang et al., Notre Dame, arXiv 2510.23477, Oct 2025) [PRE]: multimodal maths tutoring benchmark, 685 problems, rubric-based LLM-as-a-judge — [arXiv](https://arxiv.org/abs/2510.23477v1)

**RL for teaching ability**
- Dinucu-Jianu, Macina et al., "From Problem-Solving to Teaching Problem-Solving: Aligning LLMs with Pedagogy using Reinforcement Learning", EMNLP 2025 main (oral) [PEER]: defines "pedagogical alignment" (assistant → tutor that withholds answers); online multi-turn RL on simulated dialogues; tutor = Qwen2.5-7B-Instruct, simulated student = fixed Llama-3.1-8B-Instruct, problems from Big-Math; reward = student post-dialogue solve rate + pedagogical quality of guidance; no human annotations; 7B tutor reaches performance similar to LearnLM; tunable reward weight traces a Pareto frontier between pedagogical support and student accuracy — [ACL Anthology](https://aclanthology.org/2025.emnlp-main.15); [arXiv](https://arxiv.org/abs/2505.15607)
- "Effective Personalized AI Tutors via LLM-Guided Reinforcement Learning" (arXiv 2608.16907, 2026) [PRE]: 10 high schools in Taipei, 770 students, maths/Python; both arms had the same GenAI chatbot, only problem sequencing differed; personalized sequencing raised end-of-semester exam by 0.15 SD (isolates the sequencing policy, not the chatbot) [search-summary level] — [arXiv](https://arxiv.org/pdf/2608.16907)

### Inferences
- Technical frontier: the tutor objective is now operationalized as (a) a rubric/taxonomy (Maurya et al.), (b) a learned reward model over that rubric (MathTutorBench, 2603.24375), and (c) RL against simulated students whose downstream success is part of the reward (EMNLP 2025). This is the education analogue of RLHF → RL with verifiable reward.
- Evidence moved from expert preference (arenas) to field RCTs within ~18 months (2024 tech report → 2025 arena → Dec 2025 RCT N=165 → Oct 2026 RCT N=1,179). The consistent pattern: AI ≈ or slightly > supervised human tutoring on proximal outcomes; null or weak effects on distal standardized tests.
- The approval rate of AI drafts by tutors (82.3% → 94.7%) is a de-facto "readiness to remove the human" metric; expect 2027 work on unsupervised deployment.

### Gaps
- Could not verify TutorEval (Chevalier et al., 2024) and the "Pedagogy benchmark" (e.g., CDPK benchmark of teacher pedagogical knowledge) from this session's searches — no sources gathered; omit or verify separately.
- Full text of the Oct 2026 LearnLM/Eedi report and of arXiv 2512.23633 could not be fetched; effect sizes and confidence intervals unverified.
- No confirmed info on BEA 2025 shared-task results/leaderboard.

## 2. Multi-agent systems for education: simulated classrooms, simulated students, knowledge tracing, grading

### Takeaway
Tsinghua's SimClass/MAIC established multi-agent "AI classrooms" (teacher, classmates, manager agents) with real users; the newer technical thrust is making LLM-simulated students *realistically imperfect* by grounding them in knowledge-tracing/IRT state, so they can serve as training environments and evaluators for tutors. Automated grading by LLMs remains highly context-dependent and often weak against human raters on open-ended work.

### Cited Findings
- SimClass, "Simulating Classroom Education with LLM-Empowered Agents" (Tsinghua, arXiv 2406.19226), NAACL 2025 long [PEER]: multi-agent classroom with defined roles (teacher, students, classroom manager) and a session controller; user experiments in two real courses; reports lively teacher–student and student–student interaction and emergent group behaviour (discussion, discipline management); code: THU-MAIC/SimClass — [ACL Anthology preview](https://preview.aclanthology.org/aacl-dois/2025.naacl-long.520); [arXiv](https://arxiv.org/html/2406.19226v2)
- "From MOOC to MAIC: Reshaping Online Teaching and Learning through LLM-driven Agents" (arXiv 2409.03512, Sep 2024) [PRE]: Massive AI-empowered Course — multi-agent support for course preparation, instruction and analysis; preliminary deployment at Tsinghua with >100,000 learning records from >500 students — [arXiv](https://arxiv.org/html/2409.03512v1)
- Classroom Simulacra (arXiv 2502.02780, CHI 2025) [PEER]: contextual student generative agents for online education; frames simulation as knowledge tracing, adds transferable iterative reflection; better captures learning dynamics and inter-student correlations — [arXiv](https://arxiv.org/pdf/2502.02780)
- Agent4Edu (arXiv 2501.10332, 2025) [PRE]: generative agents with profile/memory/action modules produce synthetic learner response data used to evaluate personalized learning / computerized adaptive testing algorithms — [arXiv](https://arxiv.org/pdf/2501.10332)
- BEAGLE (arXiv 2602.13280, 2026) [PRE]: combines semi-Markov model with Bayesian Knowledge Tracing to constrain which concepts a simulated learner may use, targeting the known problem that LLM-simulated students are "too competent"; programming domain — [arXiv](https://arxiv.org/html/2602.13280v1)
- L-HAKT, "Towards LLM-Empowered Knowledge Tracing via LLM-Student Hierarchical Behavior Alignment in Hyperbolic Space", AAAI 2026 [PEER]: LLM-based KT evaluated on four real datasets — [AAAI](https://ojs.aaai.org/index.php/AAAI/article/view/38494)
- "Can LLMs Estimate Student Struggles? Human-AI Difficulty Alignment with Proficiency Simulation for Item Difficulty Prediction" (arXiv 2512.18880, Dec 2025) [PRE] — [arXiv](https://arxiv.org/pdf/2512.18880)
- Review: "Simulating Students with Large Language Models: A Review of Architecture, Mechanisms, and Role Modelling in Education with Generative AI" (arXiv 2511.06078, Nov 2025) [PRE] — [arXiv](https://arxiv.org/pdf/2511.06078)
- Automated grading: synthesis of 65 studies (Jan 2022–Aug 2025; Li et al., arXiv 2512.14561) found LLM–human agreement varies substantially across and within studies; earlier draft reported typical QWK/Pearson/Spearman mostly 0.30–0.80 [PRE] — [arXiv](https://arxiv.org/abs/2512.14561v2)
- Essay scoring with five LLMs incl. GPT-4 and Claude 3.5 vs expert raters: agreement consistently low and non-significant, with criterion-specific biases despite internal consistency (arXiv 2508.02442) [PRE] — [arXiv](https://arxiv.org/pdf/2508.02442v1)
- GPT/Llama essay scoring: models over-score short/underdeveloped essays and under-score longer essays with minor spelling errors (arXiv 2603.23714) [PRE] — [arXiv](https://arxiv.org/html/2603.23714)
- ChatGPT-4o short-answer grading, 557 responses from 215 postgraduates: no meaningful agreement (negative Cohen's kappa), worst on subjective rubric items or specialized knowledge (arXiv 2505.04645) [PRE] — [arXiv](https://arxiv.org/html/2505.04645v1)
- Human–AI disagreement concentrates in mid-quality responses; agreement high at extremes (arXiv 2605.07647, 2026) [PRE] — [arXiv](https://arxiv.org/html/2605.07647)
- RCTs of AI-assisted grading and personalized feedback in large political science classes (PMC12364334) [PEER] — [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12364334/)

### Inferences
- Simulated students are becoming infrastructure: they are the "environment" in RL tutor training (section 1), test beds for adaptive algorithms (Agent4Edu), and item-difficulty estimators. The bottleneck is fidelity — hence KT/BKT/IRT-grounded latent state (BEAGLE, Classroom Simulacra).
- Grading: LLMs are reliable at the extremes and for objective criteria, unreliable mid-range and for subjective/expert rubrics — supports human-in-the-loop grading designs rather than full automation.

### Gaps
- No direct evidence gathered on production "agentic teaching assistants" evaluations (e.g., university TA bots) beyond the above; no data found on SimClass learning-gain effect sizes.

## 3. AI for math/science reasoning: IMO gold, AlphaProof/AlphaGeometry, AlphaEvolve, co-scientist — implications for STEM education

### Takeaway
In July 2025 both Google DeepMind (officially graded) and OpenAI (self-graded) reported IMO gold-level performance with natural-language reasoning models (35/42, 5 of 6 problems); by 2026 DeepMind's AlphaEvolve + Deep Think + AlphaProof pipeline was producing and formalizing new research-level results. For education, the frontier models now exceed most teachers at olympiad problem solving — but section 1 shows solving ability does not transfer to teaching ability.

### Cited Findings
- 21 Jul 2025: advanced Gemini Deep Think officially achieved gold-medal standard at IMO 2025 — solved 5/6 problems, 35 points, graded by IMO coordinators — [Google DeepMind blog](https://deepmind.google/blog/advanced-version-of-gemini-with-deep-think-officially-achieves-gold-medal-standard-at-the-international-mathematical-olympiad/)
- OpenAI announced first (Alexander Wei on X, 19 Jul 2025), but did not enter officially and graded its experimental model itself; same 35/42 score — [Axios](https://www.axios.com/2025/07/21/openai-deepmind-math-olympiad-ai); [Entrepreneur](https://www.entrepreneur.com/business-news/google-openai-models-win-gold-at-high-school-math-contest/494914); [BankInfoSecurity](https://www.bankinfosecurity.com/two-ais-ace-math-olympiad-a-29031)
- Sam Altman: no plans to release a model with IMO-gold capability for many months; Google: Deep Think to trusted testers then AI Ultra subscribers — [Entrepreneur](https://www.entrepreneur.com/business-news/google-openai-models-win-gold-at-high-school-math-contest/494914); [Neowin](https://www.neowin.net/news/googles-gemini-matches-openai-securing-gold-medal-standard-at-math-olympiad)
- AlphaEvolve (Gemini-powered coding agent): on open problems in analysis, combinatorics and geometry matched known optimum in ~75% of cases and beat best known in ~20%; raised kissing-number lower bound in 11 dimensions 592 → 593; outputs must be machine-checkable — [IEEE Spectrum](https://spectrum.ieee.org/deepmind-alphaevolve)
- Tao / Gómez-Serrano collaboration on 67 problems: AlphaEvolve found a new construction for finite-field Kakeya, Gemini Deep Think proved it, AlphaProof formalized the proof — an end-to-end discover→prove→verify pipeline — [Decrypt](https://decrypt.co/347586/google-deepmind-alphaevolve-ai-new-paths-unsolved-math-problems)
- May 2026 AlphaEvolve impact report: moved from pilot to core part of Google infrastructure; Google researchers call initial theoretical-CS results "far from conclusive" — [DeepMind](https://deepmind.google/blog/alphaevolve-impact/); [Google Research](https://research.google/blog/ai-as-a-research-partner-advancing-theoretical-computer-science-with-alphaevolve/)

### Inferences
- Implication for STEM education: answer-generation is commoditized at olympiad level, so the value shifts to (a) pedagogical alignment (withholding answers, scaffolding), (b) formal verification as feedback (Lean/AlphaProof-style checking could give students verified step-level feedback), (c) teaching problem formulation and verification rather than computation.
- The IMO results intensify the "crutch" risk documented in section 4 (Bastani et al.): stronger solvers make unguarded use more damaging to learning.

### Gaps
- No sources gathered on AlphaProof/AlphaGeometry 2 Nature paper details, or on Google's "AI co-scientist" (Feb 2025) beyond a mention that AlphaEvolve may be coupled with it — [IEEE Spectrum](https://spectrum.ieee.org/amp/deepmind-alphaevolve-2672018683). No peer-reviewed study found on educational use of IMO-level models.

## 4. Learning-science grounded design: guardrails, productive struggle, metacognition, personalization, field evidence

### Takeaway
The strongest causal evidence (PNAS 2025, multiple 2025–2026 RCTs) says: unguarded GenAI boosts practice performance but harms unassisted learning; pedagogically designed tutors (Socratic, answer-withholding, grounded in research-based design) can match or beat active learning, but course-integrated deployment can also hurt grades. Design, not access, is the variable.

### Cited Findings
- Bastani et al., "Generative AI without guardrails can harm learning: Evidence from high school mathematics", PNAS 122(26), 2025 [PEER]: ~1,000 high-school students; GPT Base (ChatGPT-like) vs GPT Tutor (learning-safeguard prompts); practice gains +48% (Base) and +127% (Tutor); on the unassisted exam Base scored 17% worse than control, Tutor ≈ control; students used Base as a "crutch" — [Wharton Knowledge](https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education); [RePEc](https://ideas.repec.org/a/nas/journl/v122y2025pe2422633122.html); [SSRN preprint](https://papers.ssrn.com/abstract=4895486)
- Kestin et al., "AI tutoring outperforms in-class active learning", Scientific Reports 15:17458, 3 Jun 2025 [PEER]: 194 Harvard undergrads (Physical Sciences 2), crossover RCT; AI tutor built on research-based pedagogy; students learned significantly more in less time and reported more engagement; linear-regression effect size 0.63 (authors say underestimated due to ceiling); median post-test 4.5 vs 3.5 — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/). Quantile-based 0.73–1.3 SD is reported by secondary sources (also cited in OECD Digital Education Outlook 2026) — [etcjournal review](https://etcjournal.com/2025/11/10/review-of-kestin-et-al-s-june-2025-harvard-study-on-ai-tutoring/); [OECD DEO 2026](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/01/oecd-digital-education-outlook-2026_940e0dd8/062a7394-en.pdf)
- Negative counter-evidence: "The Effects of Course-Integrated AI Tutoring on Student Performance and Engagement: A Randomized University Trial" (EdWorkingPapers ai26-1598, 2026) [PRE]: 2,379 undergraduates; access to the AI tutor *reduced* final course grades by 0.27–0.37 SD — [EdWorkingPapers](https://edworkingpapers.com/sites/default/files/ai26-1598.pdf)
- Journal of Economic Education (2026) [PEER]: structured AI tutoring and study groups in macroeconomics; all treatments beat control, combined GenAI + group work largest — [T&F](https://doi.org/10.1080/00220485.2026.2695361)
- Nursing anatomy RCT (2026, PubMed) [PEER]: 301 students, knowledge-graph-integrated GenAI tutor; module scores 82.5 vs 77.6 (blended) vs 74.1 (traditional) — [PubMed](https://pubmed.ncbi.nlm.nih.gov/42174555/)
- "Experimental Evidence on the Learning Impact of Generative AI" (arXiv 2607.08849, 2026) [PRE]: review of 2023–2026 experiments; notes nearly all compare AI access vs no-AI control on unassisted assessments — [arXiv](https://arxiv.org/pdf/2607.08849)
- Kosmyna et al. (MIT Media Lab), "Your Brain on ChatGPT" (arXiv 2506.08872, Jun 2025, rev. Dec 2025) [PRE]: EEG, 54 participants (LLM / search / brain-only essay writing); LLM users showed weakest neural connectivity and lowest essay ownership; session 4 had only 18 participants; media claims of "cognitive debt" go beyond the abstract — [arXiv](https://arxiv.org/abs/2506.08872)
- Overreliance: "Overreliance Under Incorrect LLM Tutoring Feedback" (Zourlidou et al.) won Best Paper at AIET 2026 (Zagreb) — students over-rely on incorrect feedback from a solution-based LLM tutor — [Uni Koblenz](https://www.uni-koblenz.de/de/informatik/west/news/ai-in-education-institute-west-researchers-receive-best-paper-award-at-aiet-2026)
- Microsoft Research MSR-TR-2025-42 "Learning outcomes with GenAI in the classroom: A review of empirical evidence" (Oct 2025) [PRE/tech report]: four guidelines, incl. avoid introducing GenAI before students master domain basics — [Microsoft Research](https://www.microsoft.com/en-us/research/publication/learning-outcomes-with-genai-in-the-classroom-a-review-of-empirical-evidence/)
- McLaren & VanLehn, AIED 2026 position paper ("VanLehn's two loops aren't enough"): argues instructional form should be a runtime control variable for AI tutors (beyond the classic inner/outer loop of ITS) — [CMU PDF](https://www.cs.cmu.edu/afs/cs.cmu.edu/Web/People/bmclaren/pubs/McLaren-VanLehnsTwoLoops%20ArentEnough-AIED2026.pdf)

### Inferences
- "Productive struggle" is now operationalized in LLMs mainly as answer-withholding/Socratic constraints (Bastani GPT Tutor, LearnLM instructions, RL pedagogical reward). Metacognition and retrieval/spacing are handled mostly by the outer loop (sequencing; cf. 0.15 SD from personalized sequencing in 2608.16907) rather than the chat model itself.
- Heterogeneous results (+0.63 SD Harvard vs −0.27–0.37 SD course-integrated) suggest moderators: pedagogical design of the bot, whether students can bypass it with general chatbots, and the timing relative to domain basics.

### Gaps
- No primary sources gathered on LLM implementations of spaced repetition/retrieval practice, affective computing/emotion detection in LLM tutors, or OpenAI Study Mode / Anthropic Claude learning mode research evaluations.

## 5. Key surveys/reviews and venues 2024–2026

### Takeaway
Core reference set: Chu et al. survey (EMNLP 2025 Findings), Yan et al. Nature Human Behaviour Perspective (2024), MSR review (2025), OECD Digital Education Outlook 2026, the student-simulation review (2025), the LLM grading synthesis (2025). Main venues: AIED 2026 (Seoul), NAACL/EMNLP/ACL (BEA workshop), CHI, AAAI/IJCAI.

### Cited Findings
- Chu et al., "LLM Agents for Education: Advances and Applications" (arXiv 2503.11733; EMNLP 2025 Findings pp. 13782–13810; revised Feb 2026) [PEER]: taxonomy of Pedagogical Agents (automating teaching tasks such as feedback generation, curriculum design) vs domain-specific agents (language learning, science); discusses hallucination, ethics, ecosystem integration — [ACL Anthology](https://aclanthology.org/2025.findings-emnlp.743); [arXiv](https://arxiv.org/abs/2503.11733)
- Yan, Greiff, Teuber, Gašević, "Promises and challenges of generative artificial intelligence for human learning", Nature Human Behaviour 8(10):1839–1850, Oct 2024 [PEER]: personalized support, diverse materials, timely feedback, assessment innovation vs model imperfections, ethics, assessment disruption; GenAI must be "an ally, not a crutch" — [Monash](https://research.monash.edu/en/publications/promises-and-challenges-of-generative-artificial-intelligence-for/); [arXiv](https://arxiv.org/pdf/2408.12143)
- OECD Digital Education Outlook 2026 (Jan 2026) — [OECD](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/01/oecd-digital-education-outlook-2026_940e0dd8/062a7394-en.pdf)
- AIED 2026: 27th International Conference, Seoul, 27 Jun–3 Jul 2026; Springer CCIS vol. 3032 — [Monash preface](https://research.monash.edu/en/publications/preface-388/); AIED 2026 workshop example: [UW–Madison TRAIL](https://trail.wcer.wisc.edu/workshops/workshop-aibat-aied2026)
- AIED 2025 main track accepted papers list — [AIED 2025](https://aied2025.itd.cnr.it/?p=695)
- Peer-reviewed NLP venues dominate tutor-modeling work: NAACL 2025 (Maurya et al.; SimClass), EMNLP 2025 (RL tutor; Chu survey), ACL 2026, AACL 2026 — [ACL Anthology](https://aclanthology.org/2025.naacl-long.57); [ACL Anthology](https://aclanthology.org/2025.emnlp-main.15)

### Inferences
- The center of gravity for "how to build tutors" has shifted to NLP/ML venues (ACL/EMNLP/NeurIPS), while AIED/L@S/EDM carry learning-outcome and ITS-architecture work; field RCTs increasingly appear in econ/edu working papers (EdWorkingPapers, PNAS) and industry preprints.
- Direction 2026→2027: (1) RL tutors trained against KT-grounded simulated students; (2) reward models from pedagogy taxonomies; (3) large pre-registered RCTs with distal outcomes; (4) reducing human supervision; (5) formal verification as feedback in math.

### Gaps
- Could not retrieve AIED 2026, EDM 2026 or L@S 2026 award lists; no NeurIPS 2025/2026 education-workshop papers gathered. No 2025–2026 Nature Reviews piece on AI and learning found in searches.
