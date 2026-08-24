import { describe, expect, it } from 'vitest';

import { protocolFamilyNames, protocolVersion, validateProtocol } from '../src/index.js';

describe('@mojing/protocol-spec public entry', () => {
  it('exports only the neutral protocol families and validators from its package root', () => {
    expect(protocolVersion).toBe('1.0.0');
    expect(protocolFamilyNames).toEqual([
      'APP',
      'CANVAS',
      'CAP',
      'CHANGE',
      'NODE',
      'PRT-ID',
      'RUN',
      'WORKFLOW'
    ]);
    expect(
      validateProtocol('PRT-ID', {
        ref: { typeId: 'mj.core/identity', id: 'identity-1', version: '1.0.0' },
        roles: {
          actorRef: { typeId: 'mj.core/actor', id: 'actor-1', version: '1.0.0' },
          ownerRef: { typeId: 'mj.core/owner', id: 'owner-1', version: '1.0.0' },
          projectRef: { typeId: 'mj.core/project', id: 'project-1', version: '1.0.0' },
          reviewerRef: { typeId: 'mj.core/reviewer', id: 'reviewer-1', version: '1.0.0' }
        }
      }).valid
    ).toBe(true);
  });
});
