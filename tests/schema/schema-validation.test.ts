import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Create a fresh AJV instance with 2020-12 draft support
function createAjv(): Ajv2020 {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv;
}

const schemasDir = join(process.cwd(), 'schemas');
const examplesDir = join(process.cwd(), 'examples');

interface SchemaTestConfig {
  schemaFile: string;
  sampleFiles: string[];
  kind: string;
  idPattern: string;
}

const schemaConfigs: SchemaTestConfig[] = [
  {
    schemaFile: 'IntentContract.schema.json',
    sampleFiles: ['intent.sample.json'],
    kind: 'IntentContract',
    idPattern: '^IC-[0-9]{3,}$',
  },
  {
    schemaFile: 'TaskSeed.schema.json',
    sampleFiles: ['taskseed.sample.json'],
    kind: 'TaskSeed',
    idPattern: '^TS-[0-9]{3,}$',
  },
  {
    schemaFile: 'Acceptance.schema.json',
    sampleFiles: ['acceptance.sample.json'],
    kind: 'Acceptance',
    idPattern: '^AC-[0-9]{3,}$',
  },
  {
    schemaFile: 'PublishGate.schema.json',
    sampleFiles: ['publishgate-low.sample.json', 'publishgate-high.sample.json'],
    kind: 'PublishGate',
    idPattern: '^PG-[0-9]{3,}$',
  },
  {
    schemaFile: 'Evidence.schema.json',
    sampleFiles: ['evidence.sample.json'],
    kind: 'Evidence',
    idPattern: '^EV-[0-9]{3,}$',
  },
];

describe('Schema Validation', () => {
  describe('Common Schema', () => {
    it('should have all required fields defined', () => {
      const commonSchema = JSON.parse(
        readFileSync(join(schemasDir, 'common.schema.json'), 'utf-8')
      );
      expect(commonSchema.required).toContain('schemaVersion');
      expect(commonSchema.required).toContain('id');
      expect(commonSchema.required).toContain('kind');
      expect(commonSchema.required).toContain('state');
      expect(commonSchema.required).toContain('version');
      expect(commonSchema.required).toContain('createdAt');
      expect(commonSchema.required).toContain('updatedAt');
    });

    it('should have correct state enum values', () => {
      const commonSchema = JSON.parse(
        readFileSync(join(schemasDir, 'common.schema.json'), 'utf-8')
      );
      expect(commonSchema.properties.state.enum).toEqual([
        'Draft',
        'Active',
        'Frozen',
        'Published',
        'Superseded',
        'Revoked',
        'Archived',
      ]);
    });

    it('should have correct kind enum values', () => {
      const commonSchema = JSON.parse(
        readFileSync(join(schemasDir, 'common.schema.json'), 'utf-8')
      );
      expect(commonSchema.properties.kind.enum).toEqual([
        'IntentContract',
        'TaskSeed',
        'Acceptance',
        'PublishGate',
        'Evidence',
      ]);
    });
  });

  for (const config of schemaConfigs) {
    describe(config.kind, () => {
      let ajv: Ajv2020;
      let validator: ReturnType<typeof ajv.getSchema>;

      beforeEach(() => {
        ajv = createAjv();
        const commonSchema = JSON.parse(
          readFileSync(join(schemasDir, 'common.schema.json'), 'utf-8')
        );
        ajv.addSchema(commonSchema);
        const schema = JSON.parse(
          readFileSync(join(schemasDir, config.schemaFile), 'utf-8')
        );
        ajv.addSchema(schema);
        validator = ajv.getSchema(`https://agent-protocols/schemas/${config.schemaFile}`);
      });

      it('should have correct kind const', () => {
        const schema = JSON.parse(
          readFileSync(join(schemasDir, config.schemaFile), 'utf-8')
        );
        const kindProperty = schema.allOf?.[1]?.properties?.kind;
        expect(kindProperty?.const).toBe(config.kind);
      });

      it('should have correct ID pattern', () => {
        const schema = JSON.parse(
          readFileSync(join(schemasDir, config.schemaFile), 'utf-8')
        );
        const idProperty = schema.allOf?.[1]?.properties?.id;
        expect(idProperty?.pattern).toBe(config.idPattern);
      });

      it('should have unevaluatedProperties set to false', () => {
        const schema = JSON.parse(
          readFileSync(join(schemasDir, config.schemaFile), 'utf-8')
        );
        expect(schema.unevaluatedProperties).toBe(false);
      });

      for (const sampleFile of config.sampleFiles) {
        it(`should validate ${sampleFile}`, () => {
          const sample = JSON.parse(
            readFileSync(join(examplesDir, sampleFile), 'utf-8')
          );
          const valid = validator!(sample);
          expect(valid).toBe(true);
          if (!valid) {
            console.error('Validation errors:', validator!.errors);
          }
        });
      }

      it('should reject invalid ID prefix', () => {
        const sample = JSON.parse(
          readFileSync(join(examplesDir, config.sampleFiles[0]), 'utf-8')
        );
        const invalidSample = { ...sample, id: 'XX-001' };
        const valid = validator!(invalidSample);
        expect(valid).toBe(false);
      });

      it('should reject additional properties', () => {
        const sample = JSON.parse(
          readFileSync(join(examplesDir, config.sampleFiles[0]), 'utf-8')
        );
        const invalidSample = { ...sample, extraField: 'not allowed' };
        const valid = validator!(invalidSample);
        expect(valid).toBe(false);
      });

      it('should reject invalid state', () => {
        const sample = JSON.parse(
          readFileSync(join(examplesDir, config.sampleFiles[0]), 'utf-8')
        );
        const invalidSample = { ...sample, state: 'InvalidState' };
        const valid = validator!(invalidSample);
        expect(valid).toBe(false);
      });
    });
  }
});

