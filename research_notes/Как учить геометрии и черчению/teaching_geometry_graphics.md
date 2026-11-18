# Teaching geometry, descriptive geometry and engineering graphics: what education research says

Scope: pedagogy for a Bauman MSTU descriptive geometry course (эпюр Монжа, positional and metric problems, sections, surface intersections, ЕСКД/ГОСТ) and a future AI tutor. The research was done in November 2026 with about 20 search and fetch calls. Most findings come from abstracts and search snippets, not full texts, so every effect size below should be checked against the original paper before it is cited in the study guide.

Network note: `edgd.asee.org` (Engineering Design Graphics Division) and `digitalcommons.mtu.edu` (Michigan Tech repository) do not resolve in this session. They must be added to the session's allowed network domains before the Sorby primary PDFs can be read.

Evidence-strength legend used below: **[STRONG]** = meta-analysis, or a large quasi-experiment that has been replicated. **[MODERATE]** = a controlled study, or several consistent smaller studies. **[WEAK]** = a single small study, student self-report, or practitioner opinion. **[UNVERIFIED]** = background knowledge not confirmed by a source in this session.

---

## 1. Theories of geometric thinking: van Hiele, Duval, Fischbein

### Takeaway
These three frameworks explain why students who "can see" a drawing still cannot reason from it. Van Hiele describes stages of thinking that build on each other. Duval separates four distinct ways of "apprehending" a figure. Fischbein says a figure is both an image and a concept. For a descriptive geometry course, the main lesson is that reading an эпюр needs operative and discursive apprehension: students must transform the figure in their head and reason from its stated properties, not only recognise it visually. These modes must be taught explicitly. Empirical evidence for strict hierarchies is mixed.

