# Preinstalled published polymer properties

[日本語](../polymer-library.md)

v0.39 bundles 91 records: 87 manufacturer entries and four experimental patent formulations. Selected factual values and provenance are in `src/polymer-catalog.json`; searching, comparing and applying data works offline. Each record retains source URL, revision/retrieval date, acquired PDF hash and property standards. Complete source documents are linked rather than redistributed.

|Family|Coverage|
|---|---|
|PP|Unfilled; short glass fiber 10/15/20/30/40/50%; long glass fiber 30/40/50%; glass beads 10/20%; talc 10/20/30/40%|
|PE|HDPE unfilled, glass fiber 5/10/15/20/30/40/50%, talc 10/20/30/40%; six Lupolen LDPE grades|
|ABS|Unfilled; glass fiber 10/15/20/30/40%; glass beads 10/20%; manufacturer talc 20% reference; experimental talc 10/15/20/30% formulations|
|PBT|Unfilled; short glass fiber 10/15/20/30/40/50%; long glass fiber 30/40/50%|
|PET|Glass fiber 30/45% (black grades)|
|PA6|Unfilled; short glass fiber 15/30/35/40/45% (heat-stabilized grades); long glass fiber 40/50/60%|
|PEEK|Unfilled; glass fiber 10/20/30/40% (LF grades)|
|PC/ABS|Unfilled; glass fiber 10/20/30%|
|Others|Selected PC, PA66, POM, PS, PSU and PPS unfilled/glass-fiber grades|

Primary sources include RTP Company [PP](https://www.rtpcompany.com/technical-info/data-sheets/series-100/), [HDPE](https://www.rtpcompany.com/technical-info/data-sheets/series-700/), [ABS](https://www.rtpcompany.com/technical-info/data-sheets/series-600/) and per-grade PDFs; [LyondellBasell PE injection guide](https://www.lyondellbasell.com/link/fee70558de6140c5ac19a15d4b52b2e5.aspx); [AKAY ABS talc 20%](https://akayplastik.com/en/pdf/abs/A-20TAN01.pdf); [SABIC patent Tables 2–5](https://patents.google.com/patent/US20180009978A1/en). Patent tables were reviewed through web tools; the original HTML hash was not acquired. Experimental entries are distinct from commercial grades and hidden initially.

## Using the library

Open **Published polymer material library** and filter family, filler, percentage and grade. Compare candidate properties, follow source links, and save filtered records as JSON.

Applying data requires a user-assumed Poisson ratio and explicit selection of an isotropic linear approximation. The displayed default 0.35 is not published data. Application changes category/properties atomically and removes earlier plasticity, hyperelasticity, fatigue data and plastic loading fractions. Geometry, boundary conditions and other study settings are preserved.

Projects/cases preserve source, grade, composition, published-value snapshot and the assumed Poisson ratio. Manual numerical edits retain both original values and explicit overrides.

## Missing data and scope

- Only published **tensile modulus** maps to Young's modulus; flexural modulus remains separate. Strength definitions distinguish yield/break/unspecified values. No plasticity or fatigue curves are synthesized.
- Density derived from specific gravity ×1000 kg/m³ is labeled as a conversion.
- RTP additive percentages do not specify mass/volume basis; patent compositions explicitly use weight percent.
- AKAY ABS talc 20% has no published tensile modulus: density/strength are installed, and structural analysis needs a separate modulus input. Modulus is not inferred from strength or elongation.
- Patent examples lack density/strength. Flow-direction CTE is reference-only and does not become isotropic thermal expansion.
- Missing conductivity, heat capacity, temperature validity, directional elasticity, creep and S-N data stay absent. HDT, Vicat and processing temperatures do not define analysis validity ranges.

Typical specimen data does not calibrate molded-part fiber orientation, weld lines, temperature/rate, conditioning or creep. Older source revisions are identified; retrieval date is distinct from publication date. Current commercial availability is not assessed.

MCP `studio_material_catalog` searches the same data using `family`, `filler`, `contentPercent`, `search` and `includeExperimental`; `id` retrieves one record. Example: `{"family":"PP","filler":"glassFiber","contentPercent":30}`.


v0.39 adds RTP Company [PBT](https://www.rtpcompany.com/technical-info/data-sheets/series-1000/), [PET](https://www.rtpcompany.com/technical-info/data-sheets/series-1100/), [PA6](https://www.rtpcompany.com/technical-info/data-sheets/series-200-a/), [PEEK](https://www.rtpcompany.com/technical-info/data-sheets/series-2200/) and [PC/ABS](https://www.rtpcompany.com/technical-info/data-sheets/series-2500/) references. VLF 81009 is explicitly marked preliminary in details, comparisons and saved source metadata. ISO 1183 PA6 density is converted from g/cm³ to kg/m³. Processing drying conditions do not imply mechanical-test conditioning. Comparison rows identify the polymer, filler, strength units and source category; their Select buttons choose a grade without applying it or retaining the previous isotropy checkbox.
