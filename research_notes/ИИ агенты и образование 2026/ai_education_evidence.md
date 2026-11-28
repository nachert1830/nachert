# Scientific evidence on AI / generative AI (LLM) tutors in education — state of evidence as of late 2026

Notes compiled 2026-11-28. Notes are in English; the report will be in Russian. Status labels: [PR] = peer-reviewed, [WP] = working paper / preprint, [RETRACTED].
Method caveat: several primary hosts (PMC, IZA, voxdev, edworkingpapers, plagiarismtoday) could not be fetched from this session, so some numbers rest on search snippets or secondary coverage. Each such case is flagged.

## 1. Major RCTs (2024–2026), newest first

### Takeaway
RCT evidence is now clearly **mixed and design-dependent**. Positive results come from tightly structured, pedagogy-scaffolded tutors used in supervised settings: Harvard physics (~0.63 SD, likely more), Nigeria (0.23 SD in English), Tutor CoPilot (+4 pp mastery). Null or negative results come from open, unstructured access: Bastani GPT Base (−17% on the exam), the University of Maryland course tutor (−0.27 to −0.37 SD on grades, 2026), Khanmigo in Tennessee (~0.06–0.08 SD, roughly the same as non-AI practice), and the Eedi/DeepMind scale-up (null on a standardized test). The newest large trials (2026) are notably less positive than the 2024–2025 headline studies.

### Cited Findings

