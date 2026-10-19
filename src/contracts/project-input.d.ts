/** Shared saved-input shapes derived from validateProject, material validators,
 * source validators and the existing physical-input unit tables. These types
 * describe data shape only; runtime validation remains authoritative.
 */
export type Vector3 = [number, number, number];
export type Bounds3 = [number, number, number, number, number, number];

export type AnalysisDiscipline =
  | 'structural' | 'thermal' | 'acoustic' | 'channelFlow' | 'creepingFlow' | 'fluidDomain';

export type BoundaryConditionType =
  | 'fixed' | 'displacement' | 'force' | 'pressure' | 'normalTraction'
  | 'temperature' | 'heatFlux' | 'heatPower' | 'convection' | 'radiation' | 'thermalContact'
  | 'acousticPressure' | 'acousticImpedance';

export interface ProjectMesh {
  positions: number[];
  faceIds: number[];
  kind?: string;
  sourceHash?: string;
}

export interface RegionSelection {
  mesh: number;
  triangles: number[];
}

/** Exact sphere latitude/longitude sector in mm/degrees; axis/reference are normalized and orthogonalized at runtime. */
export interface SphericalRegion {
  mesh: number; exactCad: true; center: Vector3; axis: Vector3; reference: Vector3;
  radius: number; tolerance: number; latitudeMin: number; latitudeMax: number;
  startDegrees: number; sweepDegrees: number;
}

/** Current serialized boundary shape; field-specific physical rules are runtime checked. */
export interface ProjectCondition {
  type: BoundaryConditionType;
  value: number;
  direction: Vector3;
  regions: RegionSelection[];
  ambientTemperature?: number;
  reactance?: number;
  frame?: unknown;
  planarRegion?: unknown;
  cylindricalRegion?: unknown;
  sphericalRegion?: SphericalRegion;
  cadUpdateRequired?: unknown;
}

export interface BoxSource { kind: 'box'; bounds: Bounds3 }
export interface BoxesSource { kind: 'boxes'; boxes: Bounds3[] }
export interface CylinderSource { kind: 'cylinder' }
export interface SphereSource { kind: 'sphere'; center: Vector3; radius: number }
export interface TubeSource {
  kind: 'tube'; center: Vector3; axis: 0 | 1 | 2;
  outerRadius: number; innerRadius: number; length: number;
}
export interface StepSource { kind: 'step'; data: string }
export interface StlSource { kind: 'stl'; positions: number[] }
export type SolidSource = BoxSource | BoxesSource | CylinderSource | SphereSource | TubeSource | StepSource | StlSource;

/** A fluid enclosure may exclude supported CAD/primitive solids, never an STL. */
export type FluidDomainSolid = Exclude<SolidSource, StlSource>;
export interface FluidDomainSource {
  kind: 'fluidDomain';
  solid: FluidDomainSolid;
  enclosure: Bounds3 | {kind: 'sphere'; center: Vector3; radius: number};
  mode?: 'exterior' | 'internal';
  seedPoint?: Vector3;
  portPlanes?: number[];
  /** Explicit half-space clipping planes, internal mesh/cavity use only; seed is on inward side. */
  openingCaps?: Array<{id: string; point: Vector3; normal: Vector3}>;
}
export type ProjectSource = SolidSource | FluidDomainSource;

export interface OrthotropicMaterial {
  model: 'linear-orthotropic';
  youngModuliPa: Vector3;
  poissonRatios: Vector3;
  shearModuliPa: Vector3;
  axes: [Vector3, Vector3, Vector3];
  source: string;
  testConditions: string;
}

export interface PlasticityMaterial {
  model: 'j2-isotropic';
  yieldStress: number;
  hardeningModulus: number;
  testConditions?: string;
}

export interface HyperelasticMaterial {
  model: 'neo-hookean-log';
  shearModulus: number;
  bulkModulus: number;
  testCurve?: Array<[stretch: number, nominalStressPa: number]>;
  testConditions?: string;
}

export interface ElasticTemperatureRow {
  temperature: number;
  youngModulus: number;
  poissonRatio: number;
}

export interface MaterialDependence {
  elasticTemperatureTable?: ElasticTemperatureRow[];
  strainRateMin?: number;
  strainRateMax?: number;
  rateDependent?: boolean;
  directionality?: 'isotropic' | 'orthotropic';
  axes?: [Vector3, Vector3, Vector3];
  testConditions?: string;
}

export interface FatigueMaterialData {
  model: 'stress-life';
  stressRatio: -1;
  snCurve: Array<{stressAmplitudePa: number; cycles: number}>;
  ultimateStrengthPa: number;
  yieldStressPa: number;
  testConditions: string;
  source: string;
}

export interface FractureMaterialData {
  model: 'lefm-mode-i';
  toughnessRangePaSqrtM: [number, number];
  temperatureRangeC: [number, number];
  source: string;
  testConditions: string;
  surfaceCondition: string;
}

export interface MaterialProperties {
  youngModulus?: number;
  poissonRatio?: number;
  density?: number;
  strength?: number;
  conductivity?: number;
  specificHeat?: number;
  expansion?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  source?: string;
  grade?: string;
  notes?: string;
  orthotropic?: OrthotropicMaterial;
  plasticity?: PlasticityMaterial;
  hyperelastic?: HyperelasticMaterial;
  dependence?: MaterialDependence;
  fatigueData?: FatigueMaterialData;
  fractureData?: FractureMaterialData;
  [additionalProperty: string]: unknown;
}