describe('All Sample Files', () => {
  it('should have all required sample files', () => {
    const expectedFiles = [
      'intent.sample.json',
      'taskseed.sample.json',
      'acceptance.sample.json',
      'publishgate-low.sample.json',
      'publishgate-high.sample.json',
      'evidence.sample.json',
    ];
    const actualFiles = readdirSync(examplesDir).filter(f => f.endsWith('.json'));
    for (const expected of expectedFiles) {
      expect(actualFiles).toContain(expected);
    }
  });
});

describe('PublishGate Specific Validation', () => {
  let ajv: Ajv2020;
  let validator: ReturnType<typeof ajv.getSchema>;

  beforeEach(() => {
    ajv = createAjv();
    const commonSchema = JSON.parse(
      readFileSync(join(schemasDir, 'common.schema.json'), 'utf-8')
    );
    ajv.addSchema(commonSchema);
    const publishGateSchema = JSON.parse(
      readFileSync(join(schemasDir, 'PublishGate.schema.json'), 'utf-8')
    );
    ajv.addSchema(publishGateSchema);
    validator = ajv.getSchema('https://agent-protocols/schemas/PublishGate.schema.json');
  });

  it('low risk should have empty requiredApprovals and non-pending finalDecision', () => {
    const sample = JSON.parse(
      readFileSync(join(examplesDir, 'publishgate-low.sample.json'), 'utf-8')
    );
    expect(sample.riskLevel).toBe('low');
    expect(sample.requiredApprovals).toEqual([]);
    expect(sample.finalDecision).not.toBe('pending');
  });

  it('high risk should have requiredApprovals and approvalDeadline', () => {
    const sample = JSON.parse(
      readFileSync(join(examplesDir, 'publishgate-high.sample.json'), 'utf-8')
    );
    expect(sample.riskLevel).toBe('high');
    expect(sample.requiredApprovals.length).toBeGreaterThan(0);
    expect(sample.approvalDeadline).toBeDefined();
  });
});

describe('Evidence Specific Validation', () => {
  let ajv: Ajv2020;
  let validator: ReturnType<typeof ajv.getSchema>;

  beforeEach(() => {
    ajv = createAjv();
    const commonSchema = JSON.parse(
      readFileSync(join(schemasDir, 'common.schema.json'), 'utf-8')
    );
    ajv.addSchema(commonSchema);
    const evidenceSchema = JSON.parse(
      readFileSync(join(schemasDir, 'Evidence.schema.json'), 'utf-8')
    );
    ajv.addSchema(evidenceSchema);
    validator = ajv.getSchema('https://agent-protocols/schemas/Evidence.schema.json');
  });

  it('Evidence should have state Published', () => {
    const sample = JSON.parse(
      readFileSync(join(examplesDir, 'evidence.sample.json'), 'utf-8')
    );
    expect(sample.state).toBe('Published');
  });

  it('Evidence should have all required reproducibility fields', () => {
    const sample = JSON.parse(
      readFileSync(join(examplesDir, 'evidence.sample.json'), 'utf-8')
    );
    const requiredFields = [
      'taskSeedId',
      'baseCommit',
      'headCommit',
      'inputHash',
      'outputHash',
      'model',
      'tools',
      'environment',
      'staleStatus',
      'mergeResult',
      'startTime',
      'endTime',
      'actor',
      'policyVerdict',
      'diffHash',
    ];
    for (const field of requiredFields) {
      expect(sample[field]).toBeDefined();
    }
  });
});