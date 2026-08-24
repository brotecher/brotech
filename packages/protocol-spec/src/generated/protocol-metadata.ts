// Generated from the current protocol registry. Do not edit.

export const protocolVersion = '1.0.0' as const;

export const protocolFamilies = [
  {
    name: 'APP',
    version: '1.0.0',
    schemaId: 'urn:mojing:protocol:app:1.0.0',
    schemaSha256: '7f9260d359371ae20d119d8f4bba067bcfbb3d02fcd7caca4db19e9d9c7a1944',
    derivedType: 'AppProtocol'
  },
  {
    name: 'CANVAS',
    version: '1.0.0',
    schemaId: 'urn:mojing:protocol:canvas:1.0.0',
    schemaSha256: 'c8810fe08378ca94b1355cc71cb0c9d7745334c56c7da20fb41514f4bf16581e',
    derivedType: 'CanvasProtocol'
  },
  {
    name: 'CAP',
    version: '1.0.0',
    schemaId: 'urn:mojing:protocol:cap:1.0.0',
    schemaSha256: 'fc6c1a5d0c57504a1b57a67f64ab1ab81bed0b57b302baabf66e226cd633aa4e',
    derivedType: 'CapabilityProtocol'
  },
  {
    name: 'CHANGE',
    version: '1.0.0',
    schemaId: 'urn:mojing:protocol:change:1.0.0',
    schemaSha256: '01b76c57685738cd3e80c703494bb8698f9285c5c8eea87d1efd477ae5505b70',
    derivedType: 'ChangeProtocol'
  },
  {
    name: 'NODE',
    version: '1.0.0',
    schemaId: 'urn:mojing:protocol:node:1.0.0',
    schemaSha256: '5d6a909598bf0b2e72617b0bfd899dd5339b93f42eefff9acfa6c17584c7046b',
    derivedType: 'NodeProtocol'
  },
  {
    name: 'PRT-ID',
    version: '1.0.0',
    schemaId: 'urn:mojing:protocol:prt-id:1.0.0',
    schemaSha256: 'c3b5aaf755dcd74b43d0699a5dacfe6c7c0b616e6fab93e5c228313b4c5198f8',
    derivedType: 'PrtIdProtocol'
  },
  {
    name: 'RUN',
    version: '1.0.0',
    schemaId: 'urn:mojing:protocol:run:1.0.0',
    schemaSha256: 'e50bf60564624a70c7537a5c648a6881c7c9d3e4ae94c52f61bd3cbc968c1fd0',
    derivedType: 'RunProtocol'
  },
  {
    name: 'WORKFLOW',
    version: '1.0.0',
    schemaId: 'urn:mojing:protocol:workflow:1.0.0',
    schemaSha256: '503e3251de1108889b4f863df29706167acb0abb88d49c678dee9b3537eab71f',
    derivedType: 'WorkflowProtocol'
  }
] as const;

export const protocolFamilyNames = protocolFamilies.map((family) => family.name);