### Cited Findings
- **Van Hiele levels** (visualisation, analysis, informal deduction, deduction, rigour). Gutiérrez and Jaime found that levels 1–4 form a hierarchy, but level 5 (rigour) "has some particularities that need further investigation" **[MODERATE]**. — [Gutiérrez & Jaime 1988, Univ. de València PDF](https://www.uv.es/angel.gutierrez/archivos1/textospdf/GutJai88a.pdf)
- **University students are often below the level their courses assume.** In a Malaysian study, very few of 147 pre-service secondary mathematics teachers reached level 3, which is the minimum needed to teach the secondary curriculum **[MODERATE, single study]**. — [AJATeL, UPSI](https://ejournal.upsi.edu.my/index.php/AJATeL/article/download/1924/1394/3208)
- 25 master's students in secondary teacher training at Zaragoza showed a lower van Hiele profile than is assumed for some high-school students. — [Univ. Zaragoza thesis](https://zaguan.unizar.es/record/109094/files/texto_completo.pdf)
- 232 Turkish prospective primary teachers: those at level 1 had higher spatial anxiety and lower high-school geometry grades. — [hrcak.srce.hr](https://hrcak.srce.hr/en/344774)
- Lawrie (1996) replicated Mayberry's study with 60 first-year Australian teacher trainees. — [MERGA 1996](https://merga.net.au/wp-content/uploads/DOCS/common/Uploaded%20files/Annual%20Conference%20Proceedings/1996%20Annual%20Conference%20Proceedings/RP_Lawrie_1996.pdf)
- **Duval's four apprehensions of a figure:**
  - *Perceptual*: immediate visual recognition. It cannot by itself establish the mathematical properties of a figure; those must come from statements such as a name or a hypothesis.
  - *Sequential*: needed whenever one constructs a figure or describes its construction.
  - *Operative*: mentally modifying the figure (reconfiguring it, adding auxiliary elements) to explore other configurations.
  - *Discursive*: valid deduction from properties.
  — [Duval 2012 (Portuguese), funes.uniandes](https://funes.uniandes.edu.co/wp-content/uploads/tainacan-items/32454/1187705/Duval2012Abordagem.pdf); [Educational Studies in Mathematics 2024, s10649-024-10317-5](https://link.springer.com/article/10.1007/s10649-024-10317-5)
- **Empirical status of Duval's model is partial.** Secondary students find perceptual-apprehension tasks easier than discursive ones, which suggests a hierarchy. An earlier Cypriot team noted that the underlying cognitive processes had not been empirically verified, and reported a three-level hierarchy (perceptual, then operative, then figure modification). — [ESM 2024](https://link.springer.com/content/pdf/10.1007/s10649-024-10317-5.pdf); [redalyc](https://www.redalyc.org/journal/335/33553644008/33553644008.pdf)
- **Fischbein (1993), "The Theory of Figural Concepts"**, *Educational Studies in Mathematics* 24(2), 139–162.
  - Geometric figures are mental entities with both conceptual and figural properties. Geometric reasoning is the interaction (and sometimes the conflict) between these two aspects.
  - Figural concepts sit at an intermediate level between images and propositional systems.
  - Integrating the two aspects "should not be considered a spontaneous effect of usual geometry courses"; it has to be taught.
  — [typeset.io copy](https://typeset.io/pdf/the-theory-of-figural-concepts-r9m2isrkv2.pdf); [Jones 1998, BSRLM, Southampton](https://eprints.soton.ac.uk/41308/01/Jones_BSRLM_18_1998.pdf)

### Inferences
- **Mapping to an эпюр:**
  - *Perceptual*: "this looks like a line parallel to π1".
  - *Discursive*: "the frontal projection is parallel to the x-axis, therefore it is a horizontal line".
  - *Operative*: introducing an auxiliary plane in an intersection problem, or changing planes of projection.
  - *Sequential*: the step-by-step construction algorithm.
  
  Many typical student errors are cases where students trust perceptual apprehension, for example judging visibility or parallelism by eye.
- **For the AI tutor**, hints can be tagged by apprehension type. Ask "what property tells you that?" to trigger discursive apprehension. Ask "what auxiliary element could you add?" to trigger operative apprehension.
- **For the study guide**, each topic could state what a student at each van Hiele-like stage can do: recognise, then name properties, then justify, then build a proof or algorithm. Early topics (point, line, plane on an эпюр) should deliberately move students from recognising to analysing.

### Gaps
- No study found that applies van Hiele levels to descriptive geometry or engineering students specifically. University-level van Hiele work is almost all on pre-service teachers.
- Duval's original 1995 chapter ("Geometrical pictures: kinds of representation and specific processings") was not retrieved in this session.

---

## 2. Spatial skills and engineering graphics research (Sorby, Uttal, sketching vs CAD, physical vs digital, AR)

### Takeaway
Spatial skills can be trained. A large meta-analysis finds an average effect of g ≈ 0.47, with effects that last and transfer **[STRONG]**. Sorby's Michigan Tech course for students who score low on the PSVT:R improved grades and retention, especially for women **[STRONG–MODERATE: large regression-discontinuity design, but at one institution]**. Freehand sketching is generally better for building spatial skills than CAD-first instruction, but the evidence is mixed. Physical models help weak visualisers. AR for descriptive geometry looks promising but has been studied very little.

### Cited Findings

**Spatial training effects**
- **Uttal et al. (2013)**, "The malleability of spatial skills: a meta-analysis of training studies", *Psychological Bulletin* 139(2), PMID 22663761 **[STRONG]**:
  - 217 studies; mean training effect g = 0.47 (SE = 0.04) compared with controls.
  - Effects were stable over delays between training and post-test.
  - Similar effect sizes were found for near transfer and far transfer.
  - Much of the variation between studies comes from how control groups were treated: repeated testing raises control-group scores.
  — [PubMed](https://pubmed.ncbi.nlm.nih.gov/22663761/); [Northwestern full-text PDF](https://groups.psych.northwestern.edu/uttal/vittae/documents/Themalleabilityofspatialskillsametaanalysisoftrainingstudies.pdf)

**Sorby's Michigan Tech course**
- The course has run since 1993. In 2009 it became mandatory for students scoring at or below a PSVT:R cutoff. — [Sorby & Veurink, long-term results (EDGD/ASEE)](https://edgd.asee.org/wp-content/uploads/sites/22/2019/09/Sorby_Veurink_Long_term_Results_Spatial_Skills_intervention.pdf) (host blocked in this session; details from search snippets)
- **Sorby, Veurink & Streiner (2018)**, "Does spatial skills instruction improve STEM outcomes? The answer is 'yes'", *Learning and Individual Differences* **[STRONG–MODERATE]**:
  - More than 3,000 first-year students over 5 years.
  - Regression-discontinuity design: students just below and just above the PSVT:R cutoff are compared.
  - The 1-credit intervention improved grades in several introductory STEM courses and STEM GPA.
  - It improved STEM retention, particularly for women.
  — [Michigan Tech Digital Commons](https://digitalcommons.mtu.edu/michigantech-p/6855/); [Rowan record](https://www.researchwithrowan.com/en/publications/does-spatial-skills-instruction-improve-stem-outcomes-the-answer-/)
- An earlier analysis found that women's retention improved significantly and men's improved without reaching significance. — [ASEE PEER 18592](https://peer.asee.org/18592.pdf); see also [ASEE PEER 27719](https://peer.asee.org/27719.pdf), [ASEE PEER 25853](https://peer.asee.org/25853.pdf)
- A longitudinal analysis of spatial ability across a whole undergraduate engineering degree is available. — [ASEE](https://strategy.asee.org/longitudinal-analysis-of-spatial-ability-over-an-undergraduate-engineering-degree-program.pdf)
- **[UNVERIFIED]** Sorby (2009), "Educational research in developing 3-D spatial skills for engineering students", *International Journal of Science Education* 31(3), 459–480, doi:10.1080/09500690802595839. This is the standard review of the course content: isometric/orthographic sketching, rotations, reflections, cross-sections of solids, combining solids, and so on. It is also the source of the commonly cited ~70% PSVT:R pass threshold. Not retrieved in this session.

**Freehand sketching vs CAD**
- A review of Graphic Expression studies in the journal *EGA* concludes that freehand sketching exercises develop spatial skills more effectively than CAD modelling or other specialised tools **[MODERATE, secondary review]**. — [EGA, DOAJ](https://doaj.org/article/965092483f574345b1da2c550bce3633)
- An ASEE 2024 controlled study with first-year students found that more freehand sketching assignments in spatial-visualisation software improved spatial visualisation, especially for female students. — [ASEE PEER 47077](https://peer.asee.org/47077.pdf)
- Hilton et al. (ASME DETC 2016) compared perspective sketching with isometric sketching. Both gave equivalent gains in spatial visualisation and design self-efficacy. — [sciencegate DOI 10.1115/detc2016-60250](https://www.sciencegate.app/document/10.1115/detc2016-60250)
- A Purdue thesis (n≈31) found that pictorial freehand sketches did not significantly improve CAD model construction; visual ability was the stronger predictor **[WEAK]**. — [Purdue dissertation](https://docs.lib.purdue.edu/dissertations/AAI1535115); [Purdue CGT thesis](https://docs.lib.purdue.edu/cgttheses/24)
- Senior design students use sketching and CAD for different purposes rather than as substitutes. — [NSF PAR](https://par.nsf.gov/servlets/purl/10405697)

**Physical vs digital models**
- Rapid-prototyped physical models (about 50 per lab section) improved visualisation compared with control sections. A workshop with physical models helped low visualisers **[MODERATE–WEAK]**. — [ASEE: physical models for low visualizers](https://strategy.asee.org/using-physical-models-in-improving-low-visualizers-spatial-visualization-skills.pdf); [ASEE: rapid prototyping](https://peer.asee.org/application-of-rapid-prototyping-technology-to-improve-spatial-visualization)
- In student self-report, about 88% (one semester) and about 64% (a later semester) agreed that physical models helped them understand orthographic projection **[WEAK]**. — [ASEE NEMO](https://nemo.asee.org/public/conferences/374/papers/50872/download)
- Katsioloudis (*Journal of Technology Education* 29(2)) compared holographic, 3D-printed and on-screen models for sectional-view sketching. — [JTE PDF](https://scholar-dev.cloud.lib.vt.edu/ejournals/JTE/v29n2/pdf/katsioloudis.pdf) (results not extracted in this session)
- Students produced better CAD models from orthographic drawings than from isometric drawings. — [Acta Univ. Cibiniensis 2025](https://reference-global.com/download/article/10.2478/aucts-2025-0003.pdf)

**Augmented and virtual reality**
- A 2021 systematic review (*Informatics in Education* 20(1)) concludes that AR for spatial-ability training in engineering is under-researched. It notes that Voronina et al. (2019) called for more AR research in descriptive geometry specifically. — [infedu.vu.lt](https://infedu.vu.lt/journal/INFEDU/article/676/file/pdf)
- Riga Technical University (BALTGRAF 2013): pre/post comparison of two intact first-year descriptive geometry and engineering graphics classes, one with additional AR tasks. — [RTU ORTUS](https://ortus.rtu.lv/science/en/publications/16057)
- A short AR training course in Spain and Peru gave similar spatial gains in both countries. — [Symmetry 12(9):1401, MDPI](https://mdpi.com/2073-8994/12/9/1401/html)
- Kaufmann et al. (TU Wien 2005), Construct3D: AR geometry education with gender-related differences in test strategies. — [TU Wien](https://www.ims.tuwien.ac.at/publications/tuw-139934)

### Inferences
- **Diagnose early.** The Sorby model suggests screening first-years with the PSVT:R or MCT in week 1. Students below a cutoff would get a short spatial "bridge" module of sketching, rotations and sections before эпюр work. An AI tutor could deliver it adaptively.
- **Sketch first.** The study guide should ask for freehand isometric and orthographic sketches before, or alongside, CAD or 3D viewers. Viewers and AR are best used as feedback ("check your mental image"), not as a replacement for mental construction.
- **Pair interactive 3D with the эпюр.** Interactive 3D models next to each эпюр (a rotatable scene with the projection planes unfolding) are a reasonable digital analogue of physical models. Evidence for digital-only models is weaker than for physical models.

### Gaps
- Exact effect sizes for women's retention in Sorby et al. 2018 were not retrieved, because the hosts were blocked.
- No multi-institution replication of the retention effect was found. Some replications exist (Sorby's NSF ENGAGE project, Penn State), but none were verified here.
- No head-to-head randomised trial of physical vs virtual models for orthographic projection was found.
- No AR study specific to descriptive geometry reports effect sizes.

---

## 3. Russian/Soviet tradition, typical difficulties, failure rates, and the Western decline debate

### Takeaway
Russian-language literature consistently reports that first-year students arrive with weak spatial imagination and struggle to understand how a комплексный чертёж (multi-view projection drawing) is formed. It recommends repeated problem solving, algorithmic schemes, differentiated task difficulty and computer trainers. Almost all of this evidence is practitioner report, not controlled study **[WEAK]**. In the West and in Russia, descriptive geometry hours have been cut or the subject replaced by CAD. Critics link this to weaker spatial skills; reformers argue for integrating it with digital modelling.

### Cited Findings

**Typical difficulties**
- Many first-year students have no developed spatial imagination. Trying to build it "from nothing" does not work, so preparatory work is needed. — [Сафонова, СФУ 2013](https://conf.sfu-kras.ru/sites/mn2013/thesis/s047/s047-013.pdf); [Спирина, Кузнецова, СФУ 2013](https://conf.sfu-kras.ru/sites/mn2013/thesis/s047/s047-014.pdf)
- Spatial representations are formed mainly by solving many problems rather than through theory; the authors recommend intensifying work in the first year. — [ГГТУ им. Сухого (conf.gstu.by)](https://conf.gstu.by/index.php/pmetu/rsmc4/paper/download/58/59)
- First-year difficulties are attributed to not understanding how the комплексный чертёж is formed and to low spatial imagination. The authors propose tasks differentiated by difficulty. — [Моисеенко, Амелина, ГГТУ](https://www.gstu.by/sites/default/files/atoms/files/98/95/_moiseenko_amelina-tezisy.pdf)
- For changing projection planes and surface intersections, an "algorithmic method" is proposed, because these topics depend on mastering fixed sequences of operations. — [core.ac.uk 156871917](https://core.ac.uk/download/156871917.pdf)
- The Bauman MSTU Kaluga branch department of «Инженерная графика» tests first-years every year. Poorly prepared students have trouble keeping to the course schedule. — [Гуманитарный вестник МГТУ, 2012](https://hmbul.bmstu.ru/articles/15/15.pdf)
- Problems of first-years in «Инженерная графика» and ways to help them adapt are discussed in [Альманах современной науки и образования (Грамота) 2015](https://www.gramota.net/article/alm20150358/pdf).

**Current methodical practice at Bauman MSTU and elsewhere**
- Палий (2023, Bauman MSTU, department «Инженерная графика») uses stop-motion animation to teach descriptive geometry. — [Гуманитарный вестник 531](https://hmbul.bmstu.ru/articles/531/531.pdf)
- Фоломкин and Янкилевич (Горный университет, «Геометрия и графика» 2022) describe a trainer program for independent practice that raises student interest **[WEAK]**. — [zh-szf.ru](https://zh-szf.ru/en/storage/download/179814)
- A 2026 St Petersburg Polytechnic article argues for teaching the subject modularly, through practical tasks in a digital environment. — [TMHE SPbPU 2026](https://tmhe.spbstu.ru/en/article/2026.44.6/)
- Related work in «Геометрия и графика» covers the history of descriptive geometry. Its reference list includes В.О. Четверухин and Н.А. Фролов. — [zh-szf.ru JATS 47425](https://zh-szf.ru/ru/nauka/article/47425/jats)
- Example syllabus: [МФ МГТУ «Начертательная геометрия»](https://mf.bmstu.ru/sveden/files/aiz/Nachertatelynaya_geometriya(1).pdf)
- Dissertation on intensifying descriptive geometry teaching in technical universities: [dissercat](https://www.dissercat.com/content/intensifikatsiya-protsessa-obucheniya-nachertatelnoi-geometrii-studentov-tekhnicheskikh-vuzo)

**Decline and debate**
- **Leopold (2005)**:
  - Some engineering faculties concluded that descriptive geometry was no longer needed and replaced it with CAD training.
  - This leads to a "deficiency in spatial visualisation abilities of engineering students".
  - Polish data show teaching hours cut or the subject eliminated.
  — [Leopold, *Journal Biuletyn of Polish Society for Geometry and Engineering Graphics* 15 (2005)](https://yadda.icm.edu.pl/baztech/element/bwmeta1.element.baztech-1f276921-6ab8-444a-95d3-83d8f30020b3/c/leopold_geometry_15_2005.pdf)
- The peak and decline of descriptive geometry at Helsinki University of Technology, as computers spread. — [Aalto University Archives](https://www.aalto.fi/en/aalto-university-archives/the-peak-and-decline-of-descriptive-geometry-and-perspective-in-teaching-at-the-helsinki-university)
- **Russian debate:**
  - Хейфец (2015) weighs arguments for and against keeping the course, and considers replacing it with a modern theoretical course on geometric modelling. — [ДГНГ ПНИПУ 2015](https://dgng.pstu.ru/conf2015/papers/72/en)
  - «Начертательная геометрия сегодня: проблемы и перспективы». — [naukaru 75841](https://naukaru.ru/en/nauka/article/75841/view)
  - Кадыкова argues that knowledge of orthogonal projection remains essential. — via [naukaru](https://naukaru.ru/en/storage/download/144380)
- A South African study, cited in a 2026 paper, found that only 33% of chemical engineering programmes that formerly taught engineering drawing still did so in 2016. — [JEELR (asianonlinejournals)](https://asianonlinejournals.com/index.php/JEELR/article/download/8223/3427/13041)

**Classic textbooks and authors [UNVERIFIED in this session; standard background knowledge]**
- Гордон В.О., Семенцов-Огиевский М.А., «Курс начертательной геометрии», many editions. Paired with Гордон, Иванов, Солнцева, «Сборник задач по курсу начертательной геометрии».
- Фролов С.А., «Начертательная геометрия» (Машиностроение). Фролов worked at МВТУ им. Баумана.
- Котов И.И. (МАИ), in the "geometric modelling" line of work with Якунин В.И. (МАИ).
- Четверухин Н.Ф., projective geometry and the methodology of images (изображения) in school and university geometry.

### Inferences
- **The Russian tradition and Western research agree.** The algorithmic, step-by-step solution of positional and metric problems used in the Russian tradition fits Duval's "sequential apprehension" and worked-example research (section 5). The Russian emphasis on "много задач" matches spatial-training evidence that practice volume matters.
- **The study guide can frame descriptive geometry as spatial-skills training plus a formal language for drawings.** This is a defensible answer to the "CAD made it obsolete" critique, and it is what Leopold and Sorby's results support.

### Gaps
- **No published failure or attrition statistics for first-year descriptive geometry or engineering graphics at Bauman MSTU or other Russian universities were found.** Claims of "high failure rates" could not be sourced and should not be stated as fact.
- CyberLeninka and eLibrary were not directly reachable through search. Primary methodological works by Четверухин, Котов and Якунин, and a history of the Bauman department, were not retrieved.
- No controlled evaluation of Russian methodical innovations (trainers, animation) was found.

---

## 4. Misconceptions, typical errors, and diagnostic tests (PSVT:R, MCT, SBST)

### Takeaway
Several validated tests can diagnose spatial weakness:
- **PSVT:R**: mental rotation, the standard in US engineering.
- **MCT**: cross-sections, the standard in Japanese and European descriptive geometry studies.
- **SBST**: cross-sections, free and validated.

The cross-section tests match descriptive geometry content closely, especially sections and intersections. Error research on orthographic projection is thin. The documented error types involve view alignment and orientation, especially of the top view, and the ambiguity of isometric images.

### Cited Findings

**Mental Cutting Test (MCT)**
- In the MCT, the student must pick the correct cross-section of a solid cut by a plane. It is widely used to evaluate descriptive geometry courses (see the Heldermann *Journal for Geometry and Graphics* papers). — [JGG 2012, 16(1), "Development of spatial abilities of architectural and civil engineering students in the light of the MCT"](https://geodesic.mathdoc.fr/item/JGG_2012_16_1_JGG_2012_16_1_a9); [JGG PDF heldermann jgg0318](https://www.heldermann-verlag.de/jgg/jgg01_05/jgg0318.pdf)
- **Results are mixed** **[MODERATE, mixed]**:
  - At Banja Luka (n = 118 first-years), spatial ability improved significantly overall, but "the Descriptive Geometry course did not have a substantial influence".
  - A Košice pre/post study found a positive effect of the descriptive geometry course.
  - A 52-hour dedicated spatial course at Monash significantly improved MCT scores compared with controls.
  — [aggplus Banja Luka](https://aggplus.aggf.unibl.org/article/22/pdf); [J. Industrial Design & Engineering Graphics 2019](https://doaj.org/article/47cdc7c4743c49a49a9712bf178e49b2); [AMI 40 (Eszterházy)](https://ami.uni-eszterhazy.hu/uploads/papers/finalpdf/AMI_40_from203to216.pdf)

**Santa Barbara Solids Test (SBST)**
- Cohen & Hegarty (2012), "Inferring cross sections of 3D objects: A new spatial thinking test", *Learning and Individual Differences* 22, 868–874.
- 30 multiple-choice items: 15 with orthogonal cutting planes and 15 with oblique ones. The shapes are simple, joined and embedded solids. No time limit.
- Munns, He, Topete & Hegarty (2023, *Journal of Intelligence*) found good psychometric properties and a domain-general ability to visualise cross-sections **[STRONG for validity]**.
- Free PDF Version 4 and a computerised Inquisit version are available.
— [Hegarty lab PDF](https://hegarty-lab.psych.ucsb.edu/sites/default/files/2020-04/Santa_Barbara_Solids_Test_Version_4_0318.pdf); [Cohen & Hegarty 2007, CogSci (eScholarship)](https://escholarship.org/content/qt98p7t49b/qt98p7t49b.pdf); [J. Intelligence 2023, DOAJ](https://doaj.org/article/5856879f0c084fae94210150a83ebe83); [Millisecond](https://www.millisecond.com/library/santabarbarasolidstest); [spatiallearning.org](https://www.spatiallearning.org/tools/santa-barbara-solids-test)

**PSVT:R**
- Isometric drawings in the PSVT:R may threaten its validity, because isometric views are ambiguous. People with projection-drawing experience score higher than novices. — [Bartlett & Camba, ASEE](https://peer.asee.org/isometric-projection-as-a-threat-to-validity-in-the-psvt-r.pdf)

**Orthographic projection errors**
- An ASEE 2022 case study used digitised sketches in an auto-graded environment with hints. Some students did not improve on the PSVT:R post-test. The authors recommend:
  - early extra assignments on **top views**;
  - assignments on the **alignment and orientation of orthographic views**.
  One student gamed the hint system. — [ASEE PEER 41636](https://peer.asee.org/41636.pdf)
- **[WEAK, secondary/curriculum]**:
  - Students commonly confuse an isometric drawing with an isometric projection. — [flipeducation curriculum](https://flipeducation.ai/curriculum/ie/design-communication-graphics/year-5/axonometric-projection)
  - Poor isometric drawing skills are reported in school examinations. — [RESSAT 2024](https://ressat.org/index.php/ressat/article/download/869/241)

### Inferences
- **Choosing a test for Bauman MSTU:**
  - MCT or SBST for pre/post evaluation of the sections and intersections topics.
  - PSVT:R for comparability with Sorby-style cutoffs.
  
  SBST is free and validated, so it is the easiest to embed in a web study guide.
- **Error catalogue for the AI tutor.** These categories are hypotheses drawn from the error types above plus Russian practitioner reports. They have not been validated empirically:
  1. View misalignment: projection connection lines (линии связи) not perpendicular to the axis.
  2. Mis-oriented top view.
  3. Visibility decided "by eye" instead of with competing points (конкурирующие точки).
  4. Projections of a point on a plane or surface not linked through a line lying in that plane or surface.
  5. Treating an apparent intersection on the drawing as a real one (crossing vs intersecting lines).
  6. Measuring true lengths directly from projections.
  7. Confusing isometric drawing scale with isometric projection scale.

### Gaps
- No systematic taxonomy of orthographic or descriptive geometry errors with frequencies was found. A study guide based on research would have to collect its own error data (the AI tutor could log them).
- Sorby's published PSVT:R cutoffs and norms for Russian students were not found.

---

## 5. Sequencing, scaffolding, worked examples, dynamic geometry and interactive tools

### Takeaway
Worked examples, with text integrated into the diagram, reduce cognitive load in geometry **[STRONG in cognitive-load-theory literature]**. Dynamic geometry software (GeoGebra and similar) shows medium-to-large positive effects on achievement in meta-analyses. The most rigorous recent GeoGebra-specific estimate is g ≈ 0.65 **[MODERATE–STRONG; likely inflated by small regional studies]**. Spatial gains from GeoGebra are also reported.

### Cited Findings

**Worked examples and split attention**
- Worked examples in geometry work only when text and diagram are physically integrated rather than split (Tarmizi & Sweller 1988; Ward & Sweller 1990). — cited in [Jang, Schunn & Nokes 2011, LRDC PDF](https://www.lrdc.pitt.edu/Schunn/papers/jang-schunn-nokes2011.pdf)
- Tindall-Ford, Agostinho, Bokosmaty, Paas & Chandler (2015), on angle properties of parallel lines: students who integrated split text into the diagram themselves outperformed students given split-attention examples, and matched students given examples already integrated by the instructor. — [Macquarie](https://researchers.mq.edu.au/en/publications/computer-based-learning-of-geometry-from-integrated-and-split-att/); [UOW](https://ro.uow.edu.au/articles/journal_contribution/Computer-based_learning_of_geometry_from_integrated_and_split_attention_worked_examples_the_power_of_self-management/27707241/1)
- Mousavi, Low & Sweller (1995) found a modality effect: geometry worked examples with spoken explanation plus a diagram reduced load. — [overview](https://en.wikipedia.org/wiki/Split_attention_effect)
- Schwonke et al.: in a Geometry Cognitive Tutor, worked examples reduced learning time with equal procedural and conceptual outcomes. — [Worked-example effect overview](https://en.wikipedia.com/wiki/Worked-example_effect)

**Dynamic geometry software meta-analyses**
- Zhang, Wang & Jia (2023), *Journal of Research on Technology in Education*: GeoGebra and mathematics achievement, 2002–2022, 14 studies, 19 effect sizes, N = 1,334, **g = 0.653**. — [T&F](https://informahealthcare.com/doi/full/10.1080/15391523.2023.2250886)
- Juandi et al. (2021): dynamic geometry software, 50 articles, 57 effect sizes, ES = 1.07. Moderators: sample size, student-to-computer ratio, education level. — [i-JIM](https://online-journals.org/index.php/i-jim/article/view/18853)
- Ji, Guo & Song: dynamic mathematics software, 107 studies, d = 0.632. — [HKU hub](https://hub.hku.hk/handle/10722/337512); [BNU PDF](https://guok.bnu.edu.cn/docs/2024-09/34f51d33fa7f46179225c99e73894b7e.pdf)
- Turkish meta-analyses report larger effects:
  - Kaya & Öçal, GeoGebra: 0.886.
  - Dynamic geometry software and geometry achievement: 0.954.
  — [dergipark 616174](https://dergipark.org.tr/en/download/article-file/616174); [dergipark 201409](https://dergipark.org.tr/download/article-file/201409)
- Suparman et al.: GeoGebra and **spatial visualisation**, g = 1.070. — [EJMSTE](https://ejmste.com/download/fostering-spatial-visualization-in-geogebra-assisted-geometry-lesson-a-systematic-review-and-15170.pdf)

### Inferences
- **Lesson sequence per topic.** A lesson pattern supported by the evidence:
  1. Diagnostic micro-task.
  2. Fully worked example, with each construction step annotated directly on the эпюр (no separate text block), ideally shown as an animation that reveals one step at a time.
  3. Faded example: the student completes the last steps.
  4. Independent problem.
  5. 3D check in an interactive viewer.
  6. Freehand sketch of the spatial situation.
- **Integrate labels with the drawing.** Annotations (labels, step numbers, notation such as A₁, A₂, h₀) should sit on the drawing itself, to avoid split attention.
- **Use GeoGebra 3D or a custom dynamic эпюр.** The point moves in space and both projections update live. This links perceptual and operative apprehension. Meta-analytic effects are mostly from school mathematics, so transfer to university descriptive geometry is plausible but unproven.
- **Gamification** was not researched in depth here. Evidence for trainer programs in the Russian context is anecdotal (section 3).

### Gaps
- No meta-analysis of worked examples specifically in descriptive geometry or technical drawing was found.
- No rigorous study of gamified descriptive geometry tools was found.
- No GeoGebra meta-analysis restricted to university students was found.
