// Generated from the current protocol JSON Schemas. Do not edit.

export const protocolSchemas = {
  'PRT-ID': {
    sourcePath: 'schemas/prt-id.schema.json',
    schemaId: 'urn:mojing:protocol:prt-id:1.0.0',
    schemaSha256: 'c3b5aaf755dcd74b43d0699a5dacfe6c7c0b616e6fab93e5c228313b4c5198f8',
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'urn:mojing:protocol:prt-id:1.0.0',
      title: 'Mojing PRT-ID Protocol',
      type: 'object',
      required: ['ref', 'roles'],
      additionalProperties: false,
      properties: {
        ref: {
          $ref: '#/$defs/stableRef'
        },
        roles: {
          type: 'object',
          required: ['actorRef', 'ownerRef', 'projectRef', 'reviewerRef'],
          additionalProperties: false,
          properties: {
            actorRef: {
              $ref: '#/$defs/stableRef'
            },
            ownerRef: {
              $ref: '#/$defs/stableRef'
            },
            projectRef: {
              $ref: '#/$defs/stableRef'
            },
            reviewerRef: {
              $ref: '#/$defs/stableRef'
            }
          }
        }
      },
      $defs: {
        stableRef: {
          type: 'object',
          required: ['id', 'typeId', 'version'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              minLength: 3,
              pattern: '^[a-z][a-z0-9-]{2,63}$'
            },
            typeId: {
              type: 'string',
              pattern: '^mj\\.(core|ext\\.[a-z][a-z0-9-]*)/[a-z][a-z0-9-]*$'
            },
            version: {
              type: 'string',
              minLength: 1,
              pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$'
            }
          }
        }
      }
    }
  },
  CAP: {
    sourcePath: 'schemas/cap.schema.json',
    schemaId: 'urn:mojing:protocol:cap:1.0.0',
    schemaSha256: 'fc6c1a5d0c57504a1b57a67f64ab1ab81bed0b57b302baabf66e226cd633aa4e',
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'urn:mojing:protocol:cap:1.0.0',
      title: 'Mojing CAP Protocol',
      type: 'object',
      required: [
        'id',
        'inputs',
        'outputs',
        'permission',
        'publicErrors',
        'usageCost',
        'sideEffect',
        'deterministicMockEntry'
      ],
      additionalProperties: false,
      properties: {
        id: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        inputs: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: '#/$defs/port'
          }
        },
        outputs: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: '#/$defs/port'
          }
        },
        permission: {
          type: 'string',
          minLength: 1
        },
        publicErrors: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1
          }
        },
        usageCost: {
          type: 'object',
          required: ['mode', 'amount', 'unit', 'source'],
          additionalProperties: false,
          properties: {
            mode: {
              enum: ['fixed', 'estimated', 'actual']
            },
            amount: {
              type: 'number',
              minimum: 0
            },
            unit: {
              type: 'string',
              minLength: 1
            },
            source: {
              type: 'string',
              minLength: 1
            }
          }
        },
        sideEffect: {
          enum: [
            'none',
            'read',
            'candidate',
            'formal-write',
            'delete',
            'external-send',
            'permission-change'
          ]
        },
        deterministicMockEntry: {
          type: 'string',
          minLength: 1
        }
      },
      $defs: {
        port: {
          type: 'object',
          required: ['name', 'typeRef', 'required'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1
            },
            typeRef: {
              type: 'string',
              minLength: 1
            },
            required: {
              type: 'boolean'
            }
          }
        }
      }
    }
  },
  NODE: {
    sourcePath: 'schemas/node.schema.json',
    schemaId: 'urn:mojing:protocol:node:1.0.0',
    schemaSha256: '5d6a909598bf0b2e72617b0bfd899dd5339b93f42eefff9acfa6c17584c7046b',
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'urn:mojing:protocol:node:1.0.0',
      title: 'Mojing NODE Protocol',
      type: 'object',
      required: [
        'id',
        'category',
        'inputPorts',
        'outputPorts',
        'parameters',
        'capabilityDependencies',
        'permissionDependencies',
        'sideEffectPolicy',
        'costPolicy',
        'errorExits',
        'timeout',
        'retry',
        'cancellation',
        'cache',
        'idempotency'
      ],
      additionalProperties: false,
      properties: {
        id: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        category: {
          type: 'string',
          minLength: 1
        },
        inputPorts: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: '#/$defs/port'
          }
        },
        outputPorts: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: '#/$defs/port'
          }
        },
        parameters: {
          type: 'array',
          items: {
            $ref: '#/$defs/port'
          }
        },
        capabilityDependencies: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: './prt-id.schema.json#/$defs/stableRef'
          }
        },
        permissionDependencies: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1
          }
        },
        sideEffectPolicy: {
          enum: [
            'none',
            'read',
            'candidate',
            'formal-write',
            'delete',
            'external-send',
            'permission-change'
          ]
        },
        costPolicy: {
          enum: ['none', 'fixed', 'estimated', 'actual']
        },
        errorExits: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1
          }
        },
        timeout: {
          type: 'object',
          required: ['milliseconds', 'outcome'],
          additionalProperties: false,
          properties: {
            milliseconds: {
              type: 'integer',
              minimum: 1
            },
            outcome: {
              enum: ['failed', 'cancelled']
            }
          }
        },
        retry: {
          type: 'object',
          required: ['maxAttempts', 'retryableErrors', 'backoff'],
          additionalProperties: false,
          properties: {
            maxAttempts: {
              type: 'integer',
              minimum: 1
            },
            retryableErrors: {
              type: 'array',
              uniqueItems: true,
              items: {
                type: 'string',
                minLength: 1
              }
            },
            backoff: {
              enum: ['none', 'fixed']
            }
          }
        },
        cancellation: {
          type: 'object',
          required: ['supported', 'lateResultPolicy'],
          additionalProperties: false,
          properties: {
            supported: {
              type: 'boolean'
            },
            lateResultPolicy: {
              const: 'discard'
            }
          }
        },
        cache: {
          type: 'object',
          required: ['mode', 'keyIncludes'],
          additionalProperties: false,
          properties: {
            mode: {
              enum: ['disabled', 'read-only']
            },
            keyIncludes: {
              type: 'array',
              minItems: 5,
              uniqueItems: true,
              items: {
                type: 'string',
                minLength: 1
              }
            }
          }
        },
        idempotency: {
          type: 'object',
          required: ['required', 'keyScope', 'effectIdentity'],
          additionalProperties: false,
          properties: {
            required: {
              type: 'boolean'
            },
            keyScope: {
              type: 'string',
              minLength: 1
            },
            effectIdentity: {
              type: 'string',
              minLength: 1
            }
          }
        }
      },
      $defs: {
        port: {
          type: 'object',
          required: ['name', 'typeRef', 'required'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1
            },
            typeRef: {
              type: 'string',
              minLength: 1
            },
            required: {
              type: 'boolean'
            }
          }
        }
      }
    }
  },
  WORKFLOW: {
    sourcePath: 'schemas/workflow.schema.json',
    schemaId: 'urn:mojing:protocol:workflow:1.0.0',
    schemaSha256: '503e3251de1108889b4f863df29706167acb0abb88d49c678dee9b3537eab71f',
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'urn:mojing:protocol:workflow:1.0.0',
      title: 'Mojing WORKFLOW Protocol',
      type: 'object',
      required: [
        'id',
        'inputs',
        'outputs',
        'nodes',
        'connections',
        'entryNodeId',
        'failurePaths',
        'reviewPoints',
        'changeDecisionPath',
        'dependencyLock'
      ],
      additionalProperties: false,
      properties: {
        id: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        inputs: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: '#/$defs/port'
          }
        },
        outputs: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: '#/$defs/port'
          }
        },
        nodes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['nodeId', 'nodeRef'],
            additionalProperties: false,
            properties: {
              nodeId: {
                type: 'string',
                minLength: 1
              },
              nodeRef: {
                $ref: './prt-id.schema.json#/$defs/stableRef'
              }
            }
          }
        },
        connections: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['fromNode', 'fromPort', 'toNode', 'toPort', 'typeRef'],
            additionalProperties: false,
            properties: {
              fromNode: {
                type: 'string',
                minLength: 1
              },
              fromPort: {
                type: 'string',
                minLength: 1
              },
              toNode: {
                type: 'string',
                minLength: 1
              },
              toPort: {
                type: 'string',
                minLength: 1
              },
              typeRef: {
                type: 'string',
                minLength: 1
              }
            }
          }
        },
        entryNodeId: {
          type: 'string',
          minLength: 1
        },
        failurePaths: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1
          }
        },
        reviewPoints: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['nodeId', 'reviewerRequired'],
            additionalProperties: false,
            properties: {
              nodeId: {
                type: 'string',
                minLength: 1
              },
              reviewerRequired: {
                type: 'boolean'
              }
            }
          }
        },
        changeDecisionPath: {
          type: 'string',
          minLength: 1
        },
        dependencyLock: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: './prt-id.schema.json#/$defs/stableRef'
          }
        }
      },
      $defs: {
        port: {
          type: 'object',
          required: ['name', 'typeRef', 'required'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1
            },
            typeRef: {
              type: 'string',
              minLength: 1
            },
            required: {
              type: 'boolean'
            }
          }
        }
      }
    }
  },
  RUN: {
    sourcePath: 'schemas/run.schema.json',
    schemaId: 'urn:mojing:protocol:run:1.0.0',
    schemaSha256: 'e50bf60564624a70c7537a5c648a6881c7c9d3e4ae94c52f61bd3cbc968c1fd0',
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'urn:mojing:protocol:run:1.0.0',
      title: 'Mojing RUN Protocol',
      type: 'object',
      required: [
        'id',
        'workflowRef',
        'nodeVersions',
        'capabilityVersions',
        'dataVersions',
        'status',
        'attempt',
        'timeoutMilliseconds',
        'retry',
        'cancellation',
        'usageCost',
        'review',
        'changeResult'
      ],
      additionalProperties: false,
      properties: {
        id: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        workflowRef: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        nodeVersions: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: './prt-id.schema.json#/$defs/stableRef'
          }
        },
        capabilityVersions: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: './prt-id.schema.json#/$defs/stableRef'
          }
        },
        dataVersions: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: './prt-id.schema.json#/$defs/stableRef'
          }
        },
        status: {
          enum: [
            'not-started',
            'running',
            'waiting-human-review',
            'cancellation-requested',
            'cancelled',
            'succeeded',
            'failed'
          ]
        },
        attempt: {
          type: 'integer',
          minimum: 0
        },
        error: {
          type: 'object',
          required: ['code', 'retryable'],
          additionalProperties: false,
          properties: {
            code: {
              type: 'string',
              minLength: 1
            },
            retryable: {
              type: 'boolean'
            }
          }
        },
        timeoutMilliseconds: {
          type: 'integer',
          minimum: 1
        },
        retry: {
          type: 'object',
          required: ['maxAttempts', 'nextAttemptAllowed'],
          additionalProperties: false,
          properties: {
            maxAttempts: {
              type: 'integer',
              minimum: 1
            },
            nextAttemptAllowed: {
              type: 'boolean'
            }
          }
        },
        cancellation: {
          type: 'object',
          required: ['requested', 'confirmed', 'lateResultPolicy'],
          additionalProperties: false,
          properties: {
            requested: {
              type: 'boolean'
            },
            confirmed: {
              type: 'boolean'
            },
            lateResultPolicy: {
              const: 'discard'
            }
          }
        },
        usageCost: {
          type: 'object',
          required: ['amount', 'unit', 'source'],
          additionalProperties: false,
          properties: {
            amount: {
              type: 'number',
              minimum: 0
            },
            unit: {
              type: 'string',
              minLength: 1
            },
            source: {
              type: 'string',
              minLength: 1
            }
          }
        },
        review: {
          type: 'object',
          required: ['required', 'status'],
          additionalProperties: false,
          properties: {
            required: {
              type: 'boolean'
            },
            status: {
              enum: ['not-required', 'pending', 'accepted', 'rejected']
            }
          }
        },
        changeResult: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: {
            status: {
              enum: ['none', 'candidate', 'accepted', 'rejected', 'conflict']
            },
            changeRef: {
              $ref: './prt-id.schema.json#/$defs/stableRef'
            }
          }
        }
      }
    }
  },
  CHANGE: {
    sourcePath: 'schemas/change.schema.json',
    schemaId: 'urn:mojing:protocol:change:1.0.0',
    schemaSha256: '01b76c57685738cd3e80c703494bb8698f9285c5c8eea87d1efd477ae5505b70',
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'urn:mojing:protocol:change:1.0.0',
      title: 'Mojing CHANGE Protocol',
      type: 'object',
      required: [
        'id',
        'targets',
        'baseVersion',
        'proposedChanges',
        'sourceRef',
        'checks',
        'reviewerRef',
        'permission',
        'decision',
        'conflicts',
        'idempotency',
        'formalWrite'
      ],
      additionalProperties: false,
      properties: {
        id: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        targets: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: './prt-id.schema.json#/$defs/stableRef'
          }
        },
        baseVersion: {
          type: 'string',
          minLength: 1
        },
        proposedChanges: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['path', 'operation', 'valueJson'],
            additionalProperties: false,
            properties: {
              path: {
                type: 'string',
                minLength: 1
              },
              operation: {
                enum: ['add', 'replace', 'remove']
              },
              valueJson: {
                type: 'string'
              }
            }
          }
        },
        sourceRef: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        checks: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['ruleId', 'status'],
            additionalProperties: false,
            properties: {
              ruleId: {
                type: 'string',
                minLength: 1
              },
              status: {
                enum: ['passed', 'failed']
              }
            }
          }
        },
        reviewerRef: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        permission: {
          type: 'string',
          minLength: 1
        },
        decision: {
          enum: ['candidate', 'accepted', 'rejected', 'conflict']
        },
        conflicts: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1
          }
        },
        idempotency: {
          type: 'object',
          required: ['key', 'effectIdentity'],
          additionalProperties: false,
          properties: {
            key: {
              type: 'string',
              minLength: 1
            },
            effectIdentity: {
              type: 'string',
              minLength: 1
            }
          }
        },
        formalWrite: {
          type: 'boolean'
        }
      }
    }
  },
  APP: {
    sourcePath: 'schemas/app.schema.json',
    schemaId: 'urn:mojing:protocol:app:1.0.0',
    schemaSha256: '7f9260d359371ae20d119d8f4bba067bcfbb3d02fcd7caca4db19e9d9c7a1944',
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'urn:mojing:protocol:app:1.0.0',
      title: 'Mojing APP Protocol',
      type: 'object',
      required: [
        'id',
        'entryWorkflowRef',
        'dependencies',
        'permissions',
        'compatibility',
        'publishStatus',
        'lifecycle',
        'dataOwnership'
      ],
      additionalProperties: false,
      properties: {
        id: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        entryWorkflowRef: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        dependencies: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: './prt-id.schema.json#/$defs/stableRef'
          }
        },
        permissions: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1
          }
        },
        compatibility: {
          type: 'object',
          required: ['protocolVersion', 'status'],
          additionalProperties: false,
          properties: {
            protocolVersion: {
              const: '1.0.0'
            },
            status: {
              enum: ['compatible', 'incompatible', 'unknown']
            }
          }
        },
        publishStatus: {
          enum: ['draft', 'validated', 'approved', 'withdrawn']
        },
        lifecycle: {
          type: 'object',
          required: ['state', 'dataOwnerRef', 'rollbackVersion'],
          additionalProperties: false,
          properties: {
            state: {
              enum: ['installed', 'enabled', 'disabled', 'upgraded', 'rolled-back', 'uninstalled']
            },
            dataOwnerRef: {
              $ref: './prt-id.schema.json#/$defs/stableRef'
            },
            rollbackVersion: {
              type: 'string',
              minLength: 1
            }
          }
        },
        dataOwnership: {
          enum: ['app-owned', 'project-owned', 'user-owned']
        }
      }
    }
  },
  CANVAS: {
    sourcePath: 'schemas/canvas.schema.json',
    schemaId: 'urn:mojing:protocol:canvas:1.0.0',
    schemaSha256: 'c8810fe08378ca94b1355cc71cb0c9d7745334c56c7da20fb41514f4bf16581e',
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'urn:mojing:protocol:canvas:1.0.0',
      title: 'Mojing CANVAS Protocol',
      type: 'object',
      required: [
        'id',
        'nodes',
        'edges',
        'selectedIds',
        'layoutVersion',
        'serializationVersion',
        'kernel',
        'workflowAdapter'
      ],
      additionalProperties: false,
      properties: {
        id: {
          $ref: './prt-id.schema.json#/$defs/stableRef'
        },
        nodes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['id', 'typeRef', 'position', 'dataRef'],
            additionalProperties: false,
            properties: {
              id: {
                type: 'string',
                minLength: 1
              },
              typeRef: {
                type: 'string',
                minLength: 1
              },
              position: {
                type: 'object',
                required: ['x', 'y'],
                additionalProperties: false,
                properties: {
                  x: {
                    type: 'number'
                  },
                  y: {
                    type: 'number'
                  }
                }
              },
              dataRef: {
                $ref: './prt-id.schema.json#/$defs/stableRef'
              }
            }
          }
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'fromNode', 'fromPort', 'toNode', 'toPort', 'typeRef'],
            additionalProperties: false,
            properties: {
              id: {
                type: 'string',
                minLength: 1
              },
              fromNode: {
                type: 'string',
                minLength: 1
              },
              fromPort: {
                type: 'string',
                minLength: 1
              },
              toNode: {
                type: 'string',
                minLength: 1
              },
              toPort: {
                type: 'string',
                minLength: 1
              },
              typeRef: {
                type: 'string',
                minLength: 1
              }
            }
          }
        },
        selectedIds: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1
          }
        },
        layoutVersion: {
          type: 'string',
          minLength: 1
        },
        serializationVersion: {
          type: 'string',
          minLength: 1
        },
        kernel: {
          type: 'object',
          required: ['domainSchemaRefs', 'vendorTypeRefs', 'testSeam'],
          additionalProperties: false,
          properties: {
            domainSchemaRefs: {
              type: 'array',
              maxItems: 0,
              items: {
                type: 'string'
              }
            },
            vendorTypeRefs: {
              type: 'array',
              maxItems: 0,
              items: {
                type: 'string'
              }
            },
            testSeam: {
              type: 'string',
              minLength: 1
            }
          }
        },
        workflowAdapter: {
          type: 'object',
          required: ['workflowRef', 'layoutChangeCreatesDomainChangeSet'],
          additionalProperties: false,
          properties: {
            workflowRef: {
              $ref: './prt-id.schema.json#/$defs/stableRef'
            },
            layoutChangeCreatesDomainChangeSet: {
              const: false
            }
          }
        }
      }
    }
  }
} as const;
