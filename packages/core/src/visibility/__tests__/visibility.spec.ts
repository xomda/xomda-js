import { describe, expect, it } from 'vitest'

import type { Visibility, VisibilityCheck } from '../index'
import { getEffectiveVisibility, isVisibleFrom } from '../index'

const PKG_A = 'pkg-a'
const PKG_A_SUB = 'pkg-a-sub'
const PKG_B = 'pkg-b'
const MODEL_X = 'model-x'
const MODEL_Y = 'model-y'

const check = (overrides: Partial<VisibilityCheck>): VisibilityCheck => ({
  effective: 'public',
  targetModelId: MODEL_X,
  targetPackageId: PKG_A,
  consumerModelId: MODEL_X,
  consumerPackageChainIds: [],
  ...overrides,
})

describe('D2 — Effective visibility resolver', () => {
  describe('getEffectiveVisibility — package-chain narrowing', () => {
    it('public entity with no package chain stays public', () => {
      expect(getEffectiveVisibility({ visibility: 'public' }, [])).toBe<Visibility>('public')
    })

    it('absent visibility on target defaults to public', () => {
      expect(getEffectiveVisibility({}, [])).toBe<Visibility>('public')
    })

    it('public entity inside a model-private package narrows to model-private', () => {
      expect(
        getEffectiveVisibility({ visibility: 'public' }, [{ visibility: 'model-private' }])
      ).toBe<Visibility>('model-private')
    })

    it('package-private entity inside a model-private package narrows to model-private', () => {
      expect(
        getEffectiveVisibility({ visibility: 'package-private' }, [{ visibility: 'model-private' }])
      ).toBe<Visibility>('model-private')
    })

    it('package-private entity inside a public package stays package-private', () => {
      expect(
        getEffectiveVisibility({ visibility: 'package-private' }, [{ visibility: 'public' }])
      ).toBe<Visibility>('package-private')
    })

    it('public entity inside a chain of mixed packages narrows to the most-restrictive', () => {
      // chain order: nearest first → root last; result is independent of order
      expect(
        getEffectiveVisibility({ visibility: 'public' }, [
          { visibility: 'public' },
          { visibility: 'package-private' },
          { visibility: 'public' },
        ])
      ).toBe<Visibility>('package-private')
    })
  })

  describe('isVisibleFrom — same model short-circuits', () => {
    it('public entity is visible from same model', () => {
      expect(isVisibleFrom(check({ effective: 'public', consumerModelId: MODEL_X }))).toBe(true)
    })

    it('model-private entity IS visible from same model', () => {
      expect(isVisibleFrom(check({ effective: 'model-private', consumerModelId: MODEL_X }))).toBe(
        true
      )
    })

    it('package-private entity IS visible from same model regardless of package', () => {
      expect(
        isVisibleFrom(
          check({
            effective: 'package-private',
            consumerModelId: MODEL_X,
            consumerPackageChainIds: [PKG_B],
          })
        )
      ).toBe(true)
    })
  })

  describe('isVisibleFrom — cross-model', () => {
    it('public entity is visible from different model in same project', () => {
      expect(isVisibleFrom(check({ effective: 'public', consumerModelId: MODEL_Y }))).toBe(true)
    })

    it('model-private entity is NOT visible from different model', () => {
      expect(isVisibleFrom(check({ effective: 'model-private', consumerModelId: MODEL_Y }))).toBe(
        false
      )
    })

    it('package-private entity IS visible from same package, different model', () => {
      expect(
        isVisibleFrom(
          check({
            effective: 'package-private',
            consumerModelId: MODEL_Y,
            consumerPackageChainIds: [PKG_A],
          })
        )
      ).toBe(true)
    })

    it('package-private entity IS visible from a descendant package, different model', () => {
      expect(
        isVisibleFrom(
          check({
            effective: 'package-private',
            consumerModelId: MODEL_Y,
            // consumer is in pkg-a-sub whose package chain includes pkg-a
            consumerPackageChainIds: [PKG_A_SUB, PKG_A],
          })
        )
      ).toBe(true)
    })

    it('package-private entity is NOT visible from a sibling/different package, different model', () => {
      expect(
        isVisibleFrom(
          check({
            effective: 'package-private',
            consumerModelId: MODEL_Y,
            consumerPackageChainIds: [PKG_B],
          })
        )
      ).toBe(false)
    })

    it('package-private entity with no defining package is NOT visible across models', () => {
      expect(
        isVisibleFrom(
          check({
            effective: 'package-private',
            targetPackageId: null,
            consumerModelId: MODEL_Y,
            consumerPackageChainIds: [PKG_A],
          })
        )
      ).toBe(false)
    })
  })

  describe('isVisibleFrom — cross-project', () => {
    it('public entity IS visible from a different project', () => {
      expect(
        isVisibleFrom(
          check({
            effective: 'public',
            consumerModelId: MODEL_Y,
            consumerProjectId: 'p2',
            targetProjectId: 'p1',
          })
        )
      ).toBe(true)
    })

    it('package-private entity is NOT visible from a different project, even from same-named package', () => {
      expect(
        isVisibleFrom(
          check({
            effective: 'package-private',
            consumerModelId: MODEL_Y,
            consumerPackageChainIds: [PKG_A],
            consumerProjectId: 'p2',
            targetProjectId: 'p1',
          })
        )
      ).toBe(false)
    })

    it('model-private entity is NOT visible from a different project', () => {
      expect(
        isVisibleFrom(
          check({
            effective: 'model-private',
            consumerModelId: MODEL_Y,
            consumerProjectId: 'p2',
            targetProjectId: 'p1',
          })
        )
      ).toBe(false)
    })
  })
})