**University of Maryland: course-integrated GenAI tutor (Liu, Sweet et al., 2026) [WP: IZA DP 18989 / EdWorkingPaper 26-1598]. NEGATIVE**
- RCT with 2,379 undergraduates and 30 instructors across multiple disciplines at a large US public university. The tutor was grounded in materials the instructors selected. — [IZA DP 18989](https://www.iza.org/publications/dp/18989/the-effects-of-course-integrated-ai-tutoring-student-performance-and-engagement-a-randomized-university-trial)
- Tutor access **reduced final grades by 0.37 SD** (range 0.27–0.37 SD across specifications; the clearest estimate is in the exact-match sample) and **reduced LMS participation by 0.90 SD**. There was no measurable change in homework scores. Losses were larger for first-generation students (news coverage says about 2x; the authors caution against reading too much into subgroups). — [IZA DP 18989](https://www.iza.org/publications/dp/18989/the-effects-of-course-integrated-ai-tutoring-student-performance-and-engagement-a-randomized-university-trial); [EdTech Innovation Hub](https://www.edtechinnovationhub.com/news/students-offered-an-ai-tutor-got-lower-grades-and-disengaged-from-course-materials-university-of-maryland-trial-finds); [EdWorkingPapers 26-1598](https://edworkingpapers.com/ai26-1598)
- Discrepancy: Hechinger Report describes about 1,100 treated vs 1,200 control students and a grade drop of about 0.11 points on the 4-point scale. This is not verified against the paper. — [Hechinger Report](https://hechingerreport.org/proof-points-ai-tutor-results/)

**Khanmigo, Tennessee middle schools (Oreopoulos & Low, 2026) [WP: NBER w35620]. SMALL / NULL ADDED VALUE**
- Two-year cluster RCT in daily remedial math classes. The NBER abstract says 18 schools; a May 2026 registry draft says 20. Khanmigo was configured to coach rather than give answers. — [NBER w35620](https://www.nber.org/papers/w35620); [AEA registry draft](https://www.socialscienceregistry.org/versions/305435/docs/version/document)
- Effect: **+1.3 national percentile ranks per term, about 0.06–0.08 SD per school year**. The authors say this is similar to gains from Khan Academy practice without AI. Usage was low: the median student messaged Khanmigo on only one-third of practice days, and in only 17% of exercise sessions that contained a mistake. — [Stanford SCALE summary](https://scale.stanford.edu/ai/repository/one-click-away-ai-tutoring-khanmigo-two-year-school-experiment); [Hechinger](https://hechingerreport.org/proof-points-khanmigo-math-ai-tutor/)
- Sal Khan's rebuttal: the "treatment-on-the-treated"-style reading is about 0.14 SD. About 2 in 5 students graduated out of the remedial program but stayed in the analysis ("once in, always in"). The version tested was the 2023 release. — [Khan Academy blog](https://blog.khanacademy.org/?p=22104)
- Qualitative finding: students did not want answers withheld, but they also did not want Socratic questions. Engagement was the bottleneck. — [KQED MindShift](https://www.kqed.org/mindshift/66662/students-didnt-get-answers-from-khanmigo-they-didnt-want-its-questions-either); [FutureEd](https://www.future-ed.org/students-tried-khanmigos-ai-tutor-most-didnt-want-its-help/)

**Eedi × Google DeepMind (LearnLM), UK secondary maths [WP / company report]**
- Exploratory RCT (May–June 2025, arXiv Dec 2025): 165 students in 5 UK schools. LearnLM with a human in the loop performed **at least as well as human tutors** on every outcome. Expert tutors approved 82.3% of AI messages with no or minimal edits. The audit found 0 harmful messages and 0.1% of messages with factual inaccuracies. — [arXiv 2512.23633](https://arxiv.org/abs/2512.23633v1); [Eedi press release](https://www.eedi.com/news/new-exploratory-research-from-eedi-and-google-deepmind-reveals-human-in-the-loop-ai-tutoring-outperforms-human-only-support)
- Expanded 2026 trial: 1,179 students, 10 UK state schools, 10 weeks. The AI matched expert human tutors at fixing in-the-moment misconceptions. But on the standardized **Star Maths test (n=916), AI-tutored students scored about the same as the "static practice" control**. Press coverage reports possible gains for girls and possible harm for boys. This is from secondary coverage only and not verified. — [The 74](https://www.the74million.org/article/five-things-you-should-know-about-new-ai-tutor-study/)

**Taipei high schools, adaptive LLM-guided practice sequencing (2026) [WP: arXiv, July 2026]**
- 770 students, 10 high schools. **+0.15 SD on unassisted end-of-semester exams.** This tests a sequencing algorithm, not a chatbot. Search output flagged that the arXiv ID should be verified. — [arXiv 2608.16907](https://arxiv.org/pdf/2608.16907)

**Harvard physics AI tutor (Kestin, Miller, Klales, Milbourne, Ponti), Scientific Reports, June 2025 [PR]. POSITIVE**
- RCT (crossover design) with **194 undergraduates** in an introductory physics course at Harvard. A custom GPT-4-based tutor built on pedagogical best practices was compared with a research-based **in-class active-learning** lesson (not passive lecture). — [Nature / Sci Rep](https://www.nature.com/articles/s41598-025-97652-6); [Harvard SERL](https://serl.fas.harvard.edu/publication/ai-tutoring-outperforms-class-active-learning-rct-introducing-novel-research-based)
- Effect size **0.63 SD** from linear regression. The authors say this underestimates the true effect because of a post-test ceiling. Their quantile regression gives larger values; a secondary source reports roughly 0.73–1.3 SD, which is unverified. Median learning gains were more than double those of the active-learning group. Median time on task was about 49 min with the AI vs 60 min in class (secondary source). Students reported higher engagement and motivation. — [Stanford SCALE summary](https://scale.stanford.edu/publications/ai-tutoring-outperforms-active-learning); [GadgetReview (secondary)](https://www.gadgetreview.com/?p=415262)
- Limitations: one elite institution, a single short lesson, and immediate post-test only, with no long-term retention measured.

**Bastani, Bastani, Sungu, Ge, Kabakcı, Mariman: "Generative AI without guardrails can harm learning," PNAS 122(26), 2025 [PR; SSRN preprint 2024 titled "Generative AI Can Harm Learning"]. NEGATIVE for unguarded AI**
- Field experiment with nearly 1,000 high school math students in Turkey. Three arms: control, **GPT Base** (ChatGPT-like GPT-4 interface), and **GPT Tutor** (prompts that protect learning: teacher-designed hints, no direct answers). — [PNAS via RePEc](https://ideas.repec.org/a/nas/journl/v122y2025pe2422633122.html); [SSRN](https://papers.ssrn.com/abstract=4895486)
- During assisted practice: GPT Base **+48%**, GPT Tutor **+127%** vs control. On the unassisted exam afterwards: GPT Base **−17%** vs control; GPT Tutor **no significant difference** from control (the harm was mitigated, but there was no net gain). Most GPT Base students simply asked for answers. GPT Tutor users overestimated how well they had learned. — [Wharton Knowledge](https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education/); [PsyPost](https://www.psypost.org/unrestricted-generative-ai-harms-high-school-math-learning-by-acting-as-a-crutch/)

**World Bank Nigeria "From Chalkboards to Chatbots" (De Simone et al., 2025) [WP: World Bank Policy Research WP 11125]. POSITIVE**
- Six-week after-school program, June–July 2024, Benin City, Edo State. First-year senior secondary students in 9 public schools, randomized. Students worked **in pairs with Microsoft Copilot (GPT-4) under teacher supervision**, using prompts designed to promote reasoning rather than shortcuts. — [World Bank OKR](https://openknowledge.worldbank.org/entities/publication/15e1ff08-15ae-4f7a-b2a8-d146e6c113ee/full); [World Bank blog](https://blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria)
- Effects: **English 0.23 SD** (primary outcome). **Composite (English + AI knowledge + digital skills) about 0.31 SD**, which is the source of the "0.3 SD" figure. The **end-of-year third-term exam** (whole-year content) showed an ITT effect of **0.21 SD**. Gains are equivalent to 1.5–2 years of business-as-usual learning. The program outperformed 80% of interventions in a database of developing-country RCTs. Dose-response: gains grew with each session attended. The authors project 1.2–2.2 SD for a full year (an extrapolation). — [World Bank OKR](https://openknowledge.worldbank.org/bitstreams/cd9cca5b-2ffd-4be1-8313-0f4d2ed6ef4f/download); [World Bank Let's Talk Development](https://blogs.worldbank.org/en/developmenttalk/addressing-the-learning-crisis-with-generative-ai--lessons-from-); [IZA DP 19025](https://docs.iza.org/dp19025.pdf)
- Caveats: uneven attendance (floods, teacher strikes, work). Persistence beyond the program is unknown. Not yet peer-reviewed.

**Tutor CoPilot (Wang, Ribeiro, Robinson, Loeb, Demszky; Stanford NSSA, 2024–2025) [WP: arXiv 2410.03017; J-PAL]. POSITIVE (human–AI)**
- An LLM gives real-time pedagogical suggestions to *human* tutors, not to students. v2: 900 tutors and 1,800 K-12 students in underserved communities. v1 / J-PAL: 783 tutors and 1,013 students. — [arXiv 2410.03017](https://arxiv.org/abs/2410.03017); [J-PAL](https://www.povertyactionlab.org/evaluation/human-ai-cooperation-improve-tutoring-united-states)
- Students were **+4 percentage points** more likely to master topics (p<0.01). With lower-rated tutors, the gain was **up to +9 pp** (65% vs 56%). Cost: about **$20 per tutor per year**. Tutors used more high-quality strategies (guiding questions) and gave away answers less often. — [Stanford NSSA](https://nssa.stanford.edu/studies/tutor-copilot-human-ai-approach-scaling-real-time-expertise)

**Fan et al., "Beware of metacognitive laziness," BJET 56(2), 2025 [PR]**
- Lab RCT with 117 university students writing essays, 4 arms: ChatGPT, human writing coach, checklist toolkit, no support. The ChatGPT group had the **biggest essay-score improvement**, but **no greater knowledge gain or transfer** and no higher motivation. Process data showed students offloading metacognition (planning, monitoring) to the AI. — [arXiv 2412.09315](https://arxiv.org/abs/2412.09315v1); [Stanford SCALE](https://scale.stanford.edu/ai/repository/beware-metacognitive-laziness-effects-generative-artificial-intelligence-learning)

**Other RCTs found but not examined in depth**
- GPT-4 as a homework tutor in schools (arXiv 2409.15981): reports improved outcomes and engagement. — [arXiv](https://arxiv.org/html/2409.15981v1)
- AI-assisted grading and personalized feedback in large political science classes (RCTs, PMC12364334). — [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12364334/)

### Inferences
- The pattern across RCTs is that performance *during* AI-assisted work is consistently inflated (Bastani +48% and +127%, Fan's essay scores). Learning measured *without* AI is what matters, and there the effect ranges from negative to modest.
- Positive studies share several features: a structured curriculum, pre-written expert solutions or scaffolds, teacher supervision or a human in the loop, and short, focused tasks. Negative or null studies tend to offer open access, rely on student choice of whether and how to use the tool, and run in college or self-directed settings where students can offload work.
- 2026 trials (Maryland, Khanmigo, Eedi scale-up) are larger and longer. Their weaker results suggest the early headline effects may shrink at scale, a common pattern in education RCTs.

### Gaps
- Exact quantile-regression ES and CI for Kestin et al.: the primary text could not be fetched.
- Peer-review status of the Maryland and Khanmigo papers: both are working papers as of Nov 2026.
- Primary data for the Eedi 2026 scale-up, including the gender subgroup result.
- Long-term retention (months to years) is missing in nearly all GenAI tutoring RCTs.

## 2. Meta-analyses of ChatGPT / GenAI effects on learning

### Takeaway
Pooled effects in GenAI meta-analyses are implausibly large (g ≈ 0.57–1.2). They rest mostly on small quasi-experiments with researcher-made tests and weak control conditions. The most-cited one, **Wang & Fan (2025), g = 0.867, was RETRACTED on 22 April 2026**. These pooled figures should be treated as upper bounds, not as estimates comparable to RCTs.

### Cited Findings
- **Wang, J. & Fan, W. (2025), Humanities & Social Sciences Communications [RETRACTED 22 Apr 2026].** Covered 51 experimental and quasi-experimental studies (Nov 2022 – Feb 2025). Reported learning performance **g = 0.867**, learning perception g = 0.456, and higher-order thinking g = 0.457. The retraction notice cites "discrepancies in the meta-analysis" that "undermine the Editor's confidence in the validity of the analysis and the conclusions drawn from it." Ingebrigtsen & Lukic published a critique titled "Substantial Errors Invalidate the Conclusion from Wang and Fan (2025)." — [GovTech](https://www.govtech.com/education/nature-retracts-oft-cited-paper-on-positive-impact-of-chatgpt); [Plagiarism Today, Jul 2026](https://www.plagiarismtoday.com/2026/07/15/study-claiming-ai-helps-students-learn-retracted/); [EdTech Innovation Hub (original coverage)](https://www.edtechinnovationhub.com/news/study-finds-chatgpt-improves-student-outcomes-but-shows-limitations-in-complex-thinking-tasks)
- **Deng, Jiang, Yu, Lu, Liu (2025), Computers & Education 227:105224 [PR].** "Does ChatGPT enhance student learning?" Sources report 69 studies (2022–2024), while one critique says 62. Finds ChatGPT improves academic performance, affective-motivational states and higher-order thinking propensities, **reduces mental effort**, and has **no significant effect on self-efficacy**. I could not retrieve the pooled ES. — [UMPI CTL summary](https://www.umpi.edu/ctl/?p=5058); [bibbase](https://bibbase.org/network/publication/deng-jiang-yu-lu-liu-doeschatgptenhancestudentlearningasystematicreviewandmetaanalysisofexperimentalstudies-2025)
- **Critique: "Beyond the Headlines: Why We Should Be Cautious Interpreting Research on ChatGPT's Impact on Student Learning"** (Open Universiteit; Lawson et al.). Argues that comparison-group confounds (ChatGPT vs no support at all, rather than vs an equivalent non-AI intervention), novelty effects and methodological weaknesses inflate the Deng and Wang & Fan estimates. A 2026 Computers & Education article (S0360131526001405) appears to continue this critique; it was not fetched. — [Open Universiteit](https://research.ou.nl/en/publications/beyond-the-headlines-why-we-should-be-cautious-interpreting-resea/)
- Other pooled estimates (snippet-level; verify before citing):
  - 19 studies / 24 ES: **g = 0.683**. — [SAGE, J. Educ. Computing Research](https://journals.sagepub.com/doi/10.1177/07356331251349620)
  - 21 studies / 44 ES: **g = 0.572**. Small samples gave g = 1.216; **self-developed tests g = 0.984 vs standardized tests g = 0.557**. — [Evaluating the effects of GenAI on student learning outcomes](https://library.kab.ac.ug/Record/doaj-art-74e4241c1d154787bc45c4f3683f799e/Description)
  - "Transforming Learning or Empty Promise?" [preprint, Research Square]: **g = 1.193**, with large heterogeneity. — [Research Square](https://assets-eu.researchsquare.com/files/rs-7577394/v1/15335396298c3f818f0fbef8.html)
  - GenAI feedback, 36 studies: **ES ≈ 0.61**. Egger's test was not significant, but there was visual funnel asymmetry. — [EdUHK repository](https://repository.eduhk.hk/en/publications/effects-of-genai-interventions-on-student-academic-performance-a-/)
  - LLM effects across qualification / socialisation / subjectification [arXiv 2509.22725]. — [arXiv](https://arxiv.org/html/2509.22725v1)
  - GenAI in programming, productivity vs learning [arXiv 2605.04779, 2026]: no publication bias in the learning outcome by Egger's test or trim-and-fill. — [arXiv](https://arxiv.org/pdf/2605.04779)

### Inferences
- Comparison: the best RCTs give 0.06–0.3 SD (Khanmigo, Nigeria) or negative effects (Maryland, Bastani GPT Base). Meta-analytic g values of 0.6–1.2 are 3–10x larger. This gap is the classic signature of small-study effects, researcher-made outcome measures and "AI vs nothing" control groups.
- Most primary studies measure performance *with* AI assistance or immediately afterwards, and rarely test unassisted transfer.

### Gaps
- No high-quality RCT-only meta-analysis of GenAI tutors was found as of Nov 2026.
- The pooled ES of Deng et al. (2025) was not retrieved.

## 3. Cognitive effects: cognitive debt, critical thinking, offloading, metacognitive laziness

### Takeaway
Several studies point the same way: AI use lowers cognitive effort and engagement, and frequent users self-report less critical thinking. But the evidence is **correlational or small-sample and partly not peer-reviewed** (MIT EEG). Causal evidence that general cognitive ability declines does not exist. The most robust causal evidence of harm to learning comes from education RCTs (Bastani, Maryland, Fan).

### Cited Findings
- **Kosmyna et al. (MIT Media Lab), "Your Brain on ChatGPT: Accumulation of Cognitive Debt…" (arXiv 2506.08872, June 2025) [WP, not peer-reviewed]**
  - 54 participants (60 recruited, aged 18–39, from 5 Boston-area universities) wrote essays in 3 groups: LLM (GPT-4o), search engine, and brain-only. Only 18 took part in the 4th crossover session. — [arXiv](https://arxiv.org/abs/2506.08872); [MIT Media Lab](https://www.media.mit.edu/publications/your-brain-on-chatgpt/); [Scientific American](https://www.scientificamerican.com/article/does-using-chatgpt-really-change-your-brain-activity/)
  - EEG brain connectivity was strongest in the brain-only group, intermediate with search, and **weakest with the LLM**. LLM users engaged less over the sessions, often could not quote their own essays, and felt less ownership. In session 4, LLM→brain-only switchers showed weaker connectivity than experienced brain-only writers. — [MIT Media Lab](https://www.media.mit.edu/projects/your-brain-on-chatgpt/overview/)
  - Caveats: small n, preprint status, limited EEG methodology (connectivity only, low spatial resolution). Kosmyna herself said the study does not show "dumbness in the brain… no brain on vacation." — [Scientific American](https://www.scientificamerican.com/article/does-using-chatgpt-really-change-your-brain-activity/)
- **Lee, Sarkar et al. (Microsoft Research + CMU), CHI 2025 [PR, conference]**: "The Impact of Generative AI on Critical Thinking: Self-Reported Reductions in Cognitive Effort and Confidence Effects." **319 knowledge workers, 936 examples.** Higher confidence in GenAI was associated with *less* critical thinking; higher self-confidence was associated with *more*. Critical thinking shifts toward verification, integrating responses and overseeing tasks. — [Paper PDF](https://advait.org/files/lee_2025_ai_critical_thinking_survey.pdf); [Microsoft Research](https://www.microsoft.com/en-us/research/?p=1135061); [The Register](https://www.theregister.com/2025/02/11/microsoft_study_ai_critical_thinking/)
- **Gerlich, M. (2025), "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking," Societies 15(1), Jan 2025 [PR]**: survey plus interviews, **n = 666**. Significant **negative correlation between frequent AI use and critical thinking, mediated by cognitive offloading**. Younger users (17–25) used AI the most and had the lowest critical-thinking scores. The design is correlational and self-reported. — [DOAJ](https://doaj.org/article/d5c17dd91ce64775a065095d8af730ce); [PsyPost](https://www.psypost.org/ai-tools-may-weaken-critical-thinking-skills-by-encouraging-cognitive-offloading-study-suggests/)
- **Fan et al. (2025), BJET, "metacognitive laziness"**: see Section 1. Better task output, but no gain in learning or transfer. — [arXiv](https://arxiv.org/abs/2412.09315v1)
- Deng et al. (2025) meta-analysis: ChatGPT **reduces mental effort**. Whether this is efficiency or desirable difficulty being lost is ambiguous. — [UMPI CTL](https://www.umpi.edu/ctl/?p=5058)
- EDUCAUSE Review (Dec 2025), "The Paradox of AI Assistance: Better Results, Worse Thinking" (commentary synthesis). — [EDUCAUSE](https://er.educause.edu/articles/2025/12/the-paradox-of-ai-assistance-better-results-worse-thinking)

### Inferences
- These findings fit the learning-science concepts of "desirable difficulties" and the generation effect. Offloading the generative step (writing, solving) removes the process that produces learning, even when the output improves.
- Moderators repeat across studies: self-confidence, AI trust and age. Younger, less confident learners appear most prone to offloading.

### Gaps
- No peer-reviewed version of the MIT EEG study has been confirmed as of Nov 2026.
- No longitudinal causal study of AI use on general critical-thinking ability was found.

## 4. Bloom's 2-sigma problem vs the human tutoring and AI tutoring evidence

### Takeaway
Bloom's 2 SD figure is not a realistic benchmark. Rigorous meta-analysis puts human tutoring at about **0.29–0.37 SD**. The best positive AI tutor results (Nigeria 0.23 SD, Harvard 0.63+ SD on a short lesson, Tutor CoPilot +4 pp) fall in the same range as human tutoring or below it. Large-scale AI deployments (Khanmigo 0.06–0.08 SD) are far below it.

### Cited Findings
- Bloom (1984) placed one-to-one tutoring at **2.00 SD**. Von Hippel (Education Next, Spring 2024) found that of 65 tutoring studies reviewed, only one reported a 2-sigma effect: a 1972 dissertation with 32 tutored students. Bloom's Figure 1 "wasn't fit to actual data." The tutored students also received extra testing and feedback, which may explain about half the effect. Von Hippel: "It seems rash… to promise two-sigma effects from AI when human tutoring has rarely produced such large effects." — [Education Next](https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/)
- **Nickow, Oreopoulos & Quan**: NBER WP 27476 (2020) found a pooled effect of **0.37 SD** across 96 RCTs of PreK-12 tutoring. A later version (2024, Stanford NSSA / American Educational Research Journal line) found **0.288 SD (SE 0.029) across 89 RCTs**. Effects are larger for teacher or paraprofessional tutors, for tutoring during the school day, and in earlier grades. — [NBER](https://www.nber.org/papers/w27476); [Stanford NSSA](https://nssa.stanford.edu/studies/promise-tutoring-prek-12-learning-systematic-review-and-metaanalysis-experimental-evidence); [J-PAL evidence review](https://www.povertyactionlab.org/sites/default/files/publication/Evidence-Review_The-Transformative-Potential-of-Tutoring.pdf)
- Benchmark: most education interventions yield ≤0.1 SD (Kraft, cited by von Hippel). — [Education Next](https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/)
- Direct AI vs human comparisons:
  - Eedi/DeepMind pilot: AI with a human in the loop was **at least as good as** human tutors. — [arXiv 2512.23633](https://arxiv.org/abs/2512.23633v1)
  - Fan et al.: ChatGPT gave better essays than a human coach, but no difference in learning. — [arXiv](https://arxiv.org/abs/2412.09315v1)
  - Tutor CoPilot: AI as augmentation of human tutors. — [arXiv](https://arxiv.org/abs/2410.03017)

### Inferences
- The realistic goal for AI tutoring is to approximate human tutoring (about 0.3 SD) at a far lower cost (Tutor CoPilot $20 per tutor per year; Nigeria's cost-effectiveness), not to reach 2 sigma.
- Human-AI hybrid models currently have the most consistent positive evidence (Tutor CoPilot, Eedi human-in-the-loop, Nigeria's teacher-supervised pairs).

### Gaps
- No head-to-head RCT of a fully autonomous AI tutor vs a trained human tutor at scale, with standardized outcomes, was found.

## 5. Design features: what makes AI tutors effective vs harmful

### Takeaway
Effective designs (1) withhold direct answers and scaffold step-by-step reasoning; (2) are grounded in expert-written solutions and curriculum; (3) are embedded in a supervised or structured setting, with a human in the loop where possible; and (4) get students to actually engage. Socratic prompting alone is not enough when students opt out of using the tool (Khanmigo) or when access is optional and replaces effort (Maryland).

### Cited Findings
- **Guardrails / no direct answers**: Bastani's GPT Tutor (teacher hints, answers withheld) eliminated the −17% harm of GPT Base but produced no net gain. Guardrails are necessary but not sufficient. — [Wharton Knowledge](https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education/)
- **Pedagogy-informed design**: The Harvard tutor was built on research-based best practices (active learning, managing cognitive load, growth mindset, scaffolding, accurate feedback, self-pacing), with pre-written step-by-step solutions in the prompt to limit hallucinations. — [Nature / Sci Rep](https://www.nature.com/articles/s41598-025-97652-6); [Stanford SCALE](https://scale.stanford.edu/publications/ai-tutoring-outperforms-active-learning)
- **Teacher supervision + structured prompts + pair work**: Nigeria program. — [World Bank blog](https://blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria)
- **Human-in-the-loop / AI augmenting humans**: Tutor CoPilot (biggest gains with weaker tutors) and Eedi (82.3% of AI messages approved with minimal edits). — [J-PAL](https://www.povertyactionlab.org/evaluation/human-ai-cooperation-improve-tutoring-united-states); [arXiv 2512.23633](https://arxiv.org/abs/2512.23633v1)
- **Engagement is the binding constraint**: Khanmigo users messaged the tutor in only 17% of sessions with errors. Students wanted neither answers withheld nor Socratic questioning. — [Stanford SCALE](https://scale.stanford.edu/ai/repository/one-click-away-ai-tutoring-khanmigo-two-year-school-experiment); [KQED](https://www.kqed.org/mindshift/66662/students-didnt-get-answers-from-khanmigo-they-didnt-want-its-questions-either)
- **Optional course-integrated access can crowd out effort**: Maryland's tutor was grounded in course materials yet lowered grades and LMS engagement, with larger losses for first-generation students. Grounding alone does not ensure learning. — [IZA DP 18989](https://www.iza.org/publications/dp/18989/the-effects-of-course-integrated-ai-tutoring-student-performance-and-engagement-a-randomized-university-trial)
- **Adaptive sequencing (non-chat) is an alternative mechanism**: Taipei, +0.15 SD. — [arXiv 2608.16907](https://arxiv.org/pdf/2608.16907)
- Age-dependence: a researcher interviewed by KQED discusses why AI tools work differently for middle-schoolers than for college students. — [KQED MindShift](https://www.kqed.org/mindshift/66738/why-ai-tools-work-differently-on-middle-schoolers-compared-to-college-students-according-to-a-researcher)
- Policy synthesis: OECD Digital Education Outlook 2026 (Jan 2026) covers GenAI in education. Its contents were not reviewed in detail. — [OECD](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/01/oecd-digital-education-outlook-2026_940e0dd8/062a7394-en.pdf)
- Google's LearnLM is a pedagogy-tuned model family. Its tech report (learnlm_oct26) describes pedagogical fine-tuning principles; it was not reviewed in detail. — [Google LearnLM report](https://services.google.com/fh/files/misc/learnlm_oct26.pdf)

### Inferences
- The same underlying model (GPT-4) produced −17% (Bastani GPT Base), 0 (GPT Tutor), +0.23 SD (Nigeria) and +0.63 SD (Harvard). The deployment context and pedagogy, not the model, determine the outcome.
- Working design principles: (a) make the student do the generative step; (b) require attempts before help; (c) ground the tutor in vetted solutions; (d) embed it in class time with a teacher present rather than as an optional add-on; (e) measure learning without AI.

### Gaps
- There are few factorial RCTs that isolate individual design features (e.g. Socratic vs hinting vs worked examples).
- Evidence on long-term effects and on subgroup equity (first-generation students, gender) is thin and inconsistent.