/** Known saved study fields. Additional solver-specific inputs remain open and runtime validated. */
export interface AnalysisStudy {
  kind?: AnalysisDiscipline;
  gravityEnabled?: boolean;
  gravity?: Vector3;
  thermalStress?: boolean;
  temperature?: number;
  referenceTemperature?: number;
  materialTemperature?: number;
  transient?: boolean;
  volumetricSource?: number;
  timeStep?: number;
  steps?: number;
  initialTemperature?: number;
  /** Transient heat: stored nodal temperature frames (initial state + steps, evenly spaced, 2..61; default 61, memory-budget limited). */
  thermalSnapshotCount?: number;
  thermalSnapshotBudgetBytes?: number;
  acousticSnapshotCount?: number;
  acousticSnapshotBudgetBytes?: number;
  frequency?: number;
  soundSpeed?: number;
  airDensity?: number;
  lossFactor?: number;
  referencePressurePa?: number;
  flowAxis?: 0 | 1 | 2;
  pressureDropPa?: number;
  dynamicViscosity?: number;
  fluidDensity?: number;
  fluidSoundSpeed?: number;
  freeStreamVelocity?: Vector3;
  referenceLengthMm?: number;
  stokesVelocityElement?: 'P1' | 'P2';
  modalAnalysis?: boolean;
  modeCount?: number;
  modalIterations?: number;
  nonlinearLoadSteps?: number;
  maxNewtonIterations?: number;
  plasticLoadFractions?: number[];
  [additionalProperty: string]: unknown;
}

/** Optional unit annotations accepted by preflight; omitted entries use solver defaults. */
export interface ProjectUnits {
  geometry?: 'mm';
  displacement?: 'mm';
  youngModulus?: 'Pa';
  youngModuliPa?: 'Pa';
  shearModuliPa?: 'Pa';
  yieldStress?: 'Pa';
  hardeningModulus?: 'Pa';
  shearModulus?: 'Pa';
  bulkModulus?: 'Pa';
  force?: 'N';
  pressure?: 'Pa';
  density?: 'kg/m3';
  fluidDensity?: 'kg/m3';
  poissonRatio?: '1';
  poissonRatios?: '1';
  axes?: '1';
  gravity?: 'm/s2';
  conductivity?: 'W/(m*K)';
  specificHeat?: 'J/(kg*K)';
  expansion?: '1/K';
  temperature?: 'degC';
  referenceTemperature?: 'degC';
  materialTemperature?: 'degC';
  temperatureMin?: 'degC';
  temperatureMax?: 'degC';
  initialTemperature?: 'degC';
  ambientTemperature?: 'degC';
  frequency?: 'Hz';
  soundSpeed?: 'm/s';
  fluidSoundSpeed?: 'm/s';
  referencePressurePa?: 'Pa';
  impedance?: 'Pa*s/m';
  velocity?: 'm/s';
  freeStreamVelocity?: 'm/s';
  dynamicViscosity?: 'Pa*s';
  pressureDropPa?: 'Pa';
  referenceLengthMm?: 'mm';
  timeStep?: 's';
  time?: 's';
  acousticDuration?: 's';
  pulseWidth?: 's';
  acousticTimeStep?: 's';
  volumetricSource?: 'W/m3';
  heatFlux?: 'W/m2';
  heatPower?: 'W';
  heatTransferCoefficient?: 'W/(m2*K)';
  contactConductance?: 'W/(m2*K)';
  emissivity?: '1';
  lossFactor?: '1';
  dampingRate?: '1/s';
  amplitudeMm?: 'mm';
  directivityDistanceMm?: 'mm';
  phaseDeg?: 'deg';
  strainRateMin?: '1/s';
  strainRateMax?: '1/s';
  testCurve?: 'stretch (1), nominal stress (Pa)';
  plasticLoadFractions?: '1';
}

export interface AnalysisIntent { mode: 'quantitative' | 'exploratory' }
export interface InputProvenanceEntry {
  pointer: string;
  value: unknown;
  source: {kind: 'user-input' | 'measured-document' | 'cad' | 'agent-proposal'; reference?: string; revision?: string};
  rationale: string;
  assumption: string | null;
  applicability: string;
  status: 'confirmed' | 'unconfirmed';
  confirmation?: {by: 'user'; note: string};
}
export interface InputProvenance { schemaVersion: 1; entries: InputProvenanceEntry[] }
export interface LocalMeshRefinement { center: Vector3; size: number; radius: number }
export interface MeshSettings { refinements: LocalMeshRefinement[] }

/** The fields that validateProject requires on every saved version-1 project. */
export interface SavedProjectBase {
  version: 1;
  meshes: ProjectMesh[];
  conditions: ProjectCondition[];
}

/** Common version-1 project envelope; nested extensions remain runtime validated. */
export interface SavedProject extends SavedProjectBase {
  name?: string;
  material?: string;
  materialProperties?: MaterialProperties;
  study?: AnalysisStudy;
  sourceModel?: ProjectSource;
  selection?: number[][];
  sphericalRegion?: SphericalRegion;
  units?: ProjectUnits;
  analysisIntent?: AnalysisIntent;
  inputProvenance?: InputProvenance;
  meshSettings?: MeshSettings;
}
